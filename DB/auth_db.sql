-- ============================================================
-- YoUSAC - Auth Service
-- Base de datos: yousac_auth_db (PostgreSQL 16)
-- Microservicio: TypeScript (NestJS)
-- Dominio: Autenticación, Usuarios, Roles, Sesiones
-- ============================================================

\connect yousac_auth_db

-- ── TABLAS ──────────────────────────────────────────────────

CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role_id         INT NOT NULL REFERENCES roles(id),
    is_active       BOOLEAN DEFAULT TRUE,
    is_blocked      BOOLEAN DEFAULT FALSE,
    failed_attempts INT DEFAULT 0,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id),
    action     VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE revoked_tokens (
    id         SERIAL PRIMARY KEY,
    token_jti  VARCHAR(255) NOT NULL UNIQUE,
    user_id    INT NOT NULL REFERENCES users(id),
    revoked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- ── ÍNDICES ─────────────────────────────────────────────────

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role_id);
CREATE INDEX idx_revoked_tokens ON revoked_tokens(token_jti);
CREATE INDEX idx_audit_user     ON audit_logs(user_id);

-- ── FUNCIONES ───────────────────────────────────────────────

-- Función: validar dominio institucional
CREATE OR REPLACE FUNCTION fn_is_institutional_email(p_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_email ~* '^[a-zA-Z0-9._%+-]+@(ingenieria\.usac\.edu\.gt|ing\.usac\.edu\.gt)$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función: actualizar timestamp updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función: resetear intentos fallidos al hacer login exitoso
CREATE OR REPLACE FUNCTION fn_reset_failed_attempts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_login IS DISTINCT FROM OLD.last_login
       AND NEW.last_login IS NOT NULL THEN
        NEW.failed_attempts = 0;
        NEW.is_blocked      = FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función: validar dominio antes de insertar usuario
CREATE OR REPLACE FUNCTION fn_validate_email_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT fn_is_institutional_email(NEW.email) THEN
        RAISE EXCEPTION 'Dominio de correo no institucional: %', NEW.email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── VISTAS ──────────────────────────────────────────────────

-- Vista: usuarios con su rol
CREATE OR REPLACE VIEW vw_users_with_role AS
SELECT
    u.id,
    u.email,
    u.full_name,
    u.is_active,
    u.is_blocked,
    u.failed_attempts,
    u.last_login,
    u.created_at,
    r.name AS role_name
FROM users u
JOIN roles r ON u.role_id = r.id;

-- Vista: tokens revocados vigentes (aún no expirados)
CREATE OR REPLACE VIEW vw_active_revoked_tokens AS
SELECT
    token_jti,
    user_id,
    revoked_at,
    expires_at
FROM revoked_tokens
WHERE expires_at > NOW();

-- Vista: usuarios bloqueados
CREATE OR REPLACE VIEW vw_blocked_users AS
SELECT
    u.id,
    u.email,
    u.full_name,
    u.failed_attempts,
    r.name AS role_name
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.is_blocked = TRUE;

-- ── STORED PROCEDURES ───────────────────────────────────────

-- SP: registrar nuevo usuario
CREATE OR REPLACE PROCEDURE sp_register_user(
    p_email         VARCHAR,
    p_password_hash VARCHAR,
    p_full_name     VARCHAR,
    p_role_id       INT DEFAULT 2
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT fn_is_institutional_email(p_email) THEN
        RAISE EXCEPTION 'Correo no institucional: %', p_email;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        RAISE EXCEPTION 'El correo ya está registrado: %', p_email;
    END IF;

    INSERT INTO users (email, password_hash, full_name, role_id)
    VALUES (p_email, p_password_hash, p_full_name, p_role_id);

    INSERT INTO audit_logs (user_id, action)
    VALUES (
        (SELECT id FROM users WHERE email = p_email),
        'REGISTER'
    );
END;
$$;

-- SP: manejo de intento de login fallido
CREATE OR REPLACE PROCEDURE sp_handle_failed_login(p_email VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users
    SET
        failed_attempts = failed_attempts + 1,
        is_blocked = CASE
            WHEN failed_attempts + 1 >= 5 THEN TRUE
            ELSE FALSE
        END
    WHERE email = p_email;
END;
$$;

-- SP: registrar login exitoso
CREATE OR REPLACE PROCEDURE sp_handle_successful_login(
    p_email     VARCHAR,
    p_ip        VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id INT;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = p_email;

    UPDATE users
    SET last_login = NOW()
    WHERE id = v_user_id;

    INSERT INTO audit_logs (user_id, action, ip_address)
    VALUES (v_user_id, 'LOGIN_SUCCESS', p_ip);
END;
$$;

-- SP: revocar token JWT
CREATE OR REPLACE PROCEDURE sp_revoke_token(
    p_token_jti VARCHAR,
    p_user_id   INT,
    p_expires_at TIMESTAMP
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO revoked_tokens (token_jti, user_id, expires_at)
    VALUES (p_token_jti, p_user_id, p_expires_at)
    ON CONFLICT (token_jti) DO NOTHING;

    INSERT INTO audit_logs (user_id, action)
    VALUES (p_user_id, 'LOGOUT');
END;
$$;

-- SP: asignar rol a usuario
CREATE OR REPLACE PROCEDURE sp_assign_role(
    p_target_user_id INT,
    p_new_role_id    INT,
    p_admin_id       INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_target_user_id = p_admin_id THEN
        RAISE EXCEPTION 'No puedes modificar tu propio rol';
    END IF;

    UPDATE users
    SET role_id    = p_new_role_id,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    INSERT INTO audit_logs (user_id, action)
    VALUES (
        p_admin_id,
        'ASSIGN_ROLE:' || p_new_role_id || '_TO_USER:' || p_target_user_id
    );
END;
$$;

-- SP: limpiar tokens revocados expirados
CREATE OR REPLACE PROCEDURE sp_cleanup_expired_tokens()
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM revoked_tokens WHERE expires_at <= NOW();
END;
$$;

-- ── TRIGGERS ────────────────────────────────────────────────

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_reset_failed_attempts
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION fn_reset_failed_attempts();

CREATE TRIGGER trg_validate_email_domain
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_email_domain();

-- ── DATOS INICIALES ─────────────────────────────────────────

INSERT INTO roles (name, description) VALUES
    ('administrador', 'Acceso total al sistema'),
    ('estudiante',    'Acceso a grabaciones de cursos inscritos'),
    ('docente',       'Puede subir grabaciones y ver estadísticas');

