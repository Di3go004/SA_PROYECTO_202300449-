-- ============================================================
-- YoUSAC - Analítica Service
-- Base de datos: MySQL 8
-- Microservicio: Python (FastAPI)
-- ============================================================

-- ── TABLAS ──────────────────────────────────────────────────

CREATE TABLE video_metrics (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    video_id                INT NOT NULL UNIQUE COMMENT 'Referencia a recordings en PostgreSQL',
    course_id               INT NOT NULL COMMENT 'Referencia a courses en PostgreSQL',
    teacher_id              INT NOT NULL COMMENT 'Referencia a users en PostgreSQL',
    total_views             INT DEFAULT 0,
    unique_viewers          INT DEFAULT 0,
    total_ratings           INT DEFAULT 0,
    average_stars           DECIMAL(3,2) DEFAULT 0.00,
    recommendation_percent  DECIMAL(5,2) DEFAULT 0.00,
    average_progress        DECIMAL(5,2) DEFAULT 0.00,
    completion_rate         DECIMAL(5,2) DEFAULT 0.00,
    last_synced_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT 'Métricas agregadas por video sincronizadas desde MongoDB vía gRPC';

CREATE TABLE course_metrics (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    course_id             INT NOT NULL UNIQUE COMMENT 'Referencia a courses en PostgreSQL',
    total_students        INT DEFAULT 0,
    total_recordings      INT DEFAULT 0,
    average_progress      DECIMAL(5,2) DEFAULT 0.00,
    average_recommendation DECIMAL(5,2) DEFAULT 0.00,
    last_synced_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT 'Métricas agregadas por curso';

CREATE TABLE teacher_stats (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id              INT NOT NULL UNIQUE COMMENT 'Referencia a users en PostgreSQL',
    total_recordings        INT DEFAULT 0,
    total_views             INT DEFAULT 0,
    average_recommendation  DECIMAL(5,2) DEFAULT 0.00,
    average_stars           DECIMAL(3,2) DEFAULT 0.00,
    last_synced_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT 'Estadísticas agregadas por docente';

CREATE TABLE student_progress (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL COMMENT 'Referencia a users en PostgreSQL',
    course_id        INT NOT NULL COMMENT 'Referencia a courses en PostgreSQL',
    videos_watched   INT DEFAULT 0,
    videos_completed INT DEFAULT 0,
    overall_progress DECIMAL(5,2) DEFAULT 0.00,
    last_synced_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_course (student_id, course_id)
) COMMENT 'Progreso de cada estudiante por curso';

CREATE TABLE sync_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    entity_type  VARCHAR(50) NOT NULL COMMENT 'video, course, teacher, student',
    entity_id    INT NOT NULL,
    status       ENUM('success', 'error') NOT NULL,
    error_msg    TEXT,
    synced_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) COMMENT 'Registro de sincronizaciones gRPC desde el servicio de Reproducción';

-- ── ÍNDICES ─────────────────────────────────────────────────

CREATE INDEX idx_video_metrics_course   ON video_metrics(course_id);
CREATE INDEX idx_video_metrics_teacher  ON video_metrics(teacher_id);
CREATE INDEX idx_student_progress_std   ON student_progress(student_id);
CREATE INDEX idx_student_progress_crs   ON student_progress(course_id);
CREATE INDEX idx_sync_logs_entity       ON sync_logs(entity_type, entity_id);

-- ── VISTAS ──────────────────────────────────────────────────

-- Vista: ranking de videos por porcentaje de recomendación
CREATE OR REPLACE VIEW vw_top_videos AS
SELECT
    vm.video_id,
    vm.course_id,
    vm.teacher_id,
    vm.total_views,
    vm.total_ratings,
    vm.average_stars,
    vm.recommendation_percent,
    vm.average_progress,
    vm.completion_rate
FROM video_metrics vm
WHERE vm.total_ratings >= 5
ORDER BY vm.recommendation_percent DESC;

-- Vista: resumen de rendimiento por docente
CREATE OR REPLACE VIEW vw_teacher_performance AS
SELECT
    ts.teacher_id,
    ts.total_recordings,
    ts.total_views,
    ts.average_recommendation,
    ts.average_stars,
    COUNT(vm.id)                AS courses_with_content,
    SUM(vm.unique_viewers)      AS total_unique_viewers
FROM teacher_stats ts
LEFT JOIN video_metrics vm ON ts.teacher_id = vm.teacher_id
GROUP BY
    ts.teacher_id,
    ts.total_recordings,
    ts.total_views,
    ts.average_recommendation,
    ts.average_stars;

-- Vista: progreso global de estudiantes por curso
CREATE OR REPLACE VIEW vw_course_student_progress AS
SELECT
    sp.course_id,
    COUNT(sp.student_id)            AS total_students,
    AVG(sp.overall_progress)        AS avg_progress,
    AVG(sp.videos_completed)        AS avg_completed_videos,
    SUM(CASE WHEN sp.overall_progress >= 100 THEN 1 ELSE 0 END) AS students_completed
FROM student_progress sp
GROUP BY sp.course_id;

-- Vista: estadísticas globales del sistema (para panel admin)
CREATE OR REPLACE VIEW vw_system_stats AS
SELECT
    (SELECT SUM(total_views)    FROM video_metrics)         AS total_platform_views,
    (SELECT SUM(total_ratings)  FROM video_metrics)         AS total_platform_ratings,
    (SELECT AVG(recommendation_percent) FROM video_metrics) AS avg_recommendation,
    (SELECT COUNT(*)            FROM video_metrics)         AS total_videos,
    (SELECT COUNT(DISTINCT teacher_id) FROM video_metrics)  AS active_teachers,
    (SELECT COUNT(DISTINCT student_id) FROM student_progress) AS active_students;

-- ── STORED PROCEDURES ───────────────────────────────────────

-- SP: sincronizar métricas de un video desde gRPC
DELIMITER //
CREATE PROCEDURE sp_sync_video_metrics(
    IN p_video_id               INT,
    IN p_course_id              INT,
    IN p_teacher_id             INT,
    IN p_total_views            INT,
    IN p_unique_viewers         INT,
    IN p_total_ratings          INT,
    IN p_average_stars          DECIMAL(3,2),
    IN p_recommendation_percent DECIMAL(5,2),
    IN p_average_progress       DECIMAL(5,2),
    IN p_completion_rate        DECIMAL(5,2)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        INSERT INTO sync_logs (entity_type, entity_id, status, error_msg)
        VALUES ('video', p_video_id, 'error', 'Error en sp_sync_video_metrics');
        ROLLBACK;
    END;

    START TRANSACTION;

    INSERT INTO video_metrics (
        video_id, course_id, teacher_id,
        total_views, unique_viewers, total_ratings,
        average_stars, recommendation_percent,
        average_progress, completion_rate, last_synced_at
    )
    VALUES (
        p_video_id, p_course_id, p_teacher_id,
        p_total_views, p_unique_viewers, p_total_ratings,
        p_average_stars, p_recommendation_percent,
        p_average_progress, p_completion_rate, NOW()
    )
    ON DUPLICATE KEY UPDATE
        total_views            = p_total_views,
        unique_viewers         = p_unique_viewers,
        total_ratings          = p_total_ratings,
        average_stars          = p_average_stars,
        recommendation_percent = p_recommendation_percent,
        average_progress       = p_average_progress,
        completion_rate        = p_completion_rate,
        last_synced_at         = NOW();

    INSERT INTO sync_logs (entity_type, entity_id, status)
    VALUES ('video', p_video_id, 'success');

    COMMIT;
END //
DELIMITER ;

-- SP: sincronizar progreso de estudiante en un curso
DELIMITER //
CREATE PROCEDURE sp_sync_student_progress(
    IN p_student_id       INT,
    IN p_course_id        INT,
    IN p_videos_watched   INT,
    IN p_videos_completed INT,
    IN p_overall_progress DECIMAL(5,2)
)
BEGIN
    INSERT INTO student_progress (
        student_id, course_id,
        videos_watched, videos_completed,
        overall_progress, last_synced_at
    )
    VALUES (
        p_student_id, p_course_id,
        p_videos_watched, p_videos_completed,
        p_overall_progress, NOW()
    )
    ON DUPLICATE KEY UPDATE
        videos_watched   = p_videos_watched,
        videos_completed = p_videos_completed,
        overall_progress = p_overall_progress,
        last_synced_at   = NOW();
END //
DELIMITER ;

-- SP: recalcular estadísticas de un docente
DELIMITER //
CREATE PROCEDURE sp_recalculate_teacher_stats(IN p_teacher_id INT)
BEGIN
    INSERT INTO teacher_stats (
        teacher_id, total_recordings, total_views,
        average_recommendation, average_stars, last_synced_at
    )
    SELECT
        p_teacher_id,
        COUNT(*)                    AS total_recordings,
        SUM(total_views)            AS total_views,
        AVG(recommendation_percent) AS average_recommendation,
        AVG(average_stars)          AS average_stars,
        NOW()
    FROM video_metrics
    WHERE teacher_id = p_teacher_id
    ON DUPLICATE KEY UPDATE
        total_recordings       = VALUES(total_recordings),
        total_views            = VALUES(total_views),
        average_recommendation = VALUES(average_recommendation),
        average_stars          = VALUES(average_stars),
        last_synced_at         = NOW();
END //
DELIMITER ;

-- SP: recalcular métricas de un curso
DELIMITER //
CREATE PROCEDURE sp_recalculate_course_metrics(IN p_course_id INT)
BEGIN
    INSERT INTO course_metrics (
        course_id, total_recordings,
        average_progress, average_recommendation, last_synced_at
    )
    SELECT
        p_course_id,
        COUNT(*)                    AS total_recordings,
        AVG(average_progress)       AS average_progress,
        AVG(recommendation_percent) AS average_recommendation,
        NOW()
    FROM video_metrics
    WHERE course_id = p_course_id
    ON DUPLICATE KEY UPDATE
        total_recordings       = VALUES(total_recordings),
        average_progress       = VALUES(average_progress),
        average_recommendation = VALUES(average_recommendation),
        last_synced_at         = NOW();
END //
DELIMITER ;

-- ── FUNCIONES ───────────────────────────────────────────────

-- Función: calcular nivel de engagement de un video
DELIMITER //
CREATE FUNCTION fn_engagement_level(
    p_completion_rate       DECIMAL(5,2),
    p_recommendation_percent DECIMAL(5,2)
)
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE score DECIMAL(5,2);
    SET score = (p_completion_rate + p_recommendation_percent) / 2;

    RETURN CASE
        WHEN score >= 80 THEN 'Alto'
        WHEN score >= 50 THEN 'Medio'
        ELSE 'Bajo'
    END;
END //
DELIMITER ;

-- Función: calcular porcentaje de recomendación desde promedio de estrellas
DELIMITER //
CREATE FUNCTION fn_stars_to_recommendation(p_average_stars DECIMAL(3,2))
RETURNS DECIMAL(5,2)
DETERMINISTIC
BEGIN
    RETURN ROUND((p_average_stars / 5.0) * 100, 2);
END //
DELIMITER ;

-- ── TRIGGERS ────────────────────────────────────────────────

-- Trigger: al insertar/actualizar video_metrics, recalcular métricas del curso y docente
DELIMITER //
CREATE TRIGGER trg_after_video_metrics_upsert
AFTER INSERT ON video_metrics
FOR EACH ROW
BEGIN
    CALL sp_recalculate_teacher_stats(NEW.teacher_id);
    CALL sp_recalculate_course_metrics(NEW.course_id);
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER trg_after_video_metrics_update
AFTER UPDATE ON video_metrics
FOR EACH ROW
BEGIN
    IF OLD.recommendation_percent != NEW.recommendation_percent
    OR OLD.total_views != NEW.total_views THEN
        CALL sp_recalculate_teacher_stats(NEW.teacher_id);
        CALL sp_recalculate_course_metrics(NEW.course_id);
    END IF;
END //
DELIMITER ;

-- Trigger: registrar en sync_logs cuando falla una sincronización
DELIMITER //
CREATE TRIGGER trg_sync_log_on_error
BEFORE INSERT ON sync_logs
FOR EACH ROW
BEGIN
    IF NEW.status = 'error' AND NEW.error_msg IS NULL THEN
        SET NEW.error_msg = 'Error desconocido durante sincronización';
    END IF;
END //
DELIMITER ;

