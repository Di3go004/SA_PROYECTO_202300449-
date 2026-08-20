# app/mailer/templates.py
# Plantillas HTML de los correos institucionales.
#
# Se arman como cadenas y no con un motor de plantillas: son tres correos con
# estructura fija, y sumar Jinja2 traería una dependencia y un directorio de
# plantillas para algo que resuelve un f-string.
#
# La paleta reproduce la del frontend (navy #06007c sobre superficie clara) para
# que el correo se lea como parte del mismo producto.

from html import escape

_BASE = """\
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ecf6;font-family:Inter,'Segoe UI',Roboto,sans-serif;color:#1b1b22;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ecf6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid #c7c5d4;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#06007c;padding:20px 24px;">
            <span style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:999px;
                         background:#ffffff;color:#06007c;font-weight:700;text-align:center;font-size:13px;">Yo</span>
            <span style="color:#ffffff;font-size:16px;font-weight:600;margin-left:8px;vertical-align:middle;">YoUSAC</span>
          </td>
        </tr>
        <tr><td style="padding:24px;">{contenido}</td></tr>
        <tr>
          <td style="padding:16px 24px;background:#f5f2fc;border-top:1px solid #c7c5d4;">
            <p style="margin:0;font-size:12px;color:#464652;line-height:18px;">
              Plataforma de video académico · Facultad de Ingeniería · USAC<br>
              Este es un mensaje automático, no respondas a este correo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

_H1 = "margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:-.02em;color:#1b1b22;"
_P = "margin:0 0 12px;font-size:14px;line-height:21px;color:#464652;"
_BTN = ("display:inline-block;padding:10px 20px;background:#06007c;color:#ffffff;"
        "text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;")
_CARD = ("margin:16px 0;padding:14px;background:#f5f2fc;border-left:3px solid #196584;"
         "border-radius:4px;font-size:14px;color:#1b1b22;")


def bienvenida(full_name: str, role: str, app_url: str) -> tuple[str, str]:
    """Confirmación de registro. Devuelve (asunto, cuerpo_html)."""
    nombre = escape(full_name or "estudiante")
    rol = escape(role or "estudiante")

    contenido = f"""
      <h1 style="{_H1}">Tu cuenta está lista, {nombre}</h1>
      <p style="{_P}">
        Tu registro en <strong>YoUSAC</strong> se completó correctamente. Ya podés
        acceder al acervo de clases grabadas de la Facultad de Ingeniería.
      </p>
      <div style="{_CARD}">
        <strong>Rol asignado:</strong> {rol}
      </div>
      <p style="{_P}">
        Si tu rol no es el que esperabas, un administrador puede ajustarlo desde el
        panel de gestión.
      </p>
      <p style="margin:20px 0 0;">
        <a href="{escape(app_url)}" style="{_BTN}">Entrar a la plataforma</a>
      </p>
    """
    return "Bienvenido a YoUSAC — tu cuenta está activa", _BASE.format(contenido=contenido)


def nueva_grabacion(title: str, course_name: str, course_code: str,
                    teacher_name: str, app_url: str, recording_id: int) -> tuple[str, str]:
    """Aviso de nueva clase publicada en un curso donde el destinatario está inscrito."""
    titulo = escape(title or "Nueva clase")
    curso = escape(course_name or "")
    codigo = escape(course_code or "")
    docente = escape(teacher_name or "")

    contenido = f"""
      <h1 style="{_H1}">Nueva clase disponible</h1>
      <p style="{_P}">
        Se publicó una grabación en un curso en el que estás inscrito.
      </p>
      <div style="{_CARD}">
        <strong style="font-size:15px;">{titulo}</strong><br>
        <span style="color:#464652;font-size:13px;">
          {curso}{f' · {codigo}' if codigo else ''}<br>
          {f'Impartida por {docente}' if docente else ''}
        </span>
      </div>
      <p style="margin:20px 0 0;">
        <a href="{escape(app_url)}/player/{recording_id}" style="{_BTN}">Ver la clase</a>
      </p>
    """
    return f"Nueva clase en {curso}: {titulo}", _BASE.format(contenido=contenido)


def aviso_sistema(subject: str, body: str) -> tuple[str, str]:
    """Aviso genérico del sistema."""
    asunto = escape(subject or "Aviso del sistema")
    # Se respetan los saltos de línea del texto plano recibido.
    cuerpo = "".join(
        f'<p style="{_P}">{escape(linea)}</p>'
        for linea in (body or "").split("\n") if linea.strip()
    )

    contenido = f"""
      <h1 style="{_H1}">{asunto}</h1>
      {cuerpo}
    """
    return f"YoUSAC — {asunto}", _BASE.format(contenido=contenido)
