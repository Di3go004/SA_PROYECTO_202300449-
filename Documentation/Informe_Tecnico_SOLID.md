# Informe Técnico — YoUSAC (Práctica 2)

## 1. Arquitectura implementada

Sistema de microservicios poliglota con **un único punto de entrada** (API Gateway) y **gRPC estricto** para todo el tráfico interno. El navegador solo habla REST/HTTP con el Gateway; el Gateway solo habla gRPC con los microservicios.

```
Navegador (React/Vite)
      │  REST/HTTP (JSON)
      ▼
API Gateway (Node/Express) ── único punto de entrada, valida JWT, CORS, cookie de sesión
      │  gRPC (Protocol Buffers) — /proto/*.proto
      ├──► auth-service        (NestJS/TypeScript · PostgreSQL · puerto gRPC 50052)
      ├──► catalog-service     (NestJS/TypeScript · PostgreSQL · puerto gRPC 50053)
      ├──► reproduction-service(Go/Gin        · MongoDB    · puerto gRPC 50051)
      └──► analytics-service   (Python/FastAPI· MySQL      · puerto gRPC 50054)
                                     ▲
                                     └── también consume ReproduccionService por gRPC
                                         (sincroniza métricas de checkpoints/ratings)
```

**Persistencia**: cada microservicio es dueño exclusivo de su base de datos (Postgres para auth/catalog, MongoDB para reproduction, MySQL para analytics), con procedimientos almacenados, vistas, funciones y triggers (`DB/*.sql`, `DB/reproduction_mongodb.js`).

**Contratos unificados**: `/proto/{auth,catalog,checkpoints,analytics}.proto` son la fuente de verdad; cada servicio mantiene una copia local (su Dockerfile solo ve su propio contexto de build) generada/sincronizada desde esos contratos.

**Sesión**: el JWT lo emite `auth-service` vía gRPC (`AuthService.Login`); el Gateway —único componente que habla HTTP con el navegador— es quien setea la cookie `session_token` con `HttpOnly`, `Secure` (en producción) y `SameSite=Strict`, además de aceptar el token también por header `Authorization: Bearer`. Cada microservicio vuelve a validar el JWT de forma independiente (defensa en profundidad), leyéndolo de la metadata gRPC en vez de headers HTTP.

**Frontend**: React + Vite consumiendo el Gateway vía `axios`, con `AuthProvider` (Context API) manejando sesión y checkpoint de reproducción persistido en `reproduction-service`.

---

## 2. Matriz SOLID

| Principio | Cómo se aplica | Evidencia concreta |
|---|---|---|
| **S — Responsabilidad única** | Cada capa tiene un único motivo de cambio: *Controller* (traduce transporte↔dominio) → *Service* (regla de negocio) → *Repository* (persistencia). Los guards también están separados por responsabilidad (autenticar ≠ autorizar). | Go: `internal/checkpoints/{service,repository}.go` separados (el `handler.go` HTTP se eliminó al migrar a gRPC, la lógica no se tocó). NestJS: `GrpcAuthGuard` (solo valida JWT) vs `GrpcRolesGuard` (solo valida rol) en `*/src/middleware/`. Python: `MetricsService` vs `ReportsService` (`app/metrics/service.py`, `app/reports/service.py`), cada una con un motivo de cambio distinto. |
| **O — Abierto/cerrado** | El Gateway agrega rutas nuevas sin modificar las existentes gracias a un helper genérico; los servidores gRPC extienden `Unimplemented*Server`, permitiendo agregar RPCs sin romper las ya implementadas. | `api-gateway/index.js`: `jsonIdRoute(method, path, client, rpcMethod, buildRequest, msg)` — agregar un endpoint de analítica nuevo es una línea, no toca las demás. Go: `ReproduccionServer` embebe `pb.UnimplementedReproduccionServiceServer`, así el contrato puede crecer (se agregaron `SaveCheckpoint`, `SaveRating`, `GetRatingStats`, `StartSession`, `RecordEvent` sin modificar `GetCheckpoint`/`GetVideoStats` existentes). |
| **L — Sustitución de Liskov** | Cualquier implementación de un guard (`CanActivate`) o de un servicio de base de datos es intercambiable sin romper al consumidor, porque el contrato (interfaz) es lo único de lo que dependen los controllers. | `GrpcAuthGuard`/`GrpcRolesGuard` implementan `CanActivate` de Nest igual que lo hacían sus equivalentes HTTP (`jwt.guard.ts` original) — los controllers los consumen vía `@UseGuards(...)` sin saber de la implementación concreta. `AuthDatabaseService`/`CatalogDatabaseService` exponen `query()`/`authQuery()` como contrato estable sobre `pg.Pool`, sustituible sin tocar los `*.service.ts` que los consumen. |
| **I — Segregación de interfaces** | Los contratos gRPC están divididos por dominio de negocio (no hay un único "GodService"), y los guards están separados en vez de un único guard monolítico que mezcle autenticación + autorización. | `/proto/auth.proto`, `catalog.proto`, `checkpoints.proto`, `analytics.proto` son 4 servicios gRPC independientes — un cliente que solo necesita `AuthService.Login` no depende de los métodos de catálogo o analítica. `JwtAuthGuard` vs `RolesGuard` (y sus versiones gRPC) son interfaces pequeñas y específicas en vez de un único guard "hace-todo". |
| **D — Inversión de dependencias** | Los módulos de negocio dependen de abstracciones (interfaces/servicios inyectados), no de implementaciones concretas de infraestructura (driver de BD, framework HTTP). La inyección de dependencias de NestJS y los constructores explícitos en Go materializan esto. | `auth-service/src/common/database.service.ts` y `analytics-service/app/database.py` están comentados explícitamente como "Principio D: los módulos dependen de esta abstracción". Go: `checkpoints.NewService(repo *Repository)` recibe el repositorio por constructor (inyección manual) — el `ReproduccionServer` (capa gRPC) depende de `*checkpoints.Service`, no de MongoDB directamente. |

---

## 3. Requisitos y restricciones — estado de cumplimiento

| Requisito | Estado |
|---|---|
| Registro/login restringido a `@ingenieria.usac.edu.gt` / `@ing.usac.edu.gt` |  Validado por regex en `auth.service.ts`, verificado con correos reales y personales (gmail rechazado con 400). |
| JWT + Session Cookie `HttpOnly`+`Secure` |  JWT firmado en auth-service; cookie seteada por el Gateway. |
| Catálogo + reproductor con checkpoint |  `catalog-service` (catálogo) + `reproduction-service` (checkpoint, ratings, sesiones de reproducción). |
| BDs independientes con procedimientos/vistas/funciones/triggers |  `DB/auth_db.sql`, `DB/catalog_db.sql`, `DB/analytics_mysql.sql` (Postgres/MySQL) + `DB/reproduction_mongodb.js` (validadores + índices, MongoDB). |
| Backend poliglota (Go, TypeScript, Python) |  reproduction-service (Go), auth/catalog-service (TypeScript/NestJS), analytics-service (Python/FastAPI). |
| **Tráfico interno estrictamente gRPC (prohibido REST entre microservicios)** |  Migrado completo — ver sección 1. Antes solo analytics↔reproduction era gRPC real; el Gateway proxyaba REST a los 4 servicios. |
| Punto de entrada único (Gateway) |  El cliente web solo conoce la URL del Gateway; los microservicios no exponen REST de negocio (solo `/health`). |
| Código limpio (SOLID) |  Ver matriz arriba. |
| Prohibición de BaaS / ORMs abstractos |  Sin Supabase/Firebase/Prisma. SQLAlchemy en analytics-service se usa mayormente como *query builder* con SQL crudo (`text(...)`) para invocar SPs/vistas/funciones explícitamente — con dos excepciones de `db.query(Modelo)` para lecturas simples, señaladas como punto de atención. |
| Orquestación local con un solo comando |  `docker-compose.local.yml` — `docker compose -f docker-compose.local.yml up -d --build`. |

---

## 4. Pendiente / trabajo futuro

- Los dos usos de `db.query(ORM)` en `analytics-service/app/metrics/service.py` podrían convertirse a `text()` crudo para eliminar cualquier ambigüedad frente a la prohibición de ORMs abstractos.
- `GetUserProgress` (reproduction-service) requiere que quien llama resuelva primero la lista de `video_ids` de un curso (no hay endpoint que combine catálogo+progreso en un solo viaje); es una composición pendiente para una futura iteración.