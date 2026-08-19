# app/trends/service.py
# Tendencias académicas: qué se está viendo esta semana y qué está mejor valorado.
#
# Es el módulo que más se consulta y el que menos tolera golpear MySQL en cada
# petición (todos los estudiantes ven el mismo ranking), así que cada consulta
# pasa por la caché de Redis con un TTL acorde a lo rápido que cambia el dato.
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.cache import cache


class TrendsService:
    """Principio S: solo tendencias. Las métricas puntuales viven en ReportsService."""

    def __init__(self, db: Session):
        self.db = db

    # ── Clases más vistas de la semana ───────────────────────────────────────

    def get_weekly_top_videos(self, limit: int = 10) -> tuple[list, bool]:
        """
        Ranking de la semana en curso, sobre el delta de vistas y no el acumulado.

        Devuelve `(datos, vino_de_cache)`.
        """
        key = cache.key("trends", "weekly_top", limit)

        def consultar():
            filas = self.db.execute(
                text("SELECT * FROM vw_weekly_top_videos LIMIT :limit"),
                {"limit": limit},
            ).fetchall()
            return [dict(f._mapping) for f in filas]

        return cache.get_or_set(key, cache.TTL_TRENDS, consultar)

    # ── Ranking de mejor valoradas ───────────────────────────────────────────

    def get_top_rated(self, limit: int = 10) -> tuple[list, bool]:
        key = cache.key("trends", "top_rated", limit)

        def consultar():
            filas = self.db.execute(
                text("SELECT * FROM vw_top_rated_videos LIMIT :limit"),
                {"limit": limit},
            ).fetchall()
            return [dict(f._mapping) for f in filas]

        return cache.get_or_set(key, cache.TTL_TRENDS, consultar)

    # ── Cursos con más actividad ─────────────────────────────────────────────

    def get_trending_courses(self, limit: int = 10) -> tuple[list, bool]:
        """
        Agrupa el movimiento semanal por curso. En época de exámenes es la señal
        más útil: indica qué cursos están repasando los estudiantes ahora mismo.
        """
        key = cache.key("trends", "courses", limit)

        def consultar():
            filas = self.db.execute(
                text("""
                    SELECT
                        w.course_id,
                        SUM(w.views_delta)                       AS views_this_week,
                        COUNT(DISTINCT w.video_id)               AS videos_vistos,
                        ROUND(AVG(w.avg_stars), 2)               AS avg_stars,
                        ROUND(SUM(fn_trending_score(w.views_delta, w.avg_stars)), 2) AS trending_score
                      FROM weekly_video_views w
                     WHERE w.week_start = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
                     GROUP BY w.course_id
                     ORDER BY trending_score DESC
                     LIMIT :limit
                """),
                {"limit": limit},
            ).fetchall()
            return [dict(f._mapping) for f in filas]

        return cache.get_or_set(key, cache.TTL_TRENDS, consultar)

    # ── Mantenimiento ────────────────────────────────────────────────────────

    def snapshot_weekly_views(self) -> dict:
        """
        Ejecuta el SP que toma la instantánea semanal. Lo invoca el scheduler.

        Tras actualizar la serie temporal, invalida las tendencias en caché: si no,
        los rankings seguirían mostrando el corte anterior hasta que expire el TTL.
        """
        self.db.execute(text("CALL sp_snapshot_weekly_views()"))
        self.db.commit()

        invalidadas = cache.invalidate(cache.key("trends", "*"))
        return {"status": "ok", "claves_invalidadas": invalidadas}
