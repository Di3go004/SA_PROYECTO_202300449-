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
| RF-007 | El sistema debe diferenciar entre cuatro roles de usuario —Estudiante, Catedrático, Auxiliar y Administrador— asignando permisos distintos a cada uno | Alta |
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
| RF-029 | El sistema debe permitir a un Catedrático subir y asociar grabaciones a un curso del que es titular | Alta |
| RF-030 | El sistema debe permitir a un Administrador asignar y revocar roles (Estudiante, Catedrático, Auxiliar, Administrador) a los usuarios registrados | Alta |
| RF-031 | El sistema debe restringir el acceso a grabaciones de cursos en los que el estudiante no esté inscrito | Alta |
| RF-032 | El sistema debe mostrar al estudiante un panel con sus cursos inscritos y el estado de avance en cada uno | Alta |
| RF-033 | El sistema debe permitir al Administrador visualizar el listado completo de usuarios, cursos y asignaciones | Media |
| RF-034 | El sistema debe generar notificaciones al estudiante cuando se publique una nueva grabación en un curso inscrito | Baja |
| RF-035 | El sistema debe permitir al Catedrático ver estadísticas de visualización y calificaciones de sus grabaciones publicadas | Media |

---

### Módulo 5: Panel Administrativo y Carga Masiva

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-036 | El sistema debe ofrecer un panel web de administración accesible únicamente a los roles Administrador, Catedrático y Auxiliar | Alta |
| RF-037 | El sistema debe permitir la gestión CRUD de Semestres desde el panel administrativo | Alta |
| RF-038 | El sistema debe permitir la gestión CRUD de Escuelas/Áreas desde el panel administrativo | Alta |
| RF-039 | El sistema debe permitir la gestión CRUD de Cursos desde el panel administrativo | Alta |
| RF-040 | El sistema debe permitir asignar y desasignar Catedráticos y Auxiliares a un curso | Alta |
| RF-041 | El sistema debe impedir la eliminación de un Semestre, Escuela o Curso que tenga registros dependientes, informando la causa | Alta |
| RF-042 | El sistema debe permitir la carga masiva de grabaciones de semestres anteriores mediante archivos en formato CSV | Alta |
| RF-043 | El sistema debe crear automáticamente las Escuelas, Cursos y Semestres referenciados en el CSV que aún no existan | Media |
| RF-044 | El sistema debe descartar individualmente las filas inválidas de un CSV sin abortar el procesamiento del resto del archivo | Alta |
| RF-045 | El sistema debe registrar una bitácora de cada carga masiva con el total de filas leídas, insertadas, omitidas y fallidas | Alta |
| RF-046 | El sistema debe omitir las grabaciones ya existentes al reprocesar un mismo archivo CSV, evitando duplicados | Alta |
| RF-047 | El sistema debe reportar, para cada fila fallida de un CSV, el número de línea, la columna y el motivo del rechazo | Media |
| RF-048 | El sistema debe permitir publicar y despublicar grabaciones desde el panel administrativo | Alta |
| RF-049 | El sistema debe ejecutar toda escritura sobre entidades académicas mediante Procedimientos Almacenados | Alta |
| RF-050 | El sistema debe paginar el catálogo desde el servidor con un máximo de 10 clases por página, manteniendo la paginación al combinar filtros | Alta |

---

### Módulo 6: Analítica, Tendencias y Caché

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-051 | El sistema debe calcular el ranking de clases más vistas durante la semana en curso | Alta |
| RF-052 | El sistema debe calcular el ranking de clases mejor valoradas, excluyendo las que no alcancen un mínimo de valoraciones | Alta |
| RF-053 | El sistema debe identificar los cursos con mayor actividad de visualización como tendencia | Media |
| RF-054 | El sistema debe almacenar en caché las consultas más frecuentes de catálogo y tendencias con políticas de expiración (TTL) | Alta |
| RF-055 | El sistema debe invalidar las entradas de caché afectadas cuando se actualicen los datos que las originan | Alta |
| RF-056 | El sistema debe seguir respondiendo las consultas de tendencias aunque la caché no esté disponible, consultando la base de datos | Alta |
| RF-057 | El sistema debe exponer el estado de la caché —claves vivas, expiración y tasa de aciertos— para su verificación | Media |
| RF-058 | El sistema debe registrar periódicamente una instantánea semanal de visualizaciones que permita calcular tendencias temporales | Media |

---

### Módulo 7: Notificaciones por Correo

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-059 | El sistema debe enviar un correo de confirmación a la cuenta institucional al completarse un registro | Alta |
| RF-060 | El sistema debe notificar por correo a los estudiantes inscritos cuando se publique una nueva grabación en su curso | Alta |
| RF-061 | El sistema debe permitir al Administrador enviar avisos generales del sistema por correo | Media |
| RF-062 | El sistema debe rechazar el envío de correos a direcciones ajenas al dominio institucional | Alta |
| RF-063 | El sistema debe registrar una bitácora de cada notificación con su destinatario, estado de entrega y motivo de fallo | Alta |
| RF-064 | El sistema debe auditar automáticamente cada cambio de estado de una notificación | Media |
| RF-065 | El sistema debe completar la operación que origina un correo aunque el envío falle, sin revertirla | Alta |
| RF-066 | El sistema debe excluir de los envíos a las cuentas bloqueadas o inactivas | Media |

---
