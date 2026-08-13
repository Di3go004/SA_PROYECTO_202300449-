# Práctica 3 — Entregables

Carpeta exigida por el enunciado: reúne el avance correspondiente a la Práctica 3
del proyecto **YoUSAC**.

| | |
|---|---|
| **Estudiante** | Diego González — 202300449 |
| **Versión** | `v0.3.0` |
| **Entrega** | 12 de agosto de 2026 |

## Contenido

| Ruta | Descripción |
|---|---|
| [`Informe_Practica3.md`](Informe_Practica3.md) | Informe técnico completo con índice, desarrollo, diagramas y conclusiones |
| [`sql/practica3_sps.sql`](sql/practica3_sps.sql) | **Entregable 2**: procedimientos almacenados de CRUD, ingesta CSV y paginación |
| [`sql/catalog_db.sql`](sql/catalog_db.sql) | Esquema del catálogo: semestres, auditoría de ingesta, vistas y triggers |
| [`sql/auth_db.sql`](sql/auth_db.sql) | Esquema de autenticación: roles y usuarios de prueba |
| [`samples/`](samples/) | Archivos CSV de ejemplo (uno limpio y uno con errores deliberados) |
| [`orquestacion/`](orquestacion/) | `docker-compose.local.yml` y configuración del servidor de medios |

## Sobre el código fuente

El código **no se duplica aquí**: vive en la raíz del repositorio, donde está
versionado y donde el `docker-compose.local.yml` lo espera. Duplicarlo generaría
dos copias que se desincronizarían al primer cambio.

| Componente | Ubicación en la raíz |
|---|---|
| Panel administrativo y carga CSV (React) | [`frontend/src/pages/admin/`](../frontend/src/pages/admin/) |
| Módulo de administración (NestJS) | [`catalog-service/src/admin/`](../catalog-service/src/admin/) |
| Módulo de ingesta CSV (NestJS) | [`catalog-service/src/import/`](../catalog-service/src/import/) |
| Rutas REST del panel (Express) | [`api-gateway/index.js`](../api-gateway/index.js) |
| Contratos gRPC | [`proto/`](../proto/) |

## Cómo levantar el proyecto

```bash
# Desde la raíz del repositorio
docker compose -f docker-compose.local.yml up -d --build
```

Frontend en http://localhost:5173

| Usuario | Rol | Contraseña |
|---|---|---|
| `admin@ingenieria.usac.edu.gt` | administrador | `Yousac2026!` |
| `catedratico@ingenieria.usac.edu.gt` | catedratico | `Yousac2026!` |
| `auxiliar@ingenieria.usac.edu.gt` | auxiliar | `Yousac2026!` |
| `estudiante@ingenieria.usac.edu.gt` | estudiante | `Yousac2026!` |

Para probar la carga masiva, subí `samples/clases_semestres_anteriores.csv` desde
la sección **Carga CSV** del panel.
