// ============================================================
// YoUSAC - Reproducción/Checkpoints Service
// Base de datos: MongoDB 7
// Microservicio: Go (Gin)
// Archivo: Schema + Validadores + Índices + Triggers (Change Streams)
// ============================================================

// Seleccionar la base de datos correcta (requerido cuando se usa MONGO_INITDB_ROOT_USERNAME)
db = db.getSiblingDB('yousac_reproduction_db');

// ── COLECCIÓN: checkpoints ───────────────────────────────────
db.createCollection("checkpoints", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "video_id", "position_seconds", "progress_percent", "updated_at"],
      properties: {
        user_id: {
          bsonType: "int",
          description: "ID del usuario (referencia a PostgreSQL)"
        },
        video_id: {
          bsonType: "int",
          description: "ID de la grabación (referencia a PostgreSQL)"
        },
        position_seconds: {
          bsonType: "int",
          minimum: 0,
          description: "Posición de reproducción en segundos"
        },
        progress_percent: {
          bsonType: "double",
          minimum: 0,
          maximum: 100,
          description: "Porcentaje de avance sobre la duración total"
        },
        completed: {
          bsonType: "bool",
          description: "Indica si el usuario finalizó la grabación"
        },
        updated_at: {
          bsonType: "date",
          description: "Última actualización del checkpoint"
        },
        created_at: {
          bsonType: "date",
          description: "Fecha de creación del primer checkpoint"
        }
      }
    }
  }
});

// ── COLECCIÓN: playback_sessions ────────────────────────────
db.createCollection("playback_sessions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "video_id", "started_at"],
      properties: {
        user_id: {
          bsonType: "int",
          description: "ID del usuario"
        },
        video_id: {
          bsonType: "int",
          description: "ID de la grabación"
        },
        started_at: {
          bsonType: "date",
          description: "Inicio de la sesión de reproducción"
        },
        ended_at: {
          bsonType: "date",
          description: "Fin de la sesión de reproducción"
        },
        events: {
          bsonType: "array",
          description: "Eventos de reproducción registrados",
          items: {
            bsonType: "object",
            required: ["type", "position_seconds", "timestamp"],
            properties: {
              type: {
                bsonType: "string",
                enum: ["play", "pause", "resume", "seek", "complete"],
                description: "Tipo de evento"
              },
              position_seconds: {
                bsonType: "int",
                description: "Posición en el momento del evento"
              },
              timestamp: {
                bsonType: "date",
                description: "Momento del evento"
              }
            }
          }
        },
        resolution: {
          bsonType: "string",
          enum: ["720p", "1080p"],
          description: "Resolución seleccionada por el usuario"
        }
      }
    }
  }
});

// ── COLECCIÓN: ratings ───────────────────────────────────────
db.createCollection("ratings", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "video_id", "stars", "created_at"],
      properties: {
        user_id: {
          bsonType: "int",
          description: "ID del usuario que califica"
        },
        video_id: {
          bsonType: "int",
          description: "ID de la grabación calificada"
        },
        stars: {
          bsonType: "int",
          minimum: 1,
          maximum: 5,
          description: "Calificación de 1 a 5 estrellas"
        },
        comment: {
          bsonType: "string",
          maxLength: 1000,
          description: "Reseña opcional del usuario"
        },
        created_at: {
          bsonType: "date",
          description: "Fecha de la calificación"
        },
        updated_at: {
          bsonType: "date",
          description: "Última modificación de la calificación"
        }
      }
    }
  }
});

// ── COLECCIÓN: video_stats ───────────────────────────────────
// Colección de agregación para estadísticas rápidas por video
db.createCollection("video_stats", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["video_id", "total_views", "average_progress", "recommendation_percent"],
      properties: {
        video_id: {
          bsonType: "int",
          description: "ID de la grabación"
        },
        total_views: {
          bsonType: "int",
          minimum: 0,
          description: "Total de reproducciones únicas"
        },
        total_ratings: {
          bsonType: "int",
          minimum: 0,
          description: "Total de calificaciones recibidas"
        },
        average_stars: {
          bsonType: "double",
          minimum: 0,
          maximum: 5,
          description: "Promedio de estrellas"
        },
        average_progress: {
          bsonType: "double",
          minimum: 0,
          maximum: 100,
          description: "Promedio de avance entre todos los usuarios"
        },
        recommendation_percent: {
          bsonType: "double",
          minimum: 0,
          maximum: 100,
          description: "Porcentaje de recomendación calculado"
        },
        last_updated: {
          bsonType: "date",
          description: "Última vez que se recalcularon las estadísticas"
        }
      }
    }
  }
});

// ── ÍNDICES ──────────────────────────────────────────────────

// checkpoints: búsqueda por usuario + video (único por par)
db.checkpoints.createIndex(
  { user_id: 1, video_id: 1 },
  { unique: true, name: "idx_checkpoint_user_video" }
);

// checkpoints: búsqueda por video para estadísticas
db.checkpoints.createIndex(
  { video_id: 1 },
  { name: "idx_checkpoint_video" }
);

// playback_sessions: búsqueda por usuario
db.playback_sessions.createIndex(
  { user_id: 1, started_at: -1 },
  { name: "idx_session_user_date" }
);

// playback_sessions: TTL de 90 días para limpiar sesiones antiguas
db.playback_sessions.createIndex(
  { started_at: 1 },
  { expireAfterSeconds: 7776000, name: "idx_session_ttl" }
);

// ratings: único por usuario + video
db.ratings.createIndex(
  { user_id: 1, video_id: 1 },
  { unique: true, name: "idx_rating_user_video" }
);

// ratings: búsqueda por video para calcular promedio
db.ratings.createIndex(
  { video_id: 1 },
  { name: "idx_rating_video" }
);

// video_stats: búsqueda directa por video
db.video_stats.createIndex(
  { video_id: 1 },
  { unique: true, name: "idx_stats_video" }
);

// ── FUNCIONES DE AGREGACIÓN (equivalente a Stored Procedures) ─

// Función: calcular estadísticas de un video
// Se ejecuta como pipeline de agregación desde el servicio Go
const pipeline_video_stats = (video_id) => [
  { $match: { video_id: video_id } },
  {
    $group: {
      _id: "$video_id",
      total_ratings:        { $sum: 1 },
      average_stars:        { $avg: "$stars" },
      recommendation_percent: { $avg: { $multiply: ["$stars", 20] } }
    }
  }
];

// Función: obtener progreso de un usuario en un curso
// Recibe lista de video_ids del curso y calcula progreso global
const pipeline_user_course_progress = (user_id, video_ids) => [
  {
    $match: {
      user_id: user_id,
      video_id: { $in: video_ids }
    }
  },
  {
    $group: {
      _id: "$user_id",
      overall_progress: { $avg: "$progress_percent" },
      completed_count:  { $sum: { $cond: ["$completed", 1, 0] } },
      total_videos:     { $sum: 1 }
    }
  }
];

// ── CHANGE STREAM (equivalente a Triggers) ───────────────────
// En Go, el servicio escucha cambios en la colección ratings
// para recalcular recommendation_percent en video_stats

/*
  // Implementación en Go (referencia):

  changeStream, err := ratingsCollection.Watch(ctx, mongo.Pipeline{
    bson.D{{Key: "$match", Value: bson.D{
      {Key: "operationType", Value: bson.D{{Key: "$in", Value: bson.A{"insert", "update"}}}},
    }}},
  })

  for changeStream.Next(ctx) {
    var event bson.M
    changeStream.Decode(&event)
    videoID := event["fullDocument"].(bson.M)["video_id"]

    // Recalcular y actualizar video_stats
    recalculateVideoStats(ctx, videoID)
  }
*/

// ── DATOS INICIALES ──────────────────────────────────────────

db.video_stats.insertMany([
  {
    video_id: 1,
    total_views: 0,
    total_ratings: 0,
    average_stars: 0.0,
    average_progress: 0.0,
    recommendation_percent: 0.0,
    last_updated: new Date()
  }
]);

