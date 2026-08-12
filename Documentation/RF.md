# Requerimientos del Sistema - YoUSAC

## 1. Requerimientos Funcionales (RF)

### Módulo 1: Autenticación Institucional

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-001 | El sistema debe permitir el registro de usuarios únicamente con correos institucionales de los dominios @ingenieria.usac.edu.gt o @ing.usac.edu.gt | Alta |
| RF-002 | El sistema debe autenticar usuarios mediante correo institucional y contraseña, generando un JWT con expiración configurable | Alta |
| RF-003 | El sistema debe rechazar y notificar el intento de registro o login con cualquier dominio de correo distinto al institucional | Alta |
| RF-004 | El sistema debe soportar cierre de sesión (logout) que invalide el token JWT activo | Alta |
| RF-005 | El sistema debe implementar recuperación de contraseña mediante envío de enlace temporal al correo institucional | Media |
| RF-006 | El sistema debe bloquear temporalmente una cuenta tras 5 intentos fallidos consecutivos de autenticación | Media |
| RF-007 | El sistema debe diferenciar entre roles de usuario: Estudiante, Docente y Administrador, asignando permisos distintos a cada uno | Alta |
| RF-008 | El sistema debe mantener registro de auditoría de los inicios y cierres de sesión por usuario | Baja |

---

### Módulo 2: Catálogo y Búsqueda Académica

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-009 | El sistema debe mostrar un catálogo paginado de grabaciones de clases disponibles al usuario autenticado | Alta |
| RF-010 | El sistema debe permitir filtrar grabaciones por Semestre/Año (ej. Primer Semestre 2025) | Alta |
| RF-011 | El sistema debe permitir filtrar grabaciones por Escuela (Sistemas, Civil, Mecánica, etc.) | Alta |
| RF-012 | El sistema debe permitir filtrar grabaciones por nombre de Curso | Alta |
| RF-013 | El sistema debe permitir filtrar grabaciones por nombre del Catedrático que impartió la clase | Alta |
| RF-014 | El sistema debe permitir filtrar grabaciones por Temas o etiquetas asociadas al video | Media |
| RF-015 | El sistema debe permitir búsqueda de texto libre sobre título, descripción y temas de las grabaciones | Alta |
| RF-016 | El sistema debe mostrar en cada tarjeta del catálogo: miniatura, título, catedrático, curso, duración y porcentaje de recomendación | Media |
| RF-017 | El sistema debe ordenar los resultados del catálogo por relevancia, fecha de publicación o calificación promedio | Baja |
| RF-018 | El sistema debe mostrar únicamente las grabaciones de los cursos en los que el estudiante está inscrito, a menos que sea docente o administrador | Alta |

---

### Módulo 3: Reproductor y Checkpoint de Avance

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-019 | El sistema debe reproducir grabaciones de video en streaming bajo demanda (VOD) dentro de la plataforma web | Alta |
| RF-020 | El sistema debe registrar automáticamente el punto de reproducción (checkpoint) del usuario cada 30 segundos de reproducción | Alta |
| RF-021 | El sistema debe reanudar la reproducción desde el último checkpoint registrado cuando el usuario vuelva a acceder al mismo video | Alta |
| RF-022 | El sistema debe mostrar el porcentaje de avance del video basado en el último checkpoint registrado | Alta |
| RF-023 | El sistema debe permitir al usuario calificar una clase con una puntuación de 1 a 5 estrellas | Alta |
| RF-024 | El sistema debe calcular y mostrar dinámicamente el porcentaje de recomendación de cada video basado en el promedio de calificaciones recibidas | Alta |
| RF-025 | El sistema debe permitir al usuario dejar un comentario o reseña junto a su calificación | Media |
| RF-026 | El sistema debe permitir reproducción en diferentes resoluciones de video (720p, 1080p) adaptadas al ancho de banda disponible | Media |
| RF-027 | El sistema debe registrar eventos de reproducción: inicio, pausa, reanudación y finalización de cada sesión de visualización | Baja |

---

### Módulo 4: Panel de Asignaciones y Permisos

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-028 | El sistema debe permitir a un Administrador inscribir estudiantes en cursos específicos | Alta |
| RF-029 | El sistema debe permitir a un Docente subir y asociar grabaciones a un curso del que es catedrático | Alta |
| RF-030 | El sistema debe permitir a un Administrador asignar y revocar roles (Estudiante, Docente, Administrador) a los usuarios registrados | Alta |
| RF-031 | El sistema debe restringir el acceso a grabaciones de cursos en los que el estudiante no esté inscrito | Alta |
| RF-032 | El sistema debe mostrar al estudiante un panel con sus cursos inscritos y el estado de avance en cada uno | Alta |
| RF-033 | El sistema debe permitir al Administrador visualizar el listado completo de usuarios, cursos y asignaciones | Media |
| RF-034 | El sistema debe generar notificaciones al estudiante cuando se publique una nueva grabación en un curso inscrito | Baja |
| RF-035 | El sistema debe permitir al Docente ver estadísticas de visualización y calificaciones de sus grabaciones publicadas | Media |

---

