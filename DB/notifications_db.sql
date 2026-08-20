-- ============================================================
-- YoUSAC - Notification Service
-- Base de datos: yousac_notifications_db (PostgreSQL 16)
-- Microservicio: Python
-- Dominio: Envío y bitácora de correos institucionales
--
-- Base propia (patrón Database per Microservice). Comparte el motor con auth y
-- catalog, pero ningún servicio consulta las tablas de otro.
-- ============================================================

\connect yousac_notifications_db

-- ── TABLAS ──────────────────────────────────────────────────

CREATE TABLE notifications (
    id            SERIAL PRIMARY KEY,
    recipient     VARCHAR(255) NOT NULL,
    subject       VARCHAR(500) NOT NULL,
    body_preview  VARCHAR(500),
    template      VARCHAR(50)  NOT NULL,
    -- Referencias lógicas al recurso que originó el aviso (una grabación, un
    -- usuario). Sin FK: viven en otras bases.
    related_type  VARCHAR(50),
    related_id    INT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
    error_message TEXT,
    attempts      INT DEFAULT 0,
    created_at    TIMESTAMP DEFAULT NOW(),
    sent_at       TIMESTAMP,
    CONSTRAINT chk_notification_status
        CHECK (status IN ('pendiente', 'enviado', 'fallido')),
    CONSTRAINT chk_notification_template
        CHECK (template IN ('bienvenida', 'nueva_grabacion', 'aviso_sistema'))
);

-- Auditoría de cambios de estado. El enunciado pide triggers para auditoría;
-- acá registran cada transición del envío, que es lo que permite reconstruir
-- por qué un correo terminó fallido.
CREATE TABLE notification_audit (
    id              SERIAL PRIMARY KEY,
    notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    old_status      VARCHAR(20),
    new_status      VARCHAR(20) NOT NULL,
    detail          TEXT,
    changed_at      TIMESTAMP DEFAULT NOW()
);

-- ── ÍNDICES ─────────────────────────────────────────────────

CREATE INDEX idx_notifications_status    ON notifications(status);
CREATE INDEX idx_notifications_recipient ON notifications(recipient);
CREATE INDEX idx_notifications_created   ON notifications(created_at DESC);
CREATE INDEX idx_notifications_related   ON notifications(related_type, related_id);
CREATE INDEX idx_notif_audit_notif       ON notification_audit(notification_id);

-- ── FUNCIONES ───────────────────────────────────────────────

-- Función: validar que el destinatario sea institucional.
-- Misma regla que auth_db, replicada acá a propósito: este servicio no consulta
-- la base de auth, así que debe poder validar por su cuenta.
CREATE OR REPLACE FUNCTION fn_is_institutional_email(p_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_email ~* '^[a-zA-Z0-9._%+-]+@(ingenieria\.usac\.edu\.gt|ing\.usac\.edu\.gt)$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función: tasa de entrega, para el panel administrativo.
CREATE OR REPLACE FUNCTION fn_delivery_rate()
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_total   INT;
    v_enviados INT;
BEGIN
    SELECT COUNT(*) INTO v_total    FROM notifications;
    SELECT COUNT(*) INTO v_enviados FROM notifications WHERE status = 'enviado';

    IF v_total = 0 THEN
        RETURN 0.00;
    END IF;

    RETURN ROUND((v_enviados::DECIMAL / v_total) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- ── VISTAS ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_notifications_log AS
SELECT
    n.id,
    n.recipient,
    n.subject,
    n.template,
    n.status,
    n.attempts,
    n.error_message,
    n.created_at,
    n.sent_at,
    -- Cuánto tardó entre encolar y entregar.
    EXTRACT(EPOCH FROM (n.sent_at - n.created_at))::INT AS delivery_seconds
FROM notifications n
ORDER BY n.created_at DESC;

CREATE OR REPLACE VIEW vw_notification_stats AS
SELECT
    COUNT(*)                                          AS total,
    COUNT(*) FILTER (WHERE status = 'enviado')        AS enviados,
    COUNT(*) FILTER (WHERE status = 'fallido')        AS fallidos,
    COUNT(*) FILTER (WHERE status = 'pendiente')      AS pendientes,
    COUNT(DISTINCT recipient)                         AS destinatarios_unicos,
    fn_delivery_rate()                                AS tasa_entrega_pct,
    COUNT(*) FILTER (WHERE template = 'bienvenida')      AS bienvenidas,
    COUNT(*) FILTER (WHERE template = 'nueva_grabacion') AS avisos_grabacion,
    COUNT(*) FILTER (WHERE template = 'aviso_sistema')   AS avisos_sistema
FROM notifications;

-- ── STORED PROCEDURES ───────────────────────────────────────

-- SP: encolar una notificación.
-- Rechaza destinatarios no institucionales: el enunciado restringe la plataforma
-- al dominio de la Facultad, y eso incluye a quién se le puede escribir.
CREATE OR REPLACE PROCEDURE sp_queue_notification(
    p_recipient    VARCHAR,
    p_subject      VARCHAR,
    p_template     VARCHAR,
    p_body_preview VARCHAR DEFAULT NULL,
    p_related_type VARCHAR DEFAULT NULL,
    p_related_id   INT     DEFAULT NULL,
    INOUT p_id     INT     DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_recipient IS NULL OR btrim(p_recipient) = '' THEN
        RAISE EXCEPTION 'El destinatario es obligatorio';
    END IF;

    IF NOT fn_is_institutional_email(btrim(p_recipient)) THEN
        RAISE EXCEPTION 'Correo no institucional: %', p_recipient;
    END IF;

    IF p_subject IS NULL OR btrim(p_subject) = '' THEN
        RAISE EXCEPTION 'El asunto es obligatorio';
    END IF;

    INSERT INTO notifications (recipient, subject, template, body_preview,
                               related_type, related_id, status)
    VALUES (btrim(p_recipient), btrim(p_subject), p_template,
            LEFT(COALESCE(p_body_preview, ''), 500), p_related_type, p_related_id,
            'pendiente')
    RETURNING id INTO p_id;
END;
$$;

-- SP: marcar como entregada.
CREATE OR REPLACE PROCEDURE sp_mark_notification_sent(p_id INT)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE notifications
    SET status   = 'enviado',
        sent_at  = NOW(),
        attempts = attempts + 1,
        error_message = NULL
    WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La notificación % no existe', p_id;
    END IF;
END;
$$;

-- SP: marcar como fallida, conservando el motivo.
CREATE OR REPLACE PROCEDURE sp_mark_notification_failed(
    p_id    INT,
    p_error TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE notifications
    SET status        = 'fallido',
        attempts      = attempts + 1,
        error_message = p_error
    WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La notificación % no existe', p_id;
    END IF;
END;
$$;

-- ── TRIGGERS ────────────────────────────────────────────────

-- Trigger: auditar cada cambio de estado del envío.
CREATE OR REPLACE FUNCTION fn_audit_notification_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO notification_audit (notification_id, old_status, new_status, detail)
        VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            CASE
                WHEN NEW.status = 'fallido' THEN NEW.error_message
                WHEN NEW.status = 'enviado' THEN 'Entregado al servidor SMTP'
                ELSE NULL
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_notification_status
    AFTER UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_notification_status();

-- Trigger: registrar también el alta, para que la bitácora arranque desde el
-- encolado y no desde la primera transición.
CREATE OR REPLACE FUNCTION fn_audit_notification_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_audit (notification_id, old_status, new_status, detail)
    VALUES (NEW.id, NULL, NEW.status, 'Notificación encolada');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_notification_created
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_notification_created();
