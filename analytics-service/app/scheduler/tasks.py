# app/scheduler/tasks.py
# Tarea periódica que sincroniza métricas desde el servicio de Reproducción via gRPC
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.metrics.service import MetricsService
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
    scheduler.start()
    print("✅ Scheduler iniciado - sincronización cada 5 minutos")
