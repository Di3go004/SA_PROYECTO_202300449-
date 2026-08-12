# app/metrics/service.py
# Principio S: solo lógica de negocio de métricas
# Principio O: abierto para extensión via nuevos métodos de sincronización
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import VideoMetrics, CourseMetrics, TeacherStats, StudentProgress, SyncLog
from app.grpc.client import get_video_stats, get_user_course_progress

class MetricsService:
    def __init__(self, db: Session):
        self.db = db

    def get_video_metrics(self, video_id: int):
        """Obtiene métricas de un video desde MySQL"""
        return self.db.query(VideoMetrics).filter(
            VideoMetrics.video_id == video_id
        ).first()

    def get_course_metrics(self, course_id: int):
        """Obtiene métricas de un curso usando la vista vw_course_student_progress"""
        result = self.db.execute(
            text("SELECT * FROM vw_course_student_progress WHERE course_id = :id"),
            {"id": course_id}
        ).fetchone()
        return dict(result._mapping) if result else None

    def get_teacher_stats(self, teacher_id: int):
        """Obtiene estadísticas de un docente usando la vista vw_teacher_performance"""
        result = self.db.execute(
            text("SELECT * FROM vw_teacher_performance WHERE teacher_id = :id"),
            {"id": teacher_id}
        ).fetchone()
        return dict(result._mapping) if result else None

    def get_student_progress(self, student_id: int, course_id: int):
        """
        Obtiene progreso de estudiante:
        1. Primero busca en MySQL (cache local)
        2. Si no existe, consulta via gRPC al servicio de Reproducción
        """
        local = self.db.query(StudentProgress).filter(
            StudentProgress.student_id == student_id,
            StudentProgress.course_id  == course_id
        ).first()

        if local:
            return local

        # Fallback: consultar via gRPC (RNF-013)
        grpc_data = get_user_course_progress(student_id, course_id)
        if grpc_data:
            self._sync_student_progress(
                student_id=student_id,
                course_id=course_id,
                videos_watched=len(grpc_data.get("videos", [])),
                videos_completed=sum(1 for v in grpc_data.get("videos", []) if v["completed"]),
                overall_progress=grpc_data.get("overall_progress", 0),
            )
        return grpc_data

    def sync_video_from_grpc(self, video_id: int, course_id: int = 0, teacher_id: int = 0):
        """
        Sincroniza métricas de un video desde Reproducción via gRPC.
        Usa el SP sp_sync_video_metrics de analytics_mysql.sql (RF-024)
        """
        stats = get_video_stats(video_id)
        if not stats:
            self._log_sync("video", video_id, "error", "No se pudo obtener stats via gRPC")
            return None

        try:
            # Llamada al Stored Procedure de MySQL (Persistencia con objetos programables)
            self.db.execute(text("""
                CALL sp_sync_video_metrics(
                    :video_id, :course_id, :teacher_id,
                    :total_views, :unique_viewers, :total_ratings,
                    :average_stars, :recommendation_percent,
                    :average_progress, :completion_rate
                )
            """), {
                "video_id":               video_id,
                "course_id":              course_id,
                "teacher_id":             teacher_id,
                "total_views":            stats.get("total_views", 0),
                "unique_viewers":         stats.get("total_views", 0),
                "total_ratings":          stats.get("total_views", 0),
                "average_stars":          stats.get("average_progress", 0),
                "recommendation_percent": stats.get("recommendation_percent", 0),
                "average_progress":       stats.get("average_progress", 0),
                "completion_rate":        0,
            })
            self.db.commit()
            self._log_sync("video", video_id, "success")
            return stats
        except Exception as e:
            self.db.rollback()
            self._log_sync("video", video_id, "error", str(e))
            return None

    def _sync_student_progress(
        self, student_id: int, course_id: int,
        videos_watched: int, videos_completed: int, overall_progress: float
    ):
        """Llama al SP sp_sync_student_progress de analytics_mysql.sql"""
        try:
            self.db.execute(text("""
                CALL sp_sync_student_progress(
                    :student_id, :course_id,
                    :videos_watched, :videos_completed, :overall_progress
                )
            """), {
                "student_id":       student_id,
                "course_id":        course_id,
                "videos_watched":   videos_watched,
                "videos_completed": videos_completed,
                "overall_progress": overall_progress,
            })
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"❌ Error sincronizando progreso estudiante: {e}")

    def _log_sync(self, entity_type: str, entity_id: int, status: str, error_msg: str = None):
        """Registra resultado de sincronización en sync_logs"""
        log = SyncLog(
            entity_type=entity_type,
            entity_id=entity_id,
            status=status,
            error_msg=error_msg
        )
        self.db.add(log)
        self.db.commit()
