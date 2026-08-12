// api-gateway/index.js
// Único punto de entrada del cliente web (REST/HTTP). Todo el tráfico hacia los
// microservicios internos (auth, catalog, reproduction, analytics) es gRPC —
// no queda ningún http-proxy-middleware ni llamada REST entre servicios.
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
// origin explícito (no '*') porque credentials:true lo exige — la combinación
// wildcard + credentials es inválida y los navegadores la rechazan.
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecreto_yousac_2026';

// ── Clientes gRPC (uno por microservicio, canal reutilizado) ─────────────────
const PROTO_OPTS = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true };

function loadClient(protoFile, pkg, serviceName, target) {
  const def = protoLoader.loadSync(path.join(__dirname, 'proto', protoFile), PROTO_OPTS);
  const proto = grpc.loadPackageDefinition(def)[pkg];
  return new proto[serviceName](target, grpc.credentials.createInsecure());
}

const authClient = loadClient(
  'auth.proto', 'auth', 'AuthService',
  process.env.AUTH_GRPC_URL || 'localhost:50052',
);
const catalogClient = loadClient(
  'catalog.proto', 'catalog', 'CatalogService',
  process.env.CATALOG_GRPC_URL || 'localhost:50053',
);
const reproductionClient = loadClient(
  'checkpoints.proto', 'reproduccion', 'ReproduccionService',
  process.env.REPRODUCTION_GRPC_URL || 'localhost:50051',
);
const analyticsClient = loadClient(
  'analytics.proto', 'analytics', 'AnalyticsService',
  process.env.ANALYTICS_GRPC_URL || 'localhost:50054',
);

// ── Helpers gRPC ──────────────────────────────────────────────────────────
function callGrpc(client, method, request, metadata = new grpc.Metadata()) {
  return new Promise((resolve, reject) => {
    client[method](request, metadata, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

function extractToken(req) {
  return req.headers.authorization?.split(' ')[1] || req.cookies?.session_token;
}

function buildMetadata(req) {
  const md = new grpc.Metadata();
  const token = extractToken(req);
  if (token) md.add('authorization', `Bearer ${token}`);
  return md;
}

const GRPC_TO_HTTP = {
  [grpc.status.INVALID_ARGUMENT]: 400,
  [grpc.status.UNAUTHENTICATED]: 401,
  [grpc.status.PERMISSION_DENIED]: 403,
  [grpc.status.NOT_FOUND]: 404,
  [grpc.status.ALREADY_EXISTS]: 409,
  [grpc.status.FAILED_PRECONDITION]: 409,
  [grpc.status.UNAVAILABLE]: 503,
  [grpc.status.INTERNAL]: 500,
};

function handleGrpcError(err, res, fallbackMessage) {
  const httpStatus = GRPC_TO_HTTP[err.code] || 502;
  const message = err.details || fallbackMessage;
  console.error(`[gRPC Error] code=${err.code} ${message}`);
  res.status(httpStatus).json({ message });
}

// Middleware: validar JWT (primera línea de defensa; cada microservicio
// vuelve a validarlo de forma independiente al recibir la metadata gRPC).
const validateJWT = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// Helper para las rutas "GET/POST algo/:id → RPC(id) → JSON" (la mayoría de
// catálogo/analítica siguen este mismo patrón).
function jsonIdRoute(method, path_, client, rpcMethod, buildRequest, fallbackMessage) {
  app[method](path_, validateJWT, async (req, res) => {
    try {
      const result = await callGrpc(client, rpcMethod, buildRequest(req), buildMetadata(req));
      res.json(JSON.parse(result.json));
    } catch (err) {
      handleGrpcError(err, res, fallbackMessage);
    }
  });
}

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'gateway' }));

// ── Auth (públicas) ───────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    const result = await callGrpc(authClient, 'Register', { email, password, full_name });
    res.status(201).json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al registrar usuario');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await callGrpc(authClient, 'Login', { email, password });

    // Session Cookie HttpOnly + Secure (requisito de la práctica). El microservicio
    // de auth no conoce HTTP/cookies — eso es responsabilidad exclusiva del gateway,
    // único componente que le habla HTTP al navegador.
    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    });

    res.status(200).json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Correo o contraseña incorrectos');
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = extractToken(req);
    if (token) await callGrpc(authClient, 'Logout', { token });
    res.clearCookie('session_token');
    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
  } catch (err) {
    handleGrpcError(err, res, 'Error al cerrar sesión');
  }
});

// ── Users (protegidas) ────────────────────────────────────────────────────
app.get('/api/users', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(authClient, 'GetAllUsers', {}, buildMetadata(req));
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener usuarios');
  }
});

// Debe registrarse ANTES de /api/users/:id para que "me" no se interprete como id.
app.get('/api/users/me/profile', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(authClient, 'GetUserById', { id: req.user.sub }, buildMetadata(req));
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener perfil');
  }
});

app.get('/api/users/:id', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(
      authClient, 'GetUserById', { id: parseInt(req.params.id) }, buildMetadata(req),
    );
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener usuario');
  }
});

app.put('/api/users/:id/role', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(authClient, 'AssignRole', {
      user_id: parseInt(req.params.id),
      role_id: req.body.role_id,
      admin_id: req.user.sub,
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al asignar rol');
  }
});

app.put('/api/users/:id/block', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(authClient, 'ToggleBlock', {
      user_id: parseInt(req.params.id),
      blocked: !!req.body.blocked,
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al actualizar estado del usuario');
  }
});

// ── Catálogo (protegidas) ──────────────────────────────────────────────────
// schools/courses van ANTES de /api/catalog/:id (si no, "schools"/"courses" se
// interpretarían como el :id de una grabación).
app.get('/api/catalog/schools', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(catalogClient, 'GetSchools', {}, buildMetadata(req));
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener escuelas');
  }
});

app.get('/api/catalog/courses', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(
      catalogClient, 'GetCourses', { school_id: req.query.school_id || '' }, buildMetadata(req),
    );
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener cursos');
  }
});

app.get('/api/catalog', validateJWT, async (req, res) => {
  try {
    const q = req.query;
    const result = await callGrpc(catalogClient, 'GetCatalog', {
      user_id: req.user.sub,
      role: req.user.role,
      semester: q.semester || '',
      year: q.year || '',
      school_id: q.school_id || '',
      course_id: q.course_id || '',
      teacher_id: q.teacher_id || '',
      tag: q.tag || '',
      search: q.search || '',
      page: parseInt(q.page) || 1,
      limit: parseInt(q.limit) || 20,
    }, buildMetadata(req));
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener catálogo');
  }
});

app.get('/api/catalog/:id', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(catalogClient, 'GetRecordingById', {
      id: parseInt(req.params.id),
      user_id: req.user.sub,
      role: req.user.role,
    }, buildMetadata(req));
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener grabación');
  }
});

// ── Inscripciones (protegidas) ─────────────────────────────────────────────
app.post('/api/enrollments', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(catalogClient, 'EnrollStudent', {
      student_id: req.body.student_id,
      course_id: req.body.course_id,
      admin_id: req.user.sub,
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al inscribir estudiante');
  }
});

app.delete('/api/enrollments/:student_id/:course_id', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(catalogClient, 'UnenrollStudent', {
      student_id: parseInt(req.params.student_id),
      course_id: parseInt(req.params.course_id),
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al eliminar inscripción');
  }
});

app.get('/api/enrollments/my-courses', validateJWT, async (req, res) => {
  try {
    // student_id lo resuelve catalog-service desde el JWT (metadata), no del request.
    const result = await callGrpc(catalogClient, 'GetMyCourses', {}, buildMetadata(req));
    res.json(JSON.parse(result.json));
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener mis cursos');
  }
});

// ── Reproducción: checkpoints, ratings, sesiones (protegidas) ─────────────
app.post('/api/checkpoints', validateJWT, async (req, res) => {
  try {
    const { user_id, video_id, position_seconds, total_seconds } = req.body;
    const result = await callGrpc(reproductionClient, 'SaveCheckpoint', {
      user_id: String(user_id),
      video_id: String(video_id),
      position_seconds,
      total_seconds,
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al guardar checkpoint');
  }
});

app.get('/api/checkpoints/:video_id', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(reproductionClient, 'GetCheckpoint', {
      user_id: String(req.query.user_id || ''),
      video_id: String(req.params.video_id),
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener checkpoint');
  }
});

app.post('/api/ratings', validateJWT, async (req, res) => {
  try {
    const { user_id, video_id, stars, comment } = req.body;
    const result = await callGrpc(reproductionClient, 'SaveRating', {
      user_id: String(user_id),
      video_id: String(video_id),
      stars,
      comment: comment || '',
    }, buildMetadata(req));
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al calificar el video');
  }
});

app.get('/api/ratings/:video_id/stats', validateJWT, async (req, res) => {
  try {
    const result = await callGrpc(
      reproductionClient, 'GetRatingStats', { video_id: String(req.params.video_id) }, buildMetadata(req),
    );
    res.json(result);
  } catch (err) {
    handleGrpcError(err, res, 'Error al obtener estadísticas de calificación');
  }
});

app.post('/api/videos/session/start', validateJWT, async (req, res) => {
  try {
    const { user_id, video_id, resolution } = req.body;
    const result = await callGrpc(reproductionClient, 'StartSession', {
      user_id: String(user_id),
      video_id: String(video_id),
      resolution: resolution || '',
    }, buildMetadata(req));
    res.json({
      session_id: result.session_id,
      start_position: result.start_position,
      checkpoint: result.checkpoint || null,
    });
  } catch (err) {
    handleGrpcError(err, res, 'Error al iniciar sesión de reproducción');
  }
});

app.post('/api/videos/session/event', validateJWT, async (req, res) => {
  try {
    const { session_id, type, position_seconds } = req.body;
    await callGrpc(
      reproductionClient, 'RecordEvent', { session_id, type, position_seconds }, buildMetadata(req),
    );
    res.json({ ok: true });
  } catch (err) {
    handleGrpcError(err, res, 'Error al registrar evento de reproducción');
  }
});

// ── Analítica (protegidas) ──────────────────────────────────────────────────
jsonIdRoute('get', '/api/analytics/metrics/video/:video_id', analyticsClient, 'GetVideoMetrics',
  req => ({ id: parseInt(req.params.video_id) }), 'Error al obtener métricas de video');

jsonIdRoute('get', '/api/analytics/metrics/course/:course_id', analyticsClient, 'GetCourseMetrics',
  req => ({ id: parseInt(req.params.course_id) }), 'Error al obtener métricas de curso');

jsonIdRoute('get', '/api/analytics/metrics/teacher/:teacher_id', analyticsClient, 'GetTeacherStats',
  req => ({ id: parseInt(req.params.teacher_id) }), 'Error al obtener estadísticas de docente');

jsonIdRoute('get', '/api/analytics/metrics/student/:student_id/course/:course_id', analyticsClient, 'GetStudentProgress',
  req => ({ student_id: parseInt(req.params.student_id), course_id: parseInt(req.params.course_id) }),
  'Error al obtener progreso del estudiante');

jsonIdRoute('post', '/api/analytics/metrics/sync/video/:video_id', analyticsClient, 'SyncVideoMetrics',
  req => ({ id: parseInt(req.params.video_id) }), 'Error al sincronizar métricas de video');

jsonIdRoute('get', '/api/analytics/reports/top-videos', analyticsClient, 'GetTopVideos',
  req => ({ limit: parseInt(req.query.limit) || 10 }), 'Error al obtener top de videos');

jsonIdRoute('get', '/api/analytics/reports/system-stats', analyticsClient, 'GetSystemStats',
  () => ({}), 'Error al obtener estadísticas del sistema');

jsonIdRoute('get', '/api/analytics/reports/teacher/:teacher_id/performance', analyticsClient, 'GetTeacherPerformance',
  req => ({ id: parseInt(req.params.teacher_id) }), 'Error al obtener rendimiento del docente');

jsonIdRoute('get', '/api/analytics/reports/course/:course_id/progress', analyticsClient, 'GetCourseProgress',
  req => ({ id: parseInt(req.params.course_id) }), 'Error al obtener progreso del curso');

jsonIdRoute('get', '/api/analytics/reports/engagement/:video_id', analyticsClient, 'GetVideoEngagement',
  req => ({ id: parseInt(req.params.video_id) }), 'Error al obtener engagement del video');

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ API Gateway (REST↔gRPC) corriendo en puerto ${PORT}`));
