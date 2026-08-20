# app/grpc/server.py
# Superficie gRPC del microservicio de Notificaciones.
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from decimal import Decimal

import grpc

from app.grpc import notifications_pb2, notifications_pb2_grpc
from app.notifications.service import NotificationService

logger = logging.getLogger(__name__)


def _json_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Tipo no serializable: {type(obj)}")


def _json(payload) -> notifications_pb2.JsonResponse:
    return notifications_pb2.JsonResponse(json=json.dumps(payload, default=_json_default))


class NotificationServicer(notifications_pb2_grpc.NotificationServiceServicer):
    def __init__(self) -> None:
        self.service = NotificationService()

    def _response(self, resultado: dict) -> notifications_pb2.SendResponse:
        return notifications_pb2.SendResponse(
            queued=resultado["queued"],
            notification_id=resultado["notification_id"],
            message=resultado["message"],
        )

    def SendWelcomeEmail(self, request, context):
        try:
            return self._response(
                self.service.send_welcome(request.email, request.full_name, request.role)
            )
        except Exception as exc:
            # INVALID_ARGUMENT y no INTERNAL: el motivo habitual es un correo no
            # institucional, que el SP rechaza y es un error del llamador.
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exc))

    def SendNewRecordingAlert(self, request, context):
        try:
            return self._response(self.service.send_new_recording(
                request.recording_id, request.title, request.course_name,
                request.course_code, request.teacher_name, list(request.recipients),
            ))
        except Exception as exc:
            context.abort(grpc.StatusCode.INTERNAL, str(exc))

    def SendSystemNotice(self, request, context):
        try:
            return self._response(self.service.send_system_notice(
                list(request.recipients), request.subject, request.body,
            ))
        except Exception as exc:
            context.abort(grpc.StatusCode.INTERNAL, str(exc))

    def ListNotifications(self, request, context):
        try:
            return _json(self.service.list_notifications(
                request.limit or 50, request.status or None,
            ))
        except Exception as exc:
            context.abort(grpc.StatusCode.INTERNAL, str(exc))

    def GetNotificationStats(self, request, context):
        try:
            return _json(self.service.get_stats())
        except Exception as exc:
            context.abort(grpc.StatusCode.INTERNAL, str(exc))


def serve(port: str) -> grpc.Server:
    server = grpc.server(ThreadPoolExecutor(max_workers=10))
    notifications_pb2_grpc.add_NotificationServiceServicer_to_server(
        NotificationServicer(), server,
    )
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info(f"gRPC server (NotificationService) corriendo en puerto {port}")
    return server
