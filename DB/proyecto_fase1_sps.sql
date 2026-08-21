-- ============================================================
-- YoUSAC - Proyecto Fase 1
-- Procedimientos añadidos sobre yousac_catalog_db para las
-- capacidades del proyecto que exceden la Práctica 3.
--
-- Se ejecuta DESPUÉS de practica3_sps.sql.
-- ============================================================

\connect yousac_catalog_db

-- ── PUBLICACIÓN DE GRABACIONES ──────────────────────────────

-- SP: publicar o despublicar una grabación desde el panel.
--
-- sp_publish_recording (práctica 2) exige que quien publica sea el docente de la
-- grabación, que es lo correcto cuando publica el propio catedrático. Este SP
-- cubre el otro caso: un administrador o auxiliar gestionando el catálogo, donde
-- esa comprobación bloquearía la operación legítima.
--
-- Devuelve los datos de la grabación porque quien la publica necesita
-- inmediatamente el título, el curso y el docente para componer el aviso por
-- correo a los estudiantes inscritos.
CREATE OR REPLACE FUNCTION fn_set_recording_published(
    p_recording_id INT,
    p_published    BOOLEAN
)
RETURNS TABLE (
    recording_id INT,
    title        VARCHAR,
    course_id    INT,
    course_name  VARCHAR,
    course_code  VARCHAR,
    teacher_id   INT,
    is_published BOOLEAN
) AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM recordings WHERE id = p_recording_id) THEN
        RAISE EXCEPTION 'La grabación % no existe', p_recording_id;
    END IF;

    UPDATE recordings
    SET is_published = p_published,
        updated_at   = NOW()
    WHERE id = p_recording_id;

    RETURN QUERY
    SELECT r.id, r.title, c.id, c.name, c.code, r.teacher_id, r.is_published
      FROM recordings r
      JOIN courses c ON c.id = r.course_id
     WHERE r.id = p_recording_id;
END;
$$ LANGUAGE plpgsql;

-- Función: estudiantes con inscripción activa en un curso.
--
-- Devuelve solo los identificadores: los correos viven en yousac_auth_db y los
-- resuelve catalog-service por gRPC. Esta base no conoce —ni debe conocer— los
-- datos de contacto de los usuarios.
CREATE OR REPLACE FUNCTION fn_get_enrolled_student_ids(p_course_id INT)
RETURNS TABLE (student_id INT) AS $$
BEGIN
    RETURN QUERY
    SELECT e.student_id
      FROM enrollments e
     WHERE e.course_id = p_course_id
       AND e.is_active = TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Vista: grabaciones pendientes de publicar, para el panel administrativo.
CREATE OR REPLACE VIEW vw_unpublished_recordings AS
SELECT
    r.id            AS recording_id,
    r.title,
    r.teacher_id,
    r.created_at,
    c.id            AS course_id,
    c.name          AS course_name,
    c.code          AS course_code,
    s.code          AS school_code,
    c.semester,
    c.year,
    (SELECT COUNT(*) FROM enrollments e
      WHERE e.course_id = c.id AND e.is_active) AS inscritos
FROM recordings r
JOIN courses c ON c.id = r.course_id
JOIN schools s ON s.id = c.school_id
WHERE r.is_published = FALSE
ORDER BY r.created_at DESC;
