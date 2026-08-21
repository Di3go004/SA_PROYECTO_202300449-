# app/scheduler/tasks.py
# Tarea periódica que sincroniza métricas desde el servicio de Reproducción via gRPC
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.metrics.service import MetricsService
from app.trends.service import TrendsService
from sqlalchemy import text

scheduler = BackgroundScheduler()

def sync_all_video_metrics():
    """
    Tarea que corre cada 5 minutos:
    Obtiene todos los video_ids conocidos y sincroniza sus métricas via gRPC
    """
    db = SessionLocal()
    try:
        service = MetricsService(db)

        # Obtener todos los video_ids que ya existen en MySQL
        result = db.execute(text("SELECT DISTINCT video_id FROM video_metrics")).fetchall()
        video_ids = [row[0] for row in result]

        for video_id in video_ids:
            service.sync_video_from_grpc(video_id)

        print(f"✅ Sincronización completada: {len(video_ids)} videos actualizados")
    except Exception as e:
        print(f"❌ Error en sincronización periódica: {e}")
    finally:
        db.close()

def snapshot_weekly_trends():
    """
    Toma la instantánea semanal de visualizaciones e invalida los rankings en caché.

    Corre cada 15 minutos y no una vez por semana: el SP es idempotente y
    actualiza la fila de la semana en curso, así el ranking de tendencias refleja
    el movimiento del día en vez de congelarse hasta el lunes siguiente.
    """
    db = SessionLocal()
    try:
        resultado = TrendsService(db).snapshot_weekly_views()
        print(f"✅ Instantánea semanal tomada · {resultado['claves_invalidadas']} claves invalidadas")
    except Exception as e:
        print(f"❌ Error al tomar la instantánea semanal: {e}")
    finally:
        db.close()


def start_scheduler():
    """Inicia el scheduler con las tareas periódicas"""
    # Sincronizar métricas cada 5 minutos
    scheduler.add_job(
        sync_all_video_metrics,
        trigger="interval",
        minutes=5,
        id="sync_video_metrics",
        replace_existing=True
    )
    # Actualizar la serie temporal que alimenta las tendencias
    scheduler.add_job(
        snapshot_weekly_trends,
        trigger="interval",
        minutes=15,
        id="snapshot_weekly_trends",
        replace_existing=True
    )
    scheduler.start()
    print("✅ Scheduler iniciado - métricas cada 5 min, tendencias cada 15 min")
