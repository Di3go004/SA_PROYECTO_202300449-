# YoUSAC — Plataforma de video académico

Proyecto del curso **Software Avanzado**, Segundo Semestre 2026.
Facultad de Ingeniería · Escuela de Ingeniería en Ciencias y Sistemas · USAC.

Diego González — 202300449 · versión actual `v0.3.0`

---

## Qué es

Plataforma de grabaciones de clases para la Facultad de Ingeniería. Arquitectura
de microservicios políglota, con el **API Gateway como único punto de entrada
REST** y **gRPC sobre HTTP/2 como único protocolo interno**.

```
Navegador ──REST──▶ API Gateway ──gRPC──▶ auth · catalog · reproduction · analytics
                                              │        │          │           │
                                          PostgreSQL         MongoDB       MySQL
```

## Arranque rápido

```bash
docker compose -f docker-compose.local.yml up -d --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Gateway | http://localhost:8080 |
| Servidor de medios | http://localhost:8081 |

Usuarios de prueba — contraseña `Yousac2026!` para todos:

| Correo | Rol |
|---|---|
| `admin@ingenieria.usac.edu.gt` | administrador |
| `catedratico@ingenieria.usac.edu.gt` | catedratico |
| `auxiliar@ingenieria.usac.edu.gt` | auxiliar |
| `estudiante@ingenieria.usac.edu.gt` | estudiante |

## Estructura

| Carpeta | Contenido |
|---|---|
| `api-gateway/` | Express · traduce REST ↔ gRPC · única puerta de entrada |
| `auth-service/` | NestJS · autenticación, usuarios y roles |
| `catalog-service/` | NestJS · catálogo, inscripciones, administración e ingesta CSV |
| `reproduction-service/` | Go · checkpoints, sesiones y calificaciones |
| `analytics-service/` | Python · métricas y reportes |
| `frontend/` | React + Vite · catálogo, reproductor y panel administrativo |
| `proto/` | Contratos gRPC (Protocol Buffers) |
| `DB/` | Esquemas SQL, procedimientos almacenados y CSV de ejemplo |
| `media/` | Servidor nginx con los `.mp4` de demostración |
| `Documentation/` | Informes técnicos, diagramas y casos de uso |
| `Practica3/` | Entregables de la Práctica 3 |

## Prácticas

| Práctica | Contenido | Entregables |
|---|---|---|
| 1 | Autenticación institucional, roles y sesiones | `Documentation/` |
| 2 | gRPC sobre HTTP/2, reproducción con checkpoints | `Documentation/` |
| 3 | Panel administrativo, RBAC, carga masiva CSV, paginación y SPs | [`Practica3/`](Practica3/) |

## Restricciones respetadas

- Tráfico interno **exclusivamente gRPC** con Protocol Buffers; ningún microservicio expone REST hacia otro (solo conservan `/health`).
- **Sin ORM ni BaaS**: acceso a datos con `pg` y SQL explícito.
- Las escrituras complejas se ejecutan **invocando procedimientos almacenados**.
- Todo el ecosistema se levanta con **`docker-compose.local.yml`**.

## Documentación

- [Informe Práctica 3](Documentation/Practica3/Informe_Practica3.md)
- [Vista 4+1](Documentation/Vista_4+1.md)
- [Requisitos funcionales](Documentation/RF.md) · [no funcionales](Documentation/RNF.md)
- [Casos de uso expandidos](Documentation/CDU/CDU_Expandidos.md)
