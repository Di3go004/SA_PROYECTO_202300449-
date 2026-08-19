-- ============================================================
-- Consultas para la calificación — Práctica 3
--
-- Cómo usarlo en DBeaver:
--   Las consultas del bloque 1 corren sobre  yousac_auth_db
--   Las de los bloques 2, 3 y 4 corren sobre yousac_catalog_db
--   (son dos bases distintas en el mismo servidor PostgreSQL:5432)
--
-- Ejecutá una sola sentencia con Ctrl+Enter.
-- ============================================================


-- ============================================================
-- BLOQUE 1 · USUARIOS CON SUS ROLES        [ yousac_auth_db ]
-- Es el punto que pidió el auxiliar. Un JOIN, no dos tablas
-- separadas: cada usuario aparece junto a su rol.
-- ============================================================

-- 1.1 · LA PRINCIPAL — mostrar ésta
SELECT u.id,
       u.full_name  AS nombre,
       u.email      AS correo,
       r.id         AS rol_id,
       r.name       AS rol,
       u.is_active  AS activo,
       u.is_blocked AS bloqueado
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
 ORDER BY r.id, u.id;


-- 1.2 · Con la descripción de cada rol
SELECT u.full_name   AS nombre,
       u.email       AS correo,
       r.name        AS rol,
       r.description AS que_puede_hacer
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
 ORDER BY r.id;


-- 1.3 · Cuántos usuarios hay por rol
--       LEFT JOIN para que aparezcan también los roles sin usuarios
SELECT r.id,
       r.name       AS rol,
       COUNT(u.id)  AS usuarios
  FROM roles r
  LEFT JOIN users u ON u.role_id = r.id
 GROUP BY r.id, r.name
 ORDER BY r.id;


-- 1.4 · La vista que usa el backend: mismo JOIN, ya encapsulado.
--       auth-service consulta ESTA vista, nunca users a secas.
SELECT id, full_name, email, role_name, is_active, is_blocked
  FROM vw_users_with_role
 ORDER BY id;


-- 1.5 · Catálogo de roles del sistema
SELECT id, name AS rol, description
  FROM roles
 ORDER BY id;


-- ============================================================
-- BLOQUE 2 · CARGA MASIVA CSV           [ yousac_catalog_db ]
-- Evidencia de que los registros entraron por los SPs.
-- ============================================================

-- 2.1 · Bitácora de cada archivo procesado
SELECT id,
       filename      AS archivo,
       total_rows    AS leidas,
       inserted_rows AS insertadas,
       skipped_rows  AS omitidas,
       failed_rows   AS con_error,
       status        AS estado,
       started_at    AS inicio,
       finished_at   AS fin
  FROM csv_import_batches
 ORDER BY id;


-- 2.2 · Detalle de las filas que fallaron y por qué
SELECT batch_id      AS lote,
       row_number    AS fila,
       column_name   AS columna,
       error_message AS motivo
  FROM csv_import_errors
 ORDER BY batch_id, row_number;


-- 2.3 · Grabaciones insertadas, con su curso, escuela y semestre
SELECT r.id,
       r.title                          AS clase,
       c.code                           AS curso,
       s.code                           AS escuela,
       sem.name || ' ' || sem.year      AS semestre,
       r.teacher_id                     AS docente_id,
       r.duration_seconds               AS duracion_seg,
       r.tags                           AS etiquetas
  FROM recordings r
  INNER JOIN courses   c   ON c.id   = r.course_id
  INNER JOIN schools   s   ON s.id   = c.school_id
  INNER JOIN semesters sem ON sem.id = c.semester_id
 ORDER BY r.id;


-- 2.4 · Entidades que el CSV creó por su cuenta (escuelas y cursos nuevos)
SELECT 'escuela' AS tipo, code, name FROM schools
 WHERE code = 'EIME'
UNION ALL
SELECT 'curso', code, name FROM courses
 WHERE code IN ('IPC1-2024-1', 'EDD-2024-2', 'MAT1-2024-1', 'SO1-2025-1')
 ORDER BY tipo, code;


-- 2.5 · Asignaciones docente↔curso generadas por la carga.
--       El SP las crea ANTES de insertar la grabación, porque el trigger
--       trg_validate_teacher_course rechaza grabaciones de un docente
--       que no esté asignado al curso.
SELECT ct.course_id, c.code AS curso, ct.teacher_id AS docente_id, ct.created_at
  FROM course_teachers ct
  INNER JOIN courses c ON c.id = ct.course_id
 ORDER BY ct.course_id;


-- 2.6 · Resumen: cuántas clases por escuela
SELECT s.code AS escuela, s.name, COUNT(r.id) AS clases
  FROM recordings r
  INNER JOIN courses c ON c.id = r.course_id
  INNER JOIN schools s ON s.id = c.school_id
 GROUP BY s.code, s.name
 ORDER BY clases DESC;


-- ============================================================
-- BLOQUE 3 · PAGINACIÓN                 [ yousac_catalog_db ]
-- La función que pagina en la base. Se puede invocar directo
-- para demostrar que el trabajo lo hace PostgreSQL.
-- ============================================================

-- 3.1 · Página 1 — devuelve 10 filas y el total en total_count
SELECT recording_id, title, course_code, school_code, semester, year, total_count
  FROM fn_get_catalog_paginated(
         NULL,            -- p_user_id
         'administrador', -- p_role
         NULL,            -- p_semester_id
         NULL,            -- p_semester_name
         NULL,            -- p_school_id
         NULL,            -- p_course_id
         NULL,            -- p_teacher_id
         NULL,            -- p_year
         NULL,            -- p_tag
         NULL,            -- p_search
         1,               -- p_page
         10               -- p_limit
       );


-- 3.2 · Página 2
SELECT recording_id, title, course_code, total_count
  FROM fn_get_catalog_paginated(NULL,'administrador',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL, 2, 10);


-- 3.3 · EL TOPE LO IMPONE LA BASE
--       Se piden 500 por página y la función devuelve 10 igual.
SELECT COUNT(*) AS filas_devueltas
  FROM fn_get_catalog_paginated(NULL,'administrador',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL, 1, 500);


-- 3.4 · Filtro por escuela, manteniendo la paginación
--       (school_id = 1 es ECYS)
SELECT recording_id, title, school_code, total_count
  FROM fn_get_catalog_paginated(NULL,'administrador',NULL,NULL, 1, NULL,NULL,NULL,NULL,NULL, 1, 10);


-- 3.5 · Filtros COMBINADOS: escuela + docente + año
SELECT recording_id, title, school_code, teacher_id, year, total_count
  FROM fn_get_catalog_paginated(NULL,'administrador',NULL,NULL, 1, NULL, 4, 2025, NULL,NULL, 1, 10);


-- 3.6 · Alcance por rol: un estudiante solo ve los cursos donde está inscrito
--       (user_id 2 es el estudiante de prueba)
SELECT COUNT(*) AS clases_visibles_para_el_estudiante
  FROM fn_get_catalog_paginated(2, 'estudiante', NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL, 1, 10);


-- ============================================================
-- BLOQUE 4 · PROCEDIMIENTOS ALMACENADOS [ yousac_catalog_db ]
-- Por si pide ver que existen y qué hacen.
-- ============================================================

-- 4.1 · Listar todos los procedimientos de la práctica
SELECT p.proname AS procedimiento
  FROM pg_proc p
  INNER JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'p'
   AND p.proname LIKE 'sp_%'
 ORDER BY p.proname;


-- 4.2 · Listar las funciones
SELECT p.proname AS funcion
  FROM pg_proc p
  INNER JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND p.proname LIKE 'fn_%'
 ORDER BY p.proname;


-- 4.3 · Ver el código fuente del SP de la carga CSV, desde la propia base
SELECT prosrc
  FROM pg_proc
 WHERE proname = 'sp_import_recording_row';


-- 4.4 · Triggers activos
SELECT t.tgname AS trigger, c.relname AS tabla
  FROM pg_trigger t
  INNER JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal
 ORDER BY c.relname, t.tgname;


-- 4.5 · Vistas del catálogo
SELECT viewname AS vista
  FROM pg_views
 WHERE schemaname = 'public'
 ORDER BY viewname;


-- ============================================================
-- BLOQUE 5 · REINICIAR DATOS PARA LA DEMO [ yousac_catalog_db ]
-- Ejecutar SOLO si ya cargaste el CSV probando y querés
-- volver a demostrar la carga desde cero.
-- Los usuarios y roles NO se tocan.
-- ============================================================

-- DELETE FROM recordings;
-- DELETE FROM csv_import_errors;
-- DELETE FROM csv_import_batches;
-- DELETE FROM course_teachers;
