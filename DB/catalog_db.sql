-- ============================================================
-- YoUSAC - Catalog Service
-- Base de datos: yousac_catalog_db (PostgreSQL 16)
-- Microservicio: TypeScript (NestJS)
-- Dominio: Escuelas, Cursos, Grabaciones, Inscripciones
-- ============================================================

\connect yousac_catalog_db

-- ── TABLAS ──────────────────────────────────────────────────

CREATE TABLE schools (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL UNIQUE,
    code       VARCHAR(50)  NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Semestres como entidad propia (Práctica 3: el panel administrativo debe poder
-- darlos de alta/baja). Antes vivían como el VARCHAR courses.semester, que no
-- se podía administrar ni referenciar.
CREATE TABLE semesters (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL,   -- 'Primer Semestre', 'Segundo Semestre', 'Vacaciones Junio'
    year       INT          NOT NULL,
    code       VARCHAR(50)  NOT NULL UNIQUE,  -- '2025-1', '2025-2'
    is_active  BOOLEAN DEFAULT FALSE,   -- solo uno debería estar activo a la vez
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (name, year)
);

CREATE TABLE courses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    school_id   INT NOT NULL REFERENCES schools(id),
    semester_id INT REFERENCES semesters(id),
    -- semester/year se conservan denormalizados: las vistas y los filtros del
    -- catálogo ya los consultan por nombre. trg_courses_sync_semester (más abajo)
    -- los mantiene siempre en sincronía con la fila de semesters, así que la
    -- normalización no obliga a reescribir vw_catalog ni las consultas existentes.
    semester    VARCHAR(50)  NOT NULL,
    year        INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE course_teachers (
    id         SERIAL PRIMARY KEY,
    course_id  INT NOT NULL REFERENCES courses(id),
    teacher_id INT NOT NULL,   -- Referencia lógica a users.id en yousac_auth_db
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, teacher_id)
);

CREATE TABLE enrollments (
    id          SERIAL PRIMARY KEY,
    student_id  INT NOT NULL,  -- Referencia lógica a users.id en yousac_auth_db
    course_id   INT NOT NULL REFERENCES courses(id),
    enrolled_at TIMESTAMP DEFAULT NOW(),
    is_active   BOOLEAN DEFAULT TRUE,
    enrolled_by INT NOT NULL,  -- admin_id que realizó la inscripción
    UNIQUE(student_id, course_id)
);

CREATE TABLE recordings (
    id                 SERIAL PRIMARY KEY,
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    course_id          INT NOT NULL REFERENCES courses(id),
    teacher_id         INT NOT NULL,  -- Referencia lógica a users.id en yousac_auth_db
    duration_seconds   INT NOT NULL DEFAULT 0,
    video_url          VARCHAR(500) NOT NULL,
    thumbnail_url      VARCHAR(500),
    is_published       BOOLEAN DEFAULT FALSE,
    recommendation_pct DECIMAL(5,2) DEFAULT 0.00,
    tags               TEXT[],
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);

-- ── INGESTA MASIVA (CSV) ────────────────────────────────────
-- Bitácora de cada archivo procesado. Sirve para evidenciar en el informe qué
-- se cargó, cuántas filas entraron y cuáles fallaron sin abortar todo el lote.

CREATE TABLE csv_import_batches (
    id            SERIAL PRIMARY KEY,
    filename      VARCHAR(255) NOT NULL,
    uploaded_by   INT NOT NULL,  -- Referencia lógica a users.id en yousac_auth_db
    total_rows    INT NOT NULL DEFAULT 0,
    inserted_rows INT NOT NULL DEFAULT 0,
    skipped_rows  INT NOT NULL DEFAULT 0,  -- duplicados ya existentes (idempotencia)
    failed_rows   INT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'EN_PROCESO',
    started_at    TIMESTAMP DEFAULT NOW(),
    finished_at   TIMESTAMP,
    CONSTRAINT chk_import_status
        CHECK (status IN ('EN_PROCESO', 'COMPLETADO', 'COMPLETADO_CON_ERRORES', 'FALLIDO'))
);

CREATE TABLE csv_import_errors (
    id            SERIAL PRIMARY KEY,
    batch_id      INT NOT NULL REFERENCES csv_import_batches(id) ON DELETE CASCADE,
    row_number    INT NOT NULL,  -- número de línea en el archivo original (1 = encabezado)
    column_name   VARCHAR(100),
    raw_line      TEXT,
    error_message TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ── ÍNDICES ─────────────────────────────────────────────────

CREATE INDEX idx_courses_school       ON courses(school_id);
CREATE INDEX idx_enrollments_student  ON enrollments(student_id);
CREATE INDEX idx_enrollments_course   ON enrollments(course_id);
CREATE INDEX idx_recordings_course    ON recordings(course_id);
CREATE INDEX idx_recordings_teacher   ON recordings(teacher_id);
CREATE INDEX idx_recordings_published ON recordings(is_published);
CREATE INDEX idx_recordings_tags      ON recordings USING GIN(tags);
CREATE INDEX idx_course_teachers_crs  ON course_teachers(course_id);

-- Índices para la paginación filtrada del catálogo (Práctica 3): el ORDER BY
-- created_at DESC + LIMIT/OFFSET se resuelve por índice en vez de ordenar toda
-- la tabla en cada página.
CREATE INDEX idx_courses_semester     ON courses(semester_id);
CREATE INDEX idx_courses_school_sem   ON courses(school_id, semester_id);
CREATE INDEX idx_recordings_created   ON recordings(created_at DESC);
CREATE INDEX idx_recordings_crs_created ON recordings(course_id, created_at DESC);
-- La carga masiva usa video_url para no reinsertar la misma grabación dos veces.
CREATE UNIQUE INDEX idx_recordings_video_url ON recordings(video_url);
CREATE INDEX idx_csv_errors_batch     ON csv_import_errors(batch_id);

-- ── FUNCIONES ───────────────────────────────────────────────

-- Función: actualizar timestamp updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función: verificar si un estudiante está inscrito en un curso
CREATE OR REPLACE FUNCTION fn_is_student_enrolled(
    p_student_id INT,
    p_course_id  INT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM enrollments
        WHERE student_id = p_student_id
          AND course_id  = p_course_id
          AND is_active  = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- Función: verificar si un docente es catedrático de un curso
CREATE OR REPLACE FUNCTION fn_is_course_teacher(
    p_teacher_id INT,
    p_course_id  INT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM course_teachers
        WHERE teacher_id = p_teacher_id
          AND course_id  = p_course_id
    );
END;
$$ LANGUAGE plpgsql;

-- Función: derivar el código de un semestre a partir de su nombre y año
-- ('Primer Semestre', 2025) → '2025-1'. Se usa al auto-crear semestres desde
-- la carga masiva, donde el CSV trae el nombre pero no el código.
CREATE OR REPLACE FUNCTION fn_build_semester_code(p_name VARCHAR, p_year INT)
RETURNS VARCHAR AS $$
BEGIN
    RETURN p_year || '-' || CASE
        WHEN p_name ILIKE '%primer%'  THEN '1'
        WHEN p_name ILIKE '%segundo%' THEN '2'
        WHEN p_name ILIKE '%vacac%'   THEN 'V'
        ELSE regexp_replace(lower(p_name), '[^a-z0-9]', '', 'g')
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función: resolver (o crear) el semestre que corresponde a un nombre y año.
-- La invocan tanto el trigger de courses como el SP de carga masiva, para que
-- un CSV con semestres nuevos no falle por falta de catálogo previo.
CREATE OR REPLACE FUNCTION fn_resolve_semester(p_name VARCHAR, p_year INT)
RETURNS INT AS $$
DECLARE
    v_id INT;
BEGIN
    SELECT id INTO v_id FROM semesters WHERE name = p_name AND year = p_year;

    IF v_id IS NULL THEN
        INSERT INTO semesters (name, year, code)
        VALUES (p_name, p_year, fn_build_semester_code(p_name, p_year))
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Función: mantener courses.semester/year alineados con la fila de semesters.
-- Acepta las dos direcciones: si viene semester_id manda la tabla semesters;
-- si viene solo semester/year (como en los INSERT históricos y en el CSV) se
-- resuelve el semester_id. Así el modelo queda normalizado sin romper ninguna
-- de las consultas y vistas que ya filtran por el nombre del semestre.
CREATE OR REPLACE FUNCTION fn_courses_sync_semester()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.semester_id IS NOT NULL THEN
        SELECT name, year INTO NEW.semester, NEW.year
        FROM semesters WHERE id = NEW.semester_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El semestre % no existe', NEW.semester_id;
        END IF;
    ELSE
        NEW.semester_id := fn_resolve_semester(NEW.semester, NEW.year);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función: propagar a courses el renombrado de un semestre. Sin esto, editar
-- un semestre desde el panel dejaría los cursos con el nombre viejo.
CREATE OR REPLACE FUNCTION fn_semesters_propagate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS DISTINCT FROM OLD.name OR NEW.year IS DISTINCT FROM OLD.year THEN
        UPDATE courses
        SET semester = NEW.name,
            year     = NEW.year
        WHERE semester_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función: obtener cursos inscritos de un estudiante
CREATE OR REPLACE FUNCTION fn_get_student_courses(p_student_id INT)
RETURNS TABLE(
    course_id   INT,
    course_name VARCHAR,
    course_code VARCHAR,
    school_name VARCHAR,
    semester    VARCHAR,
    year        INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.code,
        s.name,
        c.semester,
        c.year
    FROM enrollments e
    JOIN courses c ON e.course_id  = c.id
    JOIN schools s ON c.school_id  = s.id
    WHERE e.student_id = p_student_id
      AND e.is_active  = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ── VISTAS ──────────────────────────────────────────────────

-- Vista: catálogo completo de grabaciones publicadas
CREATE OR REPLACE VIEW vw_catalog AS
SELECT
    r.id                 AS recording_id,
    r.title,
    r.description,
    r.duration_seconds,
    r.thumbnail_url,
    r.video_url,
    r.recommendation_pct,
    r.tags,
    r.teacher_id,
    r.created_at,
    c.id                 AS course_id,
    c.name               AS course_name,
    c.code               AS course_code,
    c.semester,
    c.semester_id,
    c.year,
    s.id                 AS school_id,
    s.name               AS school_name,
    s.code               AS school_code
FROM recordings r
JOIN courses c ON r.course_id = c.id
JOIN schools s ON c.school_id = s.id
WHERE r.is_published = TRUE;

-- Vista: grabaciones con información de inscripción por estudiante
CREATE OR REPLACE VIEW vw_student_catalog AS
SELECT
    cat.*,
    e.student_id
FROM vw_catalog cat
JOIN enrollments e ON cat.course_id = e.course_id
WHERE e.is_active = TRUE;

-- Vista: cursos con sus docentes asignados (una fila por par curso-docente).
-- Incluye school_id/semester_id porque el catálogo filtra por ellos.
CREATE OR REPLACE VIEW vw_courses_with_teachers AS
SELECT
    c.id         AS course_id,
    c.name       AS course_name,
    c.code       AS course_code,
    c.semester,
    c.semester_id,
    c.year,
    s.id         AS school_id,
    s.name       AS school_name,
    ct.teacher_id
FROM courses       c
JOIN schools       s  ON c.school_id   = s.id
JOIN course_teachers ct ON ct.course_id = c.id;

-- Vista: cursos para el panel administrativo. A diferencia de la anterior usa
-- LEFT JOIN y agrega los docentes en un array, para que un curso recién creado
-- (todavía sin docente asignado) siga apareciendo en la tabla de gestión.
CREATE OR REPLACE VIEW vw_courses_admin AS
SELECT
    c.id          AS course_id,
    c.name        AS course_name,
    c.code        AS course_code,
    c.school_id,
    s.name        AS school_name,
    s.code        AS school_code,
    c.semester_id,
    c.semester,
    c.year,
    c.created_at,
    COALESCE(
        ARRAY_AGG(ct.teacher_id) FILTER (WHERE ct.teacher_id IS NOT NULL),
        '{}'
    )             AS teacher_ids,
    COUNT(DISTINCT ct.teacher_id) AS total_teachers
FROM courses c
JOIN schools s ON c.school_id = s.id
LEFT JOIN course_teachers ct ON ct.course_id = c.id
GROUP BY c.id, c.name, c.code, c.school_id, s.name, s.code,
         c.semester_id, c.semester, c.year, c.created_at;

-- Vista: semestres con el conteo de cursos que dependen de ellos. El panel la
-- usa para avisar antes de intentar borrar un semestre en uso.
CREATE OR REPLACE VIEW vw_semesters_admin AS
SELECT
    sem.id,
    sem.name,
    sem.year,
    sem.code,
    sem.is_active,
    sem.created_at,
    COUNT(c.id) AS total_courses
FROM semesters sem
LEFT JOIN courses c ON c.semester_id = sem.id
GROUP BY sem.id, sem.name, sem.year, sem.code, sem.is_active, sem.created_at;

-- Vista: escuelas con el conteo de cursos, mismo propósito que la anterior.
CREATE OR REPLACE VIEW vw_schools_admin AS
SELECT
    s.id,
    s.name,
    s.code,
    s.created_at,
    COUNT(c.id) AS total_courses
FROM schools s
LEFT JOIN courses c ON c.school_id = s.id
GROUP BY s.id, s.name, s.code, s.created_at;

-- Vista: resumen de inscripciones por curso
CREATE OR REPLACE VIEW vw_course_enrollment_summary AS
SELECT
    c.id         AS course_id,
    c.name       AS course_name,
    c.semester,
    c.year,
    s.name       AS school_name,
    COUNT(e.student_id) FILTER (WHERE e.is_active = TRUE) AS total_students,
    COUNT(r.id)                                            AS total_recordings
FROM courses c
JOIN schools    s ON c.school_id = s.id
LEFT JOIN enrollments e ON e.course_id = c.id
LEFT JOIN recordings  r ON r.course_id = c.id AND r.is_published = TRUE
GROUP BY c.id, c.name, c.semester, c.year, s.name;

-- ── STORED PROCEDURES ───────────────────────────────────────

-- SP: inscribir estudiante en curso
CREATE OR REPLACE PROCEDURE sp_enroll_student(
    p_student_id INT,
    p_course_id  INT,
    p_admin_id   INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM enrollments
        WHERE student_id = p_student_id
          AND course_id  = p_course_id
          AND is_active  = TRUE
    ) THEN
        RAISE EXCEPTION 'El estudiante ya está inscrito en este curso';
    END IF;

    INSERT INTO enrollments (student_id, course_id, enrolled_by)
    VALUES (p_student_id, p_course_id, p_admin_id);
END;
$$;

-- SP: dar de baja inscripción
CREATE OR REPLACE PROCEDURE sp_unenroll_student(
    p_student_id INT,
    p_course_id  INT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE enrollments
    SET is_active = FALSE
    WHERE student_id = p_student_id
      AND course_id  = p_course_id;
END;
$$;

-- SP: publicar grabación
CREATE OR REPLACE PROCEDURE sp_publish_recording(
    p_recording_id INT,
    p_teacher_id   INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM recordings
        WHERE id = p_recording_id AND teacher_id = p_teacher_id
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para publicar esta grabación';
    END IF;

    UPDATE recordings
    SET is_published = TRUE,
        updated_at   = NOW()
    WHERE id = p_recording_id;
END;
$$;

-- SP: actualizar porcentaje de recomendación de una grabación
-- (llamado desde el microservicio de Analítica vía sincronización)
CREATE OR REPLACE PROCEDURE sp_update_recommendation(
    p_recording_id     INT,
    p_recommendation   DECIMAL(5,2)
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE recordings
    SET recommendation_pct = p_recommendation,
        updated_at         = NOW()
    WHERE id = p_recording_id;
END;
$$;

-- SP: asignar docente a curso
CREATE OR REPLACE PROCEDURE sp_assign_teacher_to_course(
    p_teacher_id INT,
    p_course_id  INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM course_teachers
        WHERE teacher_id = p_teacher_id AND course_id = p_course_id
    ) THEN
        RAISE EXCEPTION 'El docente ya está asignado a este curso';
    END IF;

    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (p_course_id, p_teacher_id);
END;
$$;

-- ── TRIGGERS ────────────────────────────────────────────────

-- Trigger: mantener sincronizados courses.semester_id ↔ courses.semester/year
CREATE TRIGGER trg_courses_sync_semester
    BEFORE INSERT OR UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION fn_courses_sync_semester();

-- Trigger: propagar el renombrado de un semestre a sus cursos
CREATE TRIGGER trg_semesters_propagate
    AFTER UPDATE ON semesters
    FOR EACH ROW
    EXECUTE FUNCTION fn_semesters_propagate();

-- Trigger: actualizar updated_at en recordings
CREATE TRIGGER trg_recordings_updated_at
    BEFORE UPDATE ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();

-- Trigger: verificar que el docente esté asignado al curso antes de insertar grabación
CREATE OR REPLACE FUNCTION fn_validate_teacher_course()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT fn_is_course_teacher(NEW.teacher_id, NEW.course_id) THEN
        RAISE EXCEPTION
            'El docente % no está asignado al curso %',
            NEW.teacher_id, NEW.course_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_teacher_course
    BEFORE INSERT ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_teacher_course();

-- ── DATOS INICIALES ─────────────────────────────────────────

INSERT INTO schools (name, code) VALUES
    ('Escuela de Ciencias y Sistemas', 'ECYS'),
    ('Escuela de Ingeniería Civil',    'EIC'),
    ('Escuela de Ingeniería Mecánica', 'EIM'),
    ('Escuela de Ingeniería Química',  'EIQ');

INSERT INTO semesters (name, year, code, is_active) VALUES
    ('Primer Semestre',  2024, '2024-1', FALSE),
    ('Segundo Semestre', 2024, '2024-2', FALSE),
    ('Primer Semestre',  2025, '2025-1', FALSE),
    ('Segundo Semestre', 2025, '2025-2', FALSE),
    ('Primer Semestre',  2026, '2026-1', FALSE),
    ('Segundo Semestre', 2026, '2026-2', TRUE);

-- Nótese que estos INSERT no indican semester_id: trg_courses_sync_semester lo
-- resuelve contra la tabla semesters recién sembrada. Es la misma ruta que sigue
-- la carga masiva de CSV.
INSERT INTO courses (name, code, school_id, semester, year) VALUES
    ('Estructuras de Datos',        'EDD-2025-1',  1, 'Primer Semestre',  2025),
    ('Sistemas Operativos 1',       'SO1-2025-1',  1, 'Primer Semestre',  2025),
    ('Arquitectura de Computadores','ARC-2025-2',  1, 'Segundo Semestre', 2025),
    ('Resistencia de Materiales',   'RES-2025-1',  2, 'Primer Semestre',  2025);

