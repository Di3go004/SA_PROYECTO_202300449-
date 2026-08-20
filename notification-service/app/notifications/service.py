# app/notifications/service.py
# Orquesta el ciclo de vida de una notificación: encolar → enviar → registrar.
#
# El envío corre en un hilo aparte porque quien invoca (auth-service tras un
# registro, catalog-service tras publicar una grabación) no debe quedar esperando
# a un servidor SMTP. Un correo lento no puede hacer lento un registro, y un SMTP
# caído no puede hacer fallar la publicación de una clase.
import os
import threading

from app.database import db
from app.mailer.service import MailerService
from app.mailer import templates


class NotificationService:
    def __init__(self) -> None:
        self.mailer = MailerService()
        self.app_url = os.getenv("APP_PUBLIC_URL", "http://localhost:5173")

    # ── Encolado ─────────────────────────────────────────────────────────────

    def _queue(self, recipient: str, subject: str, template: str,
               preview: str = "", related_type: str = None,
               related_id: int = None) -> int:
        """Registra la notificación vía SP y devuelve su id."""
        with db.cursor(commit=True) as cur:
            cur.execute(
                "CALL sp_queue_notification(%s, %s, %s, %s, %s, %s, NULL)",
                (recipient, subject, template, preview[:500], related_type, related_id),
            )
            fila = cur.fetchone()
            return fila["p_id"]

    def _mark_sent(self, notification_id: int) -> None:
        with db.cursor(commit=True) as cur:
            cur.execute("CALL sp_mark_notification_sent(%s)", (notification_id,))

    def _mark_failed(self, notification_id: int, error: str) -> None:
        with db.cursor(commit=True) as cur:
            cur.execute("CALL sp_mark_notification_failed(%s, %s)", (notification_id, str(error)[:1000]))

    # ── Envío ────────────────────────────────────────────────────────────────

    def _deliver(self, notification_id: int, to: str, subject: str, html: str) -> None:
        """Se ejecuta en un hilo: entrega el correo y actualiza el estado."""
        try:
            self.mailer.send(to, subject, html)
            self._mark_sent(notification_id)
            print(f"✅ Notificación {notification_id} entregada a {to}")
        except Exception as exc:
            self._mark_failed(notification_id, exc)
            print(f"❌ Notificación {notification_id} falló para {to}: {exc}")

    def _send_async(self, notification_id: int, to: str, subject: str, html: str) -> None:
        threading.Thread(
            target=self._deliver,
            args=(notification_id, to, subject, html),
            daemon=True,
        ).start()

    # ── Casos de uso ─────────────────────────────────────────────────────────

    def send_welcome(self, email: str, full_name: str, role: str) -> dict:
        subject, html = templates.bienvenida(full_name, role, self.app_url)
        notification_id = self._queue(
            email, subject, "bienvenida",
            preview=f"Cuenta creada con rol {role}",
            related_type="usuario",
        )
        self._send_async(notification_id, email, subject, html)
        return {"queued": True, "notification_id": notification_id,
                "message": "Correo de bienvenida encolado"}

    def send_new_recording(self, recording_id: int, title: str, course_name: str,
                           course_code: str, teacher_name: str,
                           recipients: list[str]) -> dict:
        """
        Un correo por destinatario, cada uno con su propia fila en la bitácora.
        Mandarlo en copia oculta sería más barato, pero impediría saber a quién
        llegó y a quién no, que es justamente lo que la bitácora debe responder.
        """
        subject, html = templates.nueva_grabacion(
            title, course_name, course_code, teacher_name, self.app_url, recording_id,
        )

        encolados, rechazados = [], []
        for email in recipients:
            try:
                notification_id = self._queue(
                    email, subject, "nueva_grabacion",
                    preview=f"{course_name}: {title}",
                    related_type="grabacion", related_id=recording_id,
                )
                self._send_async(notification_id, email, subject, html)
                encolados.append(notification_id)
            except Exception as exc:
                # Un destinatario inválido no debe cancelar los demás avisos.
                print(f"⚠️  No se encoló para {email}: {exc}")
                rechazados.append(email)

        return {
            "queued": len(encolados) > 0,
            "notification_id": encolados[0] if encolados else 0,
            "message": f"{len(encolados)} aviso(s) encolado(s)"
                       + (f", {len(rechazados)} rechazado(s)" if rechazados else ""),
        }

    def send_system_notice(self, recipients: list[str], subject_text: str,
                           body: str) -> dict:
        subject, html = templates.aviso_sistema(subject_text, body)

        encolados = []
        for email in recipients:
            try:
                notification_id = self._queue(
                    email, subject, "aviso_sistema", preview=body,
                    related_type="sistema",
                )
                self._send_async(notification_id, email, subject, html)
                encolados.append(notification_id)
            except Exception as exc:
                print(f"⚠️  No se encoló para {email}: {exc}")

        return {"queued": len(encolados) > 0,
                "notification_id": encolados[0] if encolados else 0,
                "message": f"{len(encolados)} aviso(s) encolado(s)"}

    # ── Consulta ─────────────────────────────────────────────────────────────

    def list_notifications(self, limit: int = 50, status: str = None) -> list:
        with db.cursor() as cur:
            if status:
                cur.execute(
                    "SELECT * FROM vw_notifications_log WHERE status = %s LIMIT %s",
                    (status, limit),
                )
            else:
                cur.execute("SELECT * FROM vw_notifications_log LIMIT %s", (limit,))
            return [dict(f) for f in cur.fetchall()]

    def get_stats(self) -> dict:
        with db.cursor() as cur:
            cur.execute("SELECT * FROM vw_notification_stats")
            stats = dict(cur.fetchone() or {})
        stats["smtp"] = self.mailer.describe()
        return stats
