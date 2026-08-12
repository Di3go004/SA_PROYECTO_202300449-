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

CREATE TABLE courses (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    code       VARCHAR(50)  NOT NULL UNIQUE,
    school_id  INT NOT NULL REFERENCES schools(id),
    semester   VARCHAR(50)  NOT NULL,
    year       INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
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

-- ── ÍNDICES ─────────────────────────────────────────────────

CREATE INDEX idx_courses_school       ON courses(school_id);
CREATE INDEX idx_enrollments_student  ON enrollments(student_id);
CREATE INDEX idx_enrollments_course   ON enrollments(course_id);
CREATE INDEX idx_recordings_course    ON recordings(course_id);
CREATE INDEX idx_recordings_teacher   ON recordings(teacher_id);
CREATE INDEX idx_recordings_published ON recordings(is_published);
CREATE INDEX idx_recordings_tags      ON recordings USING GIN(tags);
CREATE INDEX idx_course_teachers_crs  ON course_teachers(course_id);

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

-- Vista: cursos con sus docentes asignados
CREATE OR REPLACE VIEW vw_courses_with_teachers AS
SELECT
    c.id         AS course_id,
    c.name       AS course_name,
    c.code       AS course_code,
    c.semester,
    c.year,
    s.name       AS school_name,
    ct.teacher_id
FROM courses       c
JOIN schools       s  ON c.school_id   = s.id
JOIN course_teachers ct ON ct.course_id = c.id;

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

INSERT INTO courses (name, code, school_id, semester, year) VALUES
    ('Estructuras de Datos',        'EDD-2025-1',  1, 'Primer Semestre',  2025),
    ('Sistemas Operativos 1',       'SO1-2025-1',  1, 'Primer Semestre',  2025),
    ('Arquitectura de Computadores','ARC-2025-2',  1, 'Segundo Semestre', 2025),
    ('Resistencia de Materiales',   'RES-2025-1',  2, 'Primer Semestre',  2025);

