# app/mailer/service.py
# Envío SMTP.
#
# La configuración es la misma para desarrollo y para producción; solo cambian las
# variables de entorno. En local apunta a Mailpit (un SMTP de pruebas con bandeja
# web, sin credenciales ni TLS) y en la nube a Gmail con contraseña de aplicación.
# Por eso TLS y autenticación son opcionales en vez de estar codificados.
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr


class MailerService:
    """Principio S: solo habla SMTP. No sabe de plantillas ni de persistencia."""

    def __init__(self) -> None:
        self.host = os.getenv("SMTP_HOST", "mailpit")
        self.port = int(os.getenv("SMTP_PORT", "1025"))
        self.user = os.getenv("SMTP_USER", "")
        self.password = os.getenv("SMTP_PASSWORD", "")
        self.use_tls = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
        self.from_email = os.getenv("SMTP_FROM", "no-reply@ingenieria.usac.edu.gt")
        self.from_name = os.getenv("SMTP_FROM_NAME", "YoUSAC")
        self.timeout = int(os.getenv("SMTP_TIMEOUT", "15"))

    def describe(self) -> dict:
        """Configuración activa, sin exponer la contraseña."""
        return {
            "host": self.host,
            "port": self.port,
            "tls": self.use_tls,
            "autenticado": bool(self.user),
            "remitente": self.from_email,
        }

    def send(self, to: str, subject: str, html_body: str) -> None:
        """
        Envía un correo. Propaga la excepción si falla: quien llama decide si
        reintenta o lo marca como fallido, que es información que este módulo no
        tiene por qué conocer.
        """
        mensaje = EmailMessage()
        mensaje["From"] = formataddr((self.from_name, self.from_email))
        mensaje["To"] = to
        mensaje["Subject"] = subject

        # Alternativa en texto plano para clientes que no renderizan HTML. Es
        # rudimentaria a propósito: el contenido real va en la parte HTML.
        mensaje.set_content(
            "Este mensaje requiere un cliente de correo con soporte HTML.\n"
            "Ingresá a YoUSAC para ver el contenido."
        )
        mensaje.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as smtp:
            if self.use_tls:
                smtp.starttls(context=ssl.create_default_context())
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(mensaje)
