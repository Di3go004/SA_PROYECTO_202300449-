## 2. Requerimientos No Funcionales (RNF)

### Rendimiento

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-001 | El tiempo de respuesta de la API de autenticación no debe superar los 500 ms bajo carga normal | < 500 ms en el percentil 95 con hasta 100 usuarios concurrentes |
| RNF-002 | El catálogo debe cargar y renderizar los primeros 20 resultados en menos de 2 segundos | < 2 s medido desde la solicitud HTTP hasta el primer render en cliente |
| RNF-003 | El inicio de la reproducción de video (tiempo hasta el primer frame) no debe superar los 3 segundos en condiciones de red estándar | < 3 s con ancho de banda ≥ 5 Mbps |
| RNF-004 | El sistema debe soportar al menos 200 usuarios concurrentes reproduciéndose sin degradación perceptible del servicio | Latencia media < 1 s para APIs de catálogo y checkpoint con 200 sesiones activas |

### Disponibilidad y Tolerancia a Fallos

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-005 | El sistema debe garantizar una disponibilidad mínima del 99.5% mensual | Tiempo de inactividad no mayor a 3.6 horas por mes |
| RNF-006 | Cada microservicio debe implementar circuit breaker para aislar fallos sin propagar indisponibilidad al sistema completo | Tiempo de recuperación ante fallo de un servicio < 30 segundos |
| RNF-007 | El sistema debe mantener los checkpoints de reproducción sin pérdida de datos ante caída del servicio de reproducción | 0% de pérdida de checkpoints; respaldados en base de datos antes de confirmar respuesta al cliente |

### Seguridad

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-008 | Todas las comunicaciones entre cliente y servidor deben realizarse sobre HTTPS/TLS 1.2 o superior | 100% del tráfico cifrado; 0% de endpoints expuestos en HTTP plano |
| RNF-009 | Los tokens JWT deben tener una expiración máxima de 8 horas y deben ser invalidados al cerrar sesión | TTL ≤ 8 horas; lista de tokens revocados consultada en cada request |
| RNF-010 | El sistema debe validar el dominio del correo electrónico en el registro y login con una expresión regular estricta en el servidor | Rechazo del 100% de correos con dominio distinto al institucional en capa de backend |
| RNF-011 | Las contraseñas deben almacenarse con hash bcrypt con un factor de coste mínimo de 12 | Factor de coste ≥ 12; ninguna contraseña en texto plano en base de datos |

### Escalabilidad y Arquitectura

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-012 | Cada microservicio debe ser independientemente escalable mediante contenedores Docker | Capacidad de aumentar réplicas de un microservicio sin detener los demás |
| RNF-013 | La comunicación entre microservicios (east-west) debe realizarse exclusivamente mediante gRPC sobre HTTP/2 | 100% del tráfico inter-servicio vía gRPC; 0% llamadas REST entre microservicios |
| RNF-014 | Cada microservicio debe gestionar su propia base de datos sin acceso directo desde otros servicios | Patrón Database-per-Microservice: 3 bases de datos aisladas (PostgreSQL, MongoDB, MySQL) |

### Usabilidad

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-015 | La interfaz web debe ser responsiva y funcional en pantallas desde 360px (móvil) hasta 1920px (escritorio) | Compatible con los 3 breakpoints principales: móvil, tablet y escritorio |
| RNF-016 | El sistema debe mostrar mensajes de error descriptivos y orientados al usuario en español para todos los flujos de validación | 100% de los errores de negocio retornan mensaje legible en español; 0% de mensajes técnicos expuestos al usuario |

### Mantenibilidad

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-017 | Cada microservicio debe exponer un endpoint de health check (/health) que reporte su estado operativo | Tiempo de detección de servicio caído < 10 segundos mediante polling |
| RNF-018 | El código fuente de cada microservicio debe incluir cobertura de pruebas unitarias mínima del 70% en las capas de negocio | Cobertura ≥ 70% reportada por la herramienta de testing del lenguaje correspondiente |

### Caché y Tendencias

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-019 | Las consultas de tendencias servidas desde la caché deben responder en menos de 100 ms | < 100 ms en el percentil 95 con la clave presente en Redis |
| RNF-020 | Las entradas de caché deben expirar automáticamente según su volatilidad, sin intervención manual | TTL de 60 s para estadísticas globales, 120 s para métricas puntuales, 180 s para catálogo y 300 s para tendencias |
| RNF-021 | La indisponibilidad de la caché no debe interrumpir el servicio de consultas | 100% de las consultas siguen respondiendo con Redis detenido, degradando a la base de datos |
| RNF-022 | La caché debe operar con un techo de memoria fijo y descartar las claves menos usadas al alcanzarlo | Límite de 256 MB con política `allkeys-lru`; sin crecimiento ilimitado del proceso |
| RNF-023 | La invalidación de claves no debe bloquear el servidor de caché durante el recorrido del espacio de claves | Uso de `SCAN` iterativo en lugar de `KEYS`; sin bloqueo perceptible con 10.000 claves |

### Notificaciones

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-024 | El envío de correo no debe bloquear la operación que lo origina | El registro de un usuario responde en < 500 ms independientemente de la latencia del servidor SMTP |
| RNF-025 | Un fallo en el envío de correo no debe revertir ni impedir la operación de negocio asociada | 100% de los registros y publicaciones se completan con el servidor SMTP caído |
| RNF-026 | Cada notificación debe quedar registrada con trazabilidad individual por destinatario | Una fila por destinatario en la bitácora, con estado y motivo de fallo cuando corresponda |

### Procesamiento por Lotes

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-027 | Una fila inválida dentro de una carga masiva no debe invalidar las restantes | Aislamiento por fila mediante `SAVEPOINT`; el lote continúa tras cada error |
| RNF-028 | El reprocesamiento de un mismo archivo no debe generar registros duplicados | Idempotencia garantizada por índice único; segunda carga produce 0 inserciones |
| RNF-029 | El sistema debe procesar archivos CSV de hasta 10 MB | Límite verificado en la capa de recepción, con rechazo explícito por encima del umbral |

### Integración Continua y Despliegue

| ID | Requerimiento | Métrica |
|----|---------------|---------|
| RNF-030 | Todo cambio integrado debe superar la verificación automática de los cuatro lenguajes del backend | Pipeline con jobs independientes para TypeScript, Python, Go y orquestación; bloqueo del merge ante cualquier fallo |
| RNF-031 | Las credenciales y datos sensibles no deben residir en el repositorio | 0 credenciales literales en archivos versionados, verificado automáticamente en cada integración |
| RNF-032 | El ecosistema completo debe levantarse con un único comando en ambos entornos | `docker compose up -d --build` deja los 13 servicios operativos sin intervención manual |
| RNF-033 | Los contratos gRPC replicados por servicio deben mantenerse sincronizados | Verificación automática de las 12 copias contra el directorio `proto/` en cada integración |
