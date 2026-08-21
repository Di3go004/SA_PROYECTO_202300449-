# app/grpc/server.py
# Principio S: solo traduce gRPC↔dominio; toda la lógica de negocio (SQL/SPs/vistas/
# funciones) sigue viviendo en MetricsService/ReportsService, sin cambios.
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import grpc

from app.grpc import analytics_pb2, analytics_pb2_grpc
from app.database import SessionLocal
from app.metrics.service import MetricsService
from app.reports.service import ReportsService
from app.trends.service import TrendsService
from app.cache import cache

logger = logging.getLogger("analytics.grpc")


def _json_default(obj):
    """Los AVG()/SUM() de las vistas MySQL (reports/service.py, texto SQL crudo)
    vuelven como Decimal, que json.dumps no serializa. Antes esto caía en
    default=str y el frontend recibía "100.00" en vez de 100.0 — .toFixed()
    truena porque es texto, no número. Decimal→float sí preserva un JSON numérico
    real; el resto (fechas, etc.) sigue cayendo a str como antes."""
    if isinstance(obj, Decimal):
        return float(obj)
    return str(obj)


def _json(payload) -> analytics_pb2.JsonResponse:
    """Serializa cualquier resultado (dict, lista, None) a JsonResponse.json"""
    return analytics_pb2.JsonResponse(json=json.dumps(payload, default=_json_default))


class AnalyticsServicer(analytics_pb2_grpc.AnalyticsServiceServicer):
    """Cada RPC abre su propia sesión SQLAlchemy y la cierra al terminar,
    igual que app.database.get_db hace por request en el mundo FastAPI."""

    def _session(self):
        return SessionLocal()

    def GetVideoMetrics(self, request, context):
        db = self._session()
        try:
            metrics = MetricsService(db).get_video_metrics(request.id)
            if not metrics:
                context.abort(grpc.StatusCode.NOT_FOUND, "Métricas no encontradas para este video")
            return _json({
                "video_id": metrics.video_id,
                "course_id": metrics.course_id,
                "teacher_id": metrics.teacher_id,
                "total_views": metrics.total_views,
                "unique_viewers": metrics.unique_viewers,
                "total_ratings": metrics.total_ratings,
                "average_stars": metrics.average_stars,
                "recommendation_percent": metrics.recommendation_percent,
                "average_progress": metrics.average_progress,
                "completion_rate": metrics.completion_rate,
            })
        finally:
            db.close()

    def GetCourseMetrics(self, request, context):
        db = self._session()
        try:
            return _json(MetricsService(db).get_course_metrics(request.id))
        finally:
            db.close()

    def GetTeacherStats(self, request, context):
        db = self._session()
        try:
            return _json(MetricsService(db).get_teacher_stats(request.id))
        finally:
            db.close()

    def GetStudentProgress(self, request, context):
        db = self._session()
        try:
            result = MetricsService(db).get_student_progress(request.student_id, request.course_id)
            if result is None:
                context.abort(grpc.StatusCode.UNAVAILABLE, "Error al sincronizar con servicio de Reproducción")
            if hasattr(result, "__dict__"):
                result = {k: v for k, v in vars(result).items() if not k.startswith("_")}
            return _json(result)
        finally:
            db.close()

    def SyncVideoMetrics(self, request, context):
        db = self._session()
        try:
            result = MetricsService(db).sync_video_from_grpc(request.id)
            if not result:
                context.abort(grpc.StatusCode.UNAVAILABLE, "Error al sincronizar con servicio de Reproducción")
            return _json(result)
        finally:
            db.close()

    def GetTopVideos(self, request, context):
        db = self._session()
        try:
            limit = request.limit or 10
            return _json(ReportsService(db).get_top_videos(limit))
        finally:
            db.close()

    def GetSystemStats(self, request, context):
        db = self._session()
        try:
            return _json(ReportsService(db).get_system_stats())
        finally:
            db.close()

    def GetTeacherPerformance(self, request, context):
        db = self._session()
        try:
            return _json(ReportsService(db).get_teacher_performance(request.id))
        finally:
            db.close()

    def GetCourseProgress(self, request, context):
        db = self._session()
        try:
            return _json(ReportsService(db).get_course_progress(request.id))
        finally:
            db.close()

    def GetVideoEngagement(self, request, context):
        db = self._session()
        try:
            return _json(ReportsService(db).get_video_engagement(request.id))
        finally:
            db.close()

    # ── Tendencias servidas desde Redis ──────────────────────────────────────

    def _cached(self, resultado, ttl: int) -> analytics_pb2.CachedResponse:
        """TrendsService devuelve (datos, vino_de_cache); acá se arma la respuesta."""
        datos, from_cache = resultado
        return analytics_pb2.CachedResponse(
            json=json.dumps(datos, default=_json_default),
            from_cache=from_cache,
            ttl_seconds=ttl,
        )

    def GetWeeklyTopVideos(self, request, context):
        db = self._session()
        try:
            limit = request.limit or 10
            return self._cached(TrendsService(db).get_weekly_top_videos(limit), cache.TTL_TRENDS)
        finally:
            db.close()

    def GetTopRatedVideos(self, request, context):
        db = self._session()
        try:
            limit = request.limit or 10
            return self._cached(TrendsService(db).get_top_rated(limit), cache.TTL_TRENDS)
        finally:
            db.close()

    def GetTrendingCourses(self, request, context):
        db = self._session()
        try:
            limit = request.limit or 10
            return self._cached(TrendsService(db).get_trending_courses(limit), cache.TTL_TRENDS)
        finally:
            db.close()

    def SnapshotWeeklyViews(self, request, context):
        db = self._session()
        try:
            return _json(TrendsService(db).snapshot_weekly_views())
        except Exception as exc:
            context.abort(grpc.StatusCode.INTERNAL, f"Error al tomar la instantánea: {exc}")
        finally:
            db.close()

    def GetCacheStats(self, request, context):
        return _json(cache.stats())


def serve(port: str) -> grpc.Server:
    """Crea y arranca el servidor gRPC (llamado desde app.main en un thread aparte)."""
    server = grpc.server(ThreadPoolExecutor(max_workers=10))
    analytics_pb2_grpc.add_AnalyticsServiceServicer_to_server(AnalyticsServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info(f"gRPC server (AnalyticsService) corriendo en puerto {port}")
    return server
