-- ============================================================
-- YoUSAC - Práctica 3
-- Procedimientos Almacenados: CRUD académico, carga masiva CSV
-- y paginación desde servidor.
-- Base de datos: yousac_catalog_db (PostgreSQL 16)
--
-- Se ejecuta DESPUÉS de catalog_db.sql: depende de las tablas
-- semesters, schools, courses, course_teachers, recordings,
-- csv_import_batches y csv_import_errors.
--
-- Toda escritura del panel administrativo y de la ingesta CSV
-- pasa obligatoriamente por estos SPs; el microservicio nunca
-- ejecuta INSERT/UPDATE/DELETE sueltos sobre estas tablas.
-- ============================================================

\connect yousac_catalog_db

-- ============================================================
-- 1. SEMESTRES
-- ============================================================

-- SP: crear semestre. Si no se envía código se deriva del nombre y el año.
CREATE OR REPLACE PROCEDURE sp_create_semester(
    p_name      VARCHAR,
    p_year      INT,
    p_code      VARCHAR DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT FALSE,
    INOUT p_id  INT     DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_code VARCHAR;
BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre del semestre es obligatorio';
    END IF;

    IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
        RAISE EXCEPTION 'Año inválido: % (debe estar entre 2000 y 2100)', p_year;
    END IF;

    IF EXISTS (SELECT 1 FROM semesters WHERE name = btrim(p_name) AND year = p_year) THEN
        RAISE EXCEPTION 'Ya existe el semestre "% %"', p_name, p_year;
    END IF;

    v_code := COALESCE(NULLIF(btrim(p_code), ''), fn_build_semester_code(btrim(p_name), p_year));

    IF EXISTS (SELECT 1 FROM semesters WHERE code = v_code) THEN
        RAISE EXCEPTION 'Ya existe un semestre con el código "%"', v_code;
    END IF;

    -- Solo un semestre puede estar activo a la vez.
    IF p_is_active THEN
        UPDATE semesters SET is_active = FALSE WHERE is_active = TRUE;
    END IF;

    INSERT INTO semesters (name, year, code, is_active)
    VALUES (btrim(p_name), p_year, v_code, COALESCE(p_is_active, FALSE))
    RETURNING id INTO p_id;
END;
$$;

-- SP: actualizar semestre. trg_semesters_propagate se encarga de replicar el
-- nombre/año a los cursos que lo referencian.
CREATE OR REPLACE PROCEDURE sp_update_semester(
    p_id        INT,
    p_name      VARCHAR,
    p_year      INT,
    p_code      VARCHAR DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_code VARCHAR;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM semesters WHERE id = p_id) THEN
        RAISE EXCEPTION 'El semestre % no existe', p_id;
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre del semestre es obligatorio';
    END IF;

    IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
        RAISE EXCEPTION 'Año inválido: % (debe estar entre 2000 y 2100)', p_year;
    END IF;

    IF EXISTS (
        SELECT 1 FROM semesters
        WHERE name = btrim(p_name) AND year = p_year AND id <> p_id
    ) THEN
        RAISE EXCEPTION 'Ya existe otro semestre "% %"', p_name, p_year;
    END IF;

    v_code := COALESCE(NULLIF(btrim(p_code), ''), fn_build_semester_code(btrim(p_name), p_year));

    IF EXISTS (SELECT 1 FROM semesters WHERE code = v_code AND id <> p_id) THEN
        RAISE EXCEPTION 'Ya existe otro semestre con el código "%"', v_code;
    END IF;

    IF p_is_active THEN
        UPDATE semesters SET is_active = FALSE WHERE is_active = TRUE AND id <> p_id;
    END IF;

    UPDATE semesters
    SET name      = btrim(p_name),
        year      = p_year,
        code      = v_code,
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_id;
END;
$$;

-- SP: eliminar semestre. Se bloquea si hay cursos que dependen de él, para no
-- dejar el catálogo con referencias rotas.
CREATE OR REPLACE PROCEDURE sp_delete_semester(p_id INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_courses INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM semesters WHERE id = p_id) THEN
        RAISE EXCEPTION 'El semestre % no existe', p_id;
    END IF;

    SELECT COUNT(*) INTO v_courses FROM courses WHERE semester_id = p_id;

    IF v_courses > 0 THEN
        RAISE EXCEPTION
            'No se puede eliminar el semestre: tiene % curso(s) asociado(s)', v_courses;
    END IF;

    DELETE FROM semesters WHERE id = p_id;
END;
$$;

-- ============================================================
-- 2. ESCUELAS / ÁREAS
-- ============================================================

CREATE OR REPLACE PROCEDURE sp_create_school(
    p_name     VARCHAR,
    p_code     VARCHAR,
    INOUT p_id INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre de la escuela es obligatorio';
    END IF;

    IF p_code IS NULL OR btrim(p_code) = '' THEN
        RAISE EXCEPTION 'El código de la escuela es obligatorio';
    END IF;

    IF EXISTS (SELECT 1 FROM schools WHERE upper(code) = upper(btrim(p_code))) THEN
        RAISE EXCEPTION 'Ya existe una escuela con el código "%"', p_code;
    END IF;

    IF EXISTS (SELECT 1 FROM schools WHERE name = btrim(p_name)) THEN
        RAISE EXCEPTION 'Ya existe una escuela con el nombre "%"', p_name;
    END IF;

    INSERT INTO schools (name, code)
    VALUES (btrim(p_name), upper(btrim(p_code)))
    RETURNING id INTO p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_school(
    p_id   INT,
    p_name VARCHAR,
    p_code VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schools WHERE id = p_id) THEN
        RAISE EXCEPTION 'La escuela % no existe', p_id;
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre de la escuela es obligatorio';
    END IF;

    IF p_code IS NULL OR btrim(p_code) = '' THEN
        RAISE EXCEPTION 'El código de la escuela es obligatorio';
    END IF;

    IF EXISTS (
        SELECT 1 FROM schools WHERE upper(code) = upper(btrim(p_code)) AND id <> p_id
    ) THEN
        RAISE EXCEPTION 'Ya existe otra escuela con el código "%"', p_code;
    END IF;

    IF EXISTS (SELECT 1 FROM schools WHERE name = btrim(p_name) AND id <> p_id) THEN
        RAISE EXCEPTION 'Ya existe otra escuela con el nombre "%"', p_name;
    END IF;

    UPDATE schools
    SET name = btrim(p_name),
        code = upper(btrim(p_code))
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_school(p_id INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_courses INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schools WHERE id = p_id) THEN
        RAISE EXCEPTION 'La escuela % no existe', p_id;
    END IF;

    SELECT COUNT(*) INTO v_courses FROM courses WHERE school_id = p_id;

    IF v_courses > 0 THEN
        RAISE EXCEPTION
            'No se puede eliminar la escuela: tiene % curso(s) asociado(s)', v_courses;
    END IF;

    DELETE FROM schools WHERE id = p_id;
END;
$$;

-- ============================================================
-- 3. CURSOS
-- ============================================================

-- Nótese que no se tocan courses.semester / courses.year: los rellena
-- trg_courses_sync_semester a partir de semester_id.
CREATE OR REPLACE PROCEDURE sp_create_course(
    p_name        VARCHAR,
    p_code        VARCHAR,
    p_school_id   INT,
    p_semester_id INT,
    INOUT p_id    INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre del curso es obligatorio';
    END IF;

    IF p_code IS NULL OR btrim(p_code) = '' THEN
        RAISE EXCEPTION 'El código del curso es obligatorio';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM schools WHERE id = p_school_id) THEN
        RAISE EXCEPTION 'La escuela % no existe', p_school_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM semesters WHERE id = p_semester_id) THEN
        RAISE EXCEPTION 'El semestre % no existe', p_semester_id;
    END IF;

    IF EXISTS (SELECT 1 FROM courses WHERE upper(code) = upper(btrim(p_code))) THEN
        RAISE EXCEPTION 'Ya existe un curso con el código "%"', p_code;
    END IF;

    INSERT INTO courses (name, code, school_id, semester_id, semester, year)
    VALUES (btrim(p_name), upper(btrim(p_code)), p_school_id, p_semester_id, '', 0)
    RETURNING id INTO p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_course(
    p_id          INT,
    p_name        VARCHAR,
    p_code        VARCHAR,
    p_school_id   INT,
    p_semester_id INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM courses WHERE id = p_id) THEN
        RAISE EXCEPTION 'El curso % no existe', p_id;
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre del curso es obligatorio';
    END IF;

    IF p_code IS NULL OR btrim(p_code) = '' THEN
        RAISE EXCEPTION 'El código del curso es obligatorio';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM schools WHERE id = p_school_id) THEN
        RAISE EXCEPTION 'La escuela % no existe', p_school_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM semesters WHERE id = p_semester_id) THEN
        RAISE EXCEPTION 'El semestre % no existe', p_semester_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM courses WHERE upper(code) = upper(btrim(p_code)) AND id <> p_id
    ) THEN
        RAISE EXCEPTION 'Ya existe otro curso con el código "%"', p_code;
    END IF;

    UPDATE courses
    SET name        = btrim(p_name),
        code        = upper(btrim(p_code)),
        school_id   = p_school_id,
        semester_id = p_semester_id
    WHERE id = p_id;
END;
$$;

-- SP: eliminar curso. Se bloquea si tiene grabaciones o inscripciones activas;
-- borrarlo dejaría huérfanas las métricas del servicio de analítica.
CREATE OR REPLACE PROCEDURE sp_delete_course(p_id INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_recordings  INT;
    v_enrollments INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM courses WHERE id = p_id) THEN
        RAISE EXCEPTION 'El curso % no existe', p_id;
    END IF;

    SELECT COUNT(*) INTO v_recordings  FROM recordings  WHERE course_id = p_id;
    SELECT COUNT(*) INTO v_enrollments FROM enrollments WHERE course_id = p_id AND is_active;

    IF v_recordings > 0 THEN
        RAISE EXCEPTION
            'No se puede eliminar el curso: tiene % grabación(es) asociada(s)', v_recordings;
    END IF;

    IF v_enrollments > 0 THEN
        RAISE EXCEPTION
            'No se puede eliminar el curso: tiene % inscripción(es) activa(s)', v_enrollments;
    END IF;

    DELETE FROM course_teachers WHERE course_id = p_id;
    DELETE FROM courses         WHERE id        = p_id;
END;
$$;

-- ============================================================
-- 4. ASIGNACIONES ACADÉMICAS (docente ↔ curso)
-- ============================================================
-- sp_assign_teacher_to_course ya vive en catalog_db.sql y falla si el docente
-- ya estaba asignado: es el comportamiento que quiere el panel, donde reasignar
-- es un error del usuario. La carga masiva necesita lo contrario (reencontrarse
-- con la misma pareja curso/docente fila tras fila es lo normal), por eso existe
-- la variante idempotente de abajo en vez de relajar la original.

CREATE OR REPLACE PROCEDURE sp_ensure_teacher_assignment(
    p_teacher_id INT,
    p_course_id  INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_teacher_id IS NULL OR p_teacher_id <= 0 THEN
        RAISE EXCEPTION 'Docente inválido: %', p_teacher_id;
    END IF;

    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (p_course_id, p_teacher_id)
    ON CONFLICT (course_id, teacher_id) DO NOTHING;
END;
$$;

-- SP: desasignar docente de un curso. Se bloquea si el docente tiene grabaciones
-- en ese curso, porque trg_validate_teacher_course dejaría de admitir nuevas
-- grabaciones suyas y las existentes quedarían sin respaldo de asignación.
CREATE OR REPLACE PROCEDURE sp_unassign_teacher_from_course(
    p_teacher_id INT,
    p_course_id  INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_recordings INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM course_teachers
        WHERE teacher_id = p_teacher_id AND course_id = p_course_id
    ) THEN
        RAISE EXCEPTION 'El docente % no está asignado al curso %', p_teacher_id, p_course_id;
    END IF;

    SELECT COUNT(*) INTO v_recordings
    FROM recordings WHERE teacher_id = p_teacher_id AND course_id = p_course_id;

    IF v_recordings > 0 THEN
        RAISE EXCEPTION
            'No se puede desasignar: el docente tiene % grabación(es) en este curso', v_recordings;
    END IF;

    DELETE FROM course_teachers
    WHERE teacher_id = p_teacher_id AND course_id = p_course_id;
END;
$$;

-- ============================================================
-- 5. INGESTA MASIVA (CSV)
-- ============================================================

-- SP: abrir un lote de importación y devolver su id.
CREATE OR REPLACE PROCEDURE sp_start_import_batch(
    p_filename       VARCHAR,
    p_uploaded_by    INT,
    INOUT p_batch_id INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_filename IS NULL OR btrim(p_filename) = '' THEN
        RAISE EXCEPTION 'El nombre del archivo es obligatorio';
    END IF;

    INSERT INTO csv_import_batches (filename, uploaded_by, status)
    VALUES (btrim(p_filename), p_uploaded_by, 'EN_PROCESO')
    RETURNING id INTO p_batch_id;
END;
$$;

-- SP: procesar UNA fila del CSV. Es el procedimiento central de la carga masiva.
--
-- Resuelve en cascada escuela → semestre → curso → asignación docente y recién
-- entonces inserta la grabación. Ese orden no es cosmético: el trigger
-- trg_validate_teacher_course rechaza cualquier grabación cuyo docente no esté
-- previamente asignado al curso, así que la asignación tiene que ocurrir antes
-- del INSERT.
--
-- Es idempotente: las entidades se buscan por código antes de crearse y la
-- grabación se omite si su video_url ya existe (índice único). Reprocesar el
-- mismo archivo no duplica nada, solo suma filas OMITIDAS.
--
-- p_status devuelve 'INSERTADO' u 'OMITIDO'. Los errores se propagan como
-- excepción para que el servicio los capture por fila y siga con las siguientes.
CREATE OR REPLACE PROCEDURE sp_import_recording_row(
    p_school_code      VARCHAR,
    p_school_name      VARCHAR,
    p_course_code      VARCHAR,
    p_course_name      VARCHAR,
    p_semester_name    VARCHAR,
    p_year             INT,
    p_teacher_id       INT,
    p_title            VARCHAR,
    p_description      TEXT,
    p_duration_seconds INT,
    p_video_url        VARCHAR,
    p_thumbnail_url    VARCHAR    DEFAULT NULL,
    p_tags             TEXT       DEFAULT NULL,   -- separados por '|'
    p_is_published     BOOLEAN    DEFAULT TRUE,
    INOUT p_status     VARCHAR    DEFAULT NULL,
    INOUT p_recording_id INT      DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_school_id   INT;
    v_semester_id INT;
    v_course_id   INT;
    v_tags        TEXT[];
BEGIN
    -- ── Validaciones de la fila ──────────────────────────────
    IF p_title IS NULL OR btrim(p_title) = '' THEN
        RAISE EXCEPTION 'El título de la grabación es obligatorio';
    END IF;

    IF p_video_url IS NULL OR btrim(p_video_url) = '' THEN
        RAISE EXCEPTION 'La URL del video es obligatoria';
    END IF;

    IF p_course_code IS NULL OR btrim(p_course_code) = '' THEN
        RAISE EXCEPTION 'El código del curso es obligatorio';
    END IF;

    IF p_school_code IS NULL OR btrim(p_school_code) = '' THEN
        RAISE EXCEPTION 'El código de la escuela es obligatorio';
    END IF;

    IF p_teacher_id IS NULL OR p_teacher_id <= 0 THEN
        RAISE EXCEPTION 'Docente no resuelto para la grabación "%"', p_title;
    END IF;

    IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
        RAISE EXCEPTION 'Año inválido: %', p_year;
    END IF;

    IF COALESCE(p_duration_seconds, 0) < 0 THEN
        RAISE EXCEPTION 'Duración inválida: %', p_duration_seconds;
    END IF;

    -- ── Idempotencia: si la grabación ya existe, se omite ────
    SELECT id INTO p_recording_id FROM recordings WHERE video_url = btrim(p_video_url);
    IF p_recording_id IS NOT NULL THEN
        p_status := 'OMITIDO';
        RETURN;
    END IF;

    -- ── 1. Escuela (upsert por código) ───────────────────────
    SELECT id INTO v_school_id FROM schools WHERE upper(code) = upper(btrim(p_school_code));

    IF v_school_id IS NULL THEN
        IF p_school_name IS NULL OR btrim(p_school_name) = '' THEN
            RAISE EXCEPTION
                'La escuela "%" no existe y la fila no trae nombre para crearla', p_school_code;
        END IF;

        INSERT INTO schools (name, code)
        VALUES (btrim(p_school_name), upper(btrim(p_school_code)))
        RETURNING id INTO v_school_id;
    END IF;

    -- ── 2. Semestre (se crea si el CSV trae uno nuevo) ───────
    v_semester_id := fn_resolve_semester(btrim(p_semester_name), p_year);

    -- ── 3. Curso (upsert por código) ─────────────────────────
    SELECT id INTO v_course_id FROM courses WHERE upper(code) = upper(btrim(p_course_code));

    IF v_course_id IS NULL THEN
        IF p_course_name IS NULL OR btrim(p_course_name) = '' THEN
            RAISE EXCEPTION
                'El curso "%" no existe y la fila no trae nombre para crearlo', p_course_code;
        END IF;

        INSERT INTO courses (name, code, school_id, semester_id, semester, year)
        VALUES (btrim(p_course_name), upper(btrim(p_course_code)),
                v_school_id, v_semester_id, '', 0)
        RETURNING id INTO v_course_id;
    END IF;

    -- ── 4. Asignación docente↔curso (antes del INSERT) ───────
    CALL sp_ensure_teacher_assignment(p_teacher_id, v_course_id);

    -- ── 5. Grabación ─────────────────────────────────────────
    v_tags := CASE
        WHEN p_tags IS NULL OR btrim(p_tags) = '' THEN '{}'::TEXT[]
        ELSE string_to_array(btrim(p_tags), '|')
    END;

    INSERT INTO recordings (
        title, description, course_id, teacher_id, duration_seconds,
        video_url, thumbnail_url, is_published, tags
    )
    VALUES (
        btrim(p_title), p_description, v_course_id, p_teacher_id,
        COALESCE(p_duration_seconds, 0), btrim(p_video_url),
        NULLIF(btrim(COALESCE(p_thumbnail_url, '')), ''),
        COALESCE(p_is_published, TRUE), v_tags
    )
    RETURNING id INTO p_recording_id;

    p_status := 'INSERTADO';
END;
$$;

-- SP: registrar el error de una fila que no pudo importarse.
CREATE OR REPLACE PROCEDURE sp_log_import_error(
    p_batch_id      INT,
    p_row_number    INT,
    p_error_message TEXT,
    p_column_name   VARCHAR DEFAULT NULL,
    p_raw_line      TEXT    DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO csv_import_errors (batch_id, row_number, column_name, raw_line, error_message)
    VALUES (p_batch_id, p_row_number, p_column_name, p_raw_line, p_error_message);
END;
$$;

-- SP: cerrar el lote. failed_rows se calcula desde csv_import_errors en vez de
-- confiar en un contador del servicio, y el estado se deriva de los totales.
CREATE OR REPLACE PROCEDURE sp_finish_import_batch(
    p_batch_id   INT,
    p_total_rows INT,
    p_inserted   INT,
    p_skipped    INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_failed INT;
    v_status VARCHAR(30);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM csv_import_batches WHERE id = p_batch_id) THEN
        RAISE EXCEPTION 'El lote de importación % no existe', p_batch_id;
    END IF;

    SELECT COUNT(*) INTO v_failed FROM csv_import_errors WHERE batch_id = p_batch_id;

    v_status := CASE
        WHEN v_failed = 0                       THEN 'COMPLETADO'
        WHEN COALESCE(p_inserted, 0) = 0        THEN 'FALLIDO'
        ELSE 'COMPLETADO_CON_ERRORES'
    END;

    UPDATE csv_import_batches
    SET total_rows    = COALESCE(p_total_rows, 0),
        inserted_rows = COALESCE(p_inserted, 0),
        skipped_rows  = COALESCE(p_skipped, 0),
        failed_rows   = v_failed,
        status        = v_status,
        finished_at   = NOW()
    WHERE id = p_batch_id;
END;
$$;

-- ============================================================
-- 6. PAGINACIÓN DESDE SERVIDOR
-- ============================================================

-- Catálogo paginado con filtros combinables. Puntos de diseño:
--
--  · El total de resultados viaja como columna total_count calculada con
--    COUNT(*) OVER(), que se evalúa después del WHERE pero antes del LIMIT.
--    Así una sola consulta devuelve la página y el total, sin repetir el
--    predicado en una segunda función que podría divergir con el tiempo.
--
--  · Cada filtro es NULL-safe (p_x IS NULL OR col = p_x), de modo que los
--    filtros se combinan sin construir SQL por concatenación y sin exponerse
--    a inyección.
--
--  · p_limit se recorta a 10 acá abajo, no en el microservicio: el máximo de
--    la Práctica 3 lo garantiza la base aunque el cliente pida más.
--
--  · Para el rol estudiante se restringe a los cursos con inscripción activa,
--    replicando lo que hacía vw_student_catalog pero sin duplicar filas cuando
--    hay más de una inscripción.
CREATE OR REPLACE FUNCTION fn_get_catalog_paginated(
    p_user_id     INT     DEFAULT NULL,
    p_role        VARCHAR DEFAULT NULL,
    p_semester_id INT     DEFAULT NULL,
    p_school_id   INT     DEFAULT NULL,
    p_course_id   INT     DEFAULT NULL,
    p_teacher_id  INT     DEFAULT NULL,
    p_year        INT     DEFAULT NULL,
    p_tag         VARCHAR DEFAULT NULL,
    p_search      VARCHAR DEFAULT NULL,
    p_page        INT     DEFAULT 1,
    p_limit       INT     DEFAULT 10
)
RETURNS TABLE (
    recording_id       INT,
    title              VARCHAR,
    description        TEXT,
    duration_seconds   INT,
    thumbnail_url      VARCHAR,
    video_url          VARCHAR,
    recommendation_pct NUMERIC,
    tags               TEXT[],
    teacher_id         INT,
    created_at         TIMESTAMP,
    course_id          INT,
    course_name        VARCHAR,
    course_code        VARCHAR,
    semester           VARCHAR,
    semester_id        INT,
    year               INT,
    school_id          INT,
    school_name        VARCHAR,
    school_code        VARCHAR,
    total_count        BIGINT
) AS $$
#variable_conflict use_column
DECLARE
    v_limit  INT;
    v_offset INT;
BEGIN
    -- Máximo 10 por página (requisito de la práctica), mínimo 1.
    v_limit  := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 10);
    v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * v_limit;

    RETURN QUERY
    SELECT
        cat.recording_id,
        cat.title,
        cat.description,
        cat.duration_seconds,
        cat.thumbnail_url,
        cat.video_url,
        cat.recommendation_pct,
        cat.tags,
        cat.teacher_id,
        cat.created_at,
        cat.course_id,
        cat.course_name,
        cat.course_code,
        cat.semester,
        cat.semester_id,
        cat.year,
        cat.school_id,
        cat.school_name,
        cat.school_code,
        COUNT(*) OVER () AS total_count
    FROM vw_catalog cat
    WHERE
        -- Alcance por rol: el estudiante solo ve cursos donde está inscrito.
        (
            p_role IS DISTINCT FROM 'estudiante'
            OR EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.course_id  = cat.course_id
                  AND e.student_id = p_user_id
                  AND e.is_active  = TRUE
            )
        )
        AND (p_semester_id IS NULL OR cat.semester_id = p_semester_id)
        AND (p_school_id   IS NULL OR cat.school_id   = p_school_id)
        AND (p_course_id   IS NULL OR cat.course_id   = p_course_id)
        AND (p_teacher_id  IS NULL OR cat.teacher_id  = p_teacher_id)
        AND (p_year        IS NULL OR cat.year        = p_year)
        AND (p_tag         IS NULL OR p_tag = ANY (cat.tags))
        AND (
            p_search IS NULL
            OR cat.title       ILIKE '%' || p_search || '%'
            OR cat.description ILIKE '%' || p_search || '%'
        )
    ORDER BY cat.created_at DESC, cat.recording_id DESC
    LIMIT v_limit OFFSET v_offset;
END;
$$ LANGUAGE plpgsql STABLE;
