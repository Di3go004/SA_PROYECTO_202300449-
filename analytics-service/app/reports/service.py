# app/reports/service.py
# Principio S: solo lógica de reportes y estadísticas agregadas
from sqlalchemy.orm import Session
from sqlalchemy import text

class ReportsService:
    def __init__(self, db: Session):
        self.db = db

    def get_top_videos(self, limit: int = 10):
        """Usa la vista vw_top_videos de analytics_mysql.sql"""
        result = self.db.execute(
            text("SELECT * FROM vw_top_videos LIMIT :limit"),
            {"limit": limit}
        ).fetchall()
        return [dict(row._mapping) for row in result]

    def get_system_stats(self):
        """Usa la vista vw_system_stats de analytics_mysql.sql"""
        result = self.db.execute(
            text("SELECT * FROM vw_system_stats")
        ).fetchone()
        return dict(result._mapping) if result else {}

    def get_teacher_performance(self, teacher_id: int):
        """Usa la vista vw_teacher_performance de analytics_mysql.sql"""
        result = self.db.execute(
            text("SELECT * FROM vw_teacher_performance WHERE teacher_id = :id"),
            {"id": teacher_id}
        ).fetchone()
        return dict(result._mapping) if result else None

    def get_course_progress(self, course_id: int):
        """Usa la vista vw_course_student_progress de analytics_mysql.sql"""
        result = self.db.execute(
            text("SELECT * FROM vw_course_student_progress WHERE course_id = :id"),
            {"id": course_id}
        ).fetchone()
        return dict(result._mapping) if result else None

    def get_video_engagement(self, video_id: int):
        """
        Usa la función fn_engagement_level de analytics_mysql.sql
        combinada con fn_stars_to_recommendation (RF-024)
        """
        result = self.db.execute(text("""
            SELECT
                vm.video_id,
                vm.completion_rate,
                vm.recommendation_percent,
                fn_engagement_level(vm.completion_rate, vm.recommendation_percent) AS engagement_level,
                fn_stars_to_recommendation(vm.average_stars) AS stars_to_pct
            FROM video_metrics vm
            WHERE vm.video_id = :video_id
        """), {"video_id": video_id}).fetchone()
        return dict(result._mapping) if result else None

    def recalculate_teacher_stats(self, teacher_id: int):
        """Llama al SP sp_recalculate_teacher_stats de analytics_mysql.sql"""
        self.db.execute(
            text("CALL sp_recalculate_teacher_stats(:teacher_id)"),
            {"teacher_id": teacher_id}
        )
        self.db.commit()

    def recalculate_course_metrics(self, course_id: int):
        """Llama al SP sp_recalculate_course_metrics de analytics_mysql.sql"""
        self.db.execute(
            text("CALL sp_recalculate_course_metrics(:course_id)"),
            {"course_id": course_id}
        )
        self.db.commit()
