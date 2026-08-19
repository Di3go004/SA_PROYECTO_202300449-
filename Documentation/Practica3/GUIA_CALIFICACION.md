# Guía de calificación — Práctica 3

Guion para la sustentación. Cubre los cuatro puntos que pidió el auxiliar, con las
rutas exactas, los comandos ya probados y las salidas que deberías ver.

> **Todos los comandos de este documento fueron ejecutados y verificados.** Las
> salidas que aparecen son reales, no ejemplos inventados.

---

## Preparación (5 minutos antes)

```bash
cd ~/Escritorio/USAC/9no_Semestre/SA/proyecto/SA_PROYECTO_202300449-

# Levantar todo desde cero
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d --build
```

El `--build` puede tardar **3–5 minutos** la primera vez. Esperá a ver los 10
contenedores en verde antes de empezar:

```bash
docker compose -f docker-compose.local.yml ps
```

Deben aparecer los 10: `postgres`, `mongodb`, `mysql`, `media`, `auth`,
`catalog`, `reproduction`, `analytics`, `gateway`, `frontend`.

Dejá abiertas **tres ventanas**:

| Ventana | Para qué |
|---|---|
| Navegador en `http://localhost:5173` | Demo de la aplicación |
| Editor con el proyecto | Mostrar el código |
| Terminal o DBeaver | Consultas a la base de datos |

**Credenciales de la aplicación** — contraseña `Yousac2026!` para todos:

| Correo | Rol |
|---|---|
| `admin@ingenieria.usac.edu.gt` | administrador |
| `catedratico@ingenieria.usac.edu.gt` | catedratico |
| `auxiliar@ingenieria.usac.edu.gt` | auxiliar |
| `estudiante@ingenieria.usac.edu.gt` | estudiante |

### Conexión desde DBeaver

Los contenedores publican sus puertos al host, así que DBeaver se conecta a
`localhost` normalmente. **Los servicios deben estar levantados.**

#### PostgreSQL — es la que se usa en la calificación

Aquí viven los usuarios, los roles y todo el catálogo. Son **dos bases distintas
en el mismo servidor**, así que conviene crear dos conexiones.

| Campo | `yousac_auth_db` | `yousac_catalog_db` |
|---|---|---|
| Driver | PostgreSQL | PostgreSQL |
| Host | `localhost` | `localhost` |
| Puerto | `5432` | `5432` |
| Base de datos | `yousac_auth_db` | `yousac_catalog_db` |
| Usuario | `yousac` | `yousac` |
| Contraseña | `yousac_secret` | `yousac_secret` |

| Base | Qué contiene |
|---|---|
| `yousac_auth_db` | `users`, `roles`, `audit_logs`, vista `vw_users_with_role` — **el punto 4** |
| `yousac_catalog_db` | `semesters`, `schools`, `courses`, `recordings`, `csv_import_batches` — **los puntos 1 y 2** |

> Si DBeaver ofrece descargar el driver, aceptá.
> En la pestaña **PostgreSQL** de la conexión, activá **«Show all databases»**
> para ver las dos bases desde una sola conexión.

#### MySQL — analítica (no se usa en esta práctica)

| Campo | Valor |
|---|---|
| Driver | MySQL |
| Host | `localhost` |
| Puerto | `3306` |
| Base de datos | `yousac_analytics_db` |
| Usuario | `yousac` |
| Contraseña | `yousac_secret` |
| Usuario root | `root` / `yousac_root` |

> Si falla con *«Public Key Retrieval is not allowed»*: en **Driver properties**
> poné `allowPublicKeyRetrieval = true` y `useSSL = false`.

#### MongoDB — reproducción (no se usa en esta práctica)

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `27017` |
| Base de datos | `yousac_reproduction_db` |
| Usuario | `yousac` |
| Contraseña | `yousac_secret` |
| **Authentication Database** | `admin` |

> El `authSource=admin` es obligatorio: el usuario se creó en `admin`, no en
> `yousac_reproduction_db`. Sin eso la autenticación falla.
>
> Cadena equivalente:
> `mongodb://yousac:yousac_secret@localhost:27017/yousac_reproduction_db?authSource=admin`

#### Consultas listas

El archivo **`Documentation/Practica3/consultas_calificacion.sql`** trae las 22
consultas de esta guía ya escritas, agrupadas por bloque. Abrilo en DBeaver y
dejá la del punto 4 en una pestaña, lista para ejecutar cuando la pidan.

---

## Punto 1 · Dónde está la paginación en el backend

> «Enseñar dónde está la paginación en el backend, dónde la hacen.»

La respuesta corta que conviene dar primero:

> **La paginación se resuelve en la base de datos, en la función
> `fn_get_catalog_paginated`. El microservicio no pagina en memoria: le pasa los
> filtros y la página, y la base devuelve solo esas diez filas más el total.**

### 1.1 Dónde está — recorrido de arriba hacia abajo

Mostralo en este orden, que es el camino que recorre la petición:

| Paso | Archivo | Línea | Qué mostrar |
|---|---|---|---|
| 1 | `api-gateway/index.js` | **260** | La ruta REST `GET /api/catalog` que recibe `page` y los filtros |
| 2 | `catalog-service/src/catalog/catalog.controller.ts` | **14** | El método gRPC `GetCatalog` |
| 3 | `catalog-service/src/catalog/catalog.service.ts` | **27** | `getCatalog()` — **acá se ve que solo llama a la función SQL** |
| 4 | `DB/practica3_sps.sql` | **627** | `fn_get_catalog_paginated` — **acá ocurre la paginación real** |

### 1.2 Las tres líneas que hay que señalar en el SQL

Abrí `DB/practica3_sps.sql` y mostrá estas tres:

**Línea 669 — el máximo de 10 lo impone la base, no el cliente**

```sql
v_limit  := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 10);
v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * v_limit;
```

> Si preguntan por qué acá y no en el microservicio: porque así el requisito se
> cumple aunque el cliente pida `limit=500`. Lo demostramos en el punto 1.4.

**Línea 693 — el total sale en la misma consulta**

```sql
COUNT(*) OVER () AS total_count
```

> `COUNT(*) OVER()` se evalúa **después del `WHERE` y antes del `LIMIT`**, así que
> devuelve el total de resultados filtrados en la misma pasada. Evita mantener una
> segunda función de conteo cuyo `WHERE` podría quedar desincronizado.

**Líneas 700–720 — los filtros combinables**

```sql
AND (p_semester_id   IS NULL OR cat.semester_id = p_semester_id)
AND (p_school_id     IS NULL OR cat.school_id   = p_school_id)
AND (p_course_id     IS NULL OR cat.course_id   = p_course_id)
AND (p_teacher_id    IS NULL OR cat.teacher_id  = p_teacher_id)
```

> Cada filtro es *NULL-safe*: si el parámetro viene nulo, esa condición no filtra.
> Por eso se combinan sin construir SQL concatenando texto, y sin exposición a
> inyección.

### 1.3 En el microservicio: que se vea que NO pagina en memoria

`catalog-service/src/catalog/catalog.service.ts`, línea 27. Lo importante es que
el método **solo arma la llamada**:

```ts
const result = await this.db.query(
  `SELECT * FROM fn_get_catalog_paginated($1, $2, ..., $11, $12)`,
  [user.sub, user.role, ..., pagination.page, pagination.limit],
)
```

No hay `.slice()`, no hay filtrado en JavaScript. Todo lo decide la base.

### 1.4 Demostración de que el tope lo impone la base

```bash
TOK=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ingenieria.usac.edu.gt","password":"Yousac2026!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# El cliente pide 500 por página
curl -s -H "Authorization: Bearer $TOK" \
  "http://localhost:8080/api/catalog?page=1&limit=500" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('filas:',len(d['data']),'| limit:',d['limit'],'| total:',d['total'])"
```

Salida verificada:

```
filas: 10 | limit: 10 | total: 28
```

> **Aunque el cliente pidió 500, la base devolvió 10.**

También podés demostrarlo desde DBeaver con la consulta **3.3** del `.sql`.

---

## Punto 2 · Dónde está el SP de la carga CSV

> «Enseñar dónde está el SP de la carga CSV en su `.sql`.»

Archivo: **`DB/practica3_sps.sql`**

### 2.1 Los cuatro procedimientos de la carga

| Procedimiento | Línea | Qué hace |
|---|---|---|
| `sp_start_import_batch` | **401** | Abre el lote y devuelve su id |
| **`sp_import_recording_row`** | **432** | **El principal: procesa UNA fila del CSV** |
| `sp_log_import_error` | **551** | Registra la fila que falló y por qué |
| `sp_finish_import_batch` | **567** | Cierra el lote y calcula el estado final |

El que hay que abrir es **`sp_import_recording_row`, línea 432**.

### 2.2 Qué explicar de ese SP

Tiene tres cosas que conviene señalar:

**a) Resuelve en cascada antes de insertar** (líneas ~490–530):

```
escuela → semestre → curso → asignación docente → grabación
```

> El orden **no es opcional**. El trigger `trg_validate_teacher_course` rechaza
> cualquier grabación cuyo docente no esté ya asignado al curso. Si insertáramos
> antes de asignar, fallarían todas las filas.

**b) Es idempotente** (línea ~478):

```sql
SELECT id INTO p_recording_id FROM recordings WHERE video_url = btrim(p_video_url);
IF p_recording_id IS NOT NULL THEN
    p_status := 'OMITIDO';
    RETURN;
END IF;
```

> Recargar el mismo archivo no duplica nada: cuenta las filas como omitidas.

**c) Valida y rechaza con mensaje** (líneas ~450–475):

```sql
IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'El título de la grabación es obligatorio';
END IF;
```

### 2.3 Dónde se invoca desde el microservicio

`catalog-service/src/import/import.service.ts`:

| Línea | Qué |
|---|---|
| **69** | `this.db.withTransaction(...)` — abre la transacción del lote |
| **170** | `SAVEPOINT fila_actual` |
| **173** | `CALL sp_import_recording_row(...)` |
| **194** | `RELEASE SAVEPOINT` si la fila entró |
| **198** | `ROLLBACK TO SAVEPOINT` si falló |

### 2.4 La pregunta que probablemente te hagan

**«¿Por qué un SAVEPOINT por cada fila?»**

> Porque los SPs reportan los errores con `RAISE EXCEPTION`, y en PostgreSQL una
> excepción deja **toda la transacción** abortada. Sin `SAVEPOINT`, la primera fila
> mala invalidaría todas las siguientes y se perdería el lote completo. Con
> `SAVEPOINT` se revierte solo esa fila, se registra el error y el proceso continúa;
> al final un único `COMMIT` publica todo lo que sí entró.

Lo demostramos en vivo en el punto 3.4.

### 2.5 Si pide ver el SP desde la propia base

Consulta **4.3** del `.sql`:

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'sp_import_recording_row';
```

---

## Punto 3 · Demo en la aplicación

> «Ingresar como admin, hacer una carga masiva, ver el catálogo con paginación,
> aplicar filtros y ver que funcionen.»

### 3.1 Ingresar como administrador

1. `http://localhost:5173`
2. `admin@ingenieria.usac.edu.gt` / `Yousac2026!`
3. Entra directo al **panel de administración** (el login enruta según el rol)

> Si preguntan por el RBAC: cerrá sesión, entrá como `estudiante@…` e intentá ir
> a `http://localhost:5173/admin`. Queda redirigido al catálogo.

### 3.2 Carga masiva

1. Barra lateral → **Carga CSV**
2. *(Opcional)* **Ver formato requerido** — muestra la tabla de columnas
3. Arrastrá **`DB/samples/clases_demo_calificacion.csv`**
4. **Procesar archivo**

Resultado verificado:

```
28 leídas · 28 insertadas · 0 omitidas · 0 errores → COMPLETADO
```

> Este archivo tiene 28 clases repartidas en 3 escuelas, 5 cursos y 2 docentes,
> pensado para que **los filtros también muestren varias páginas**.

### 3.3 Idempotencia (buen detalle para sumar)

Volvé a cargar **el mismo archivo**. Resultado:

```
28 leídas · 0 insertadas · 28 omitidas · 0 errores → COMPLETADO
```

> «Reprocesar el mismo archivo no duplica nada porque el SP verifica `video_url`
> contra un índice único.»

### 3.4 Tolerancia a errores (opcional, pero luce mucho)

Cargá **`DB/samples/clases_con_errores.csv`**: 6 filas, 4 con errores deliberados.

Resultado: **2 insertadas, 4 con error**, estado `COMPLETADO_CON_ERRORES`, y una
tabla que dice fila por fila qué pasó:

| Fila | Error |
|---|---|
| 3 | Correo que no pertenece a ningún docente registrado |
| 4 | `Año inválido: 1850` |
| 5 | Un **estudiante** puesto como docente → rechazado |
| 6 | `El título de la grabación es obligatorio` |

> **Las 2 filas buenas se guardaron igual.** Ésa es la prueba visual del SAVEPOINT.

### 3.5 Catálogo con paginación

Barra lateral → **Ver catálogo** (o `http://localhost:5173/catalog`)

Al pie de la página se ve: *«Mostrando 1–10 de 28 · 10 por página»* y los botones.

Verificado:

| Página | Clases mostradas |
|---|---|
| 1 | 10 |
| 2 | 10 |
| 3 | **8** |

> Señalá que **son 10 por página como máximo** y que la última trae solo las que
> quedan.

### 3.6 Filtros manteniendo la paginación

Éste es el punto que pide el enunciado: *«manteniendo activa la paginación al
aplicar filtros combinados»*.

Probá estos, todos verificados:

| Filtro en la interfaz | Resultado | Páginas |
|---|---|---|
| Escuela: **Ciencias y Sistemas** | 18 clases | **2 páginas** |
| Escuela: **Ingeniería Civil** | 6 clases | 1 página |
| Buscar: `arboles` | 1 clase | 1 página |

> Lo importante: **aplicá el filtro de escuela ECYS y navegá a la página 2**. Eso
> demuestra que la paginación sigue viva con el filtro puesto — no que el filtro
> reemplace a la paginación.

Si querés respaldarlo por API:

```bash
curl -s -H "Authorization: Bearer $TOK" \
  "http://localhost:8080/api/catalog?school_id=1&page=2" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('filas:',len(d['data']),'| total:',d['total'],'| páginas:',d['total_pages'])"
```

```
filas: 8 | total: 18 | páginas: 2
```

### 3.7 Reproducción (por si lo piden)

Clic en cualquier tarjeta → el video reproduce. Son archivos reales servidos por
el contenedor `media-server` en el puerto 8081.

---

## Punto 4 · Consulta a la base de datos: usuarios CON sus roles

> «Quería ver que los usuarios sí tuvieran roles. Me bajó puntos porque enseñé la
> tabla `roles` y la tabla `usuarios` por separado, no hice el JOIN.»

**Ésta es la consulta que hay que mostrar.** Un solo resultado donde cada usuario
aparece junto a su rol. Base: **`yousac_auth_db`**.

### 4.1 Consulta principal — mostrá ésta

```sql
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
```

Desde la terminal, si preferís:

```bash
docker exec -it yousac_postgres psql -U yousac -d yousac_auth_db -c "
SELECT u.id, u.full_name AS nombre, u.email AS correo,
       r.id AS rol_id, r.name AS rol, u.is_active AS activo, u.is_blocked AS bloqueado
  FROM users u INNER JOIN roles r ON r.id = u.role_id ORDER BY r.id, u.id;"
```

Salida verificada:

```
 id |        nombre         |               correo               | rol_id |      rol      | activo | bloqueado
----+-----------------------+------------------------------------+--------+---------------+--------+-----------
  1 | Administrador YoUSAC  | admin@ingenieria.usac.edu.gt       |      1 | administrador | t      | f
  2 | Estudiante de Prueba  | estudiante@ingenieria.usac.edu.gt  |      2 | estudiante    | t      | f
  3 | Catedrático de Prueba | catedratico@ingenieria.usac.edu.gt |      3 | catedratico   | t      | f
  4 | Auxiliar de Prueba    | auxiliar@ingenieria.usac.edu.gt    |      4 | auxiliar      | t      | f
(4 rows)
```

> **Qué decir:** «El `INNER JOIN` entre `users` y `roles` por `role_id` muestra cada
> usuario con su rol en una sola tabla. Los cuatro roles del sistema están
> representados.»

### 4.2 Si pide ver también la descripción del rol

```sql
SELECT u.full_name AS nombre, r.name AS rol, r.description AS que_puede_hacer
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
 ORDER BY r.id;
```

### 4.3 Si pregunta cuántos usuarios hay por rol

Un `LEFT JOIN`, para que aparezcan también los roles sin usuarios:

```sql
SELECT r.id, r.name AS rol, COUNT(u.id) AS usuarios
  FROM roles r
  LEFT JOIN users u ON u.role_id = r.id
 GROUP BY r.id, r.name
 ORDER BY r.id;
```

### 4.4 Dato extra que suma: el backend usa ese mismo JOIN

El proyecto no arma ese `JOIN` solo para la demo — lo tiene encapsulado en una
vista que el microservicio consulta de verdad:

```sql
SELECT id, full_name, email, role_name, is_active, is_blocked
  FROM vw_users_with_role
 ORDER BY id;
```

Y para mostrar la definición de la vista, es decir el `JOIN` que hay detrás:

```sql
-- Esta sí funciona en DBeaver (\d+ es un comando de psql, no SQL)
SELECT pg_get_viewdef('vw_users_with_role', true);
```

Desde la terminal, el equivalente corto:

```bash
docker exec -it yousac_postgres psql -U yousac -d yousac_auth_db -c "\d+ vw_users_with_role"
```

> «El backend nunca consulta `users` sin el rol: usa `vw_users_with_role`, que ya
> resuelve el `JOIN`. Está en `auth-service/src/users/users.service.ts`.»

---

## Consultas de respaldo (por si pregunta más)

Todas están en `consultas_calificacion.sql`. Las más útiles:

### Grabaciones con su curso, escuela y semestre — `yousac_catalog_db`

```sql
SELECT r.id, LEFT(r.title,32) AS clase, c.code AS curso,
       s.code AS escuela, sem.name || ' ' || sem.year AS semestre, r.teacher_id
  FROM recordings r
  INNER JOIN courses   c   ON c.id   = r.course_id
  INNER JOIN schools   s   ON s.id   = c.school_id
  INNER JOIN semesters sem ON sem.id = c.semester_id
 ORDER BY r.id LIMIT 10;
```

### Bitácora de las cargas CSV

```sql
SELECT id, filename, total_rows, inserted_rows, skipped_rows, failed_rows, status
  FROM csv_import_batches ORDER BY id;
```

### Errores por fila

```sql
SELECT batch_id, row_number, column_name, error_message
  FROM csv_import_errors ORDER BY id;
```

### Listar los procedimientos almacenados

```sql
SELECT p.proname AS procedimiento
  FROM pg_proc p INNER JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prokind = 'p' AND p.proname LIKE 'sp_%'
 ORDER BY 1;
```

---

## Otras preguntas probables

**«¿Dónde está el control de acceso por roles?»**
Tres niveles: `AdminRoute` en `frontend/src/App.tsx:21` (solo oculta la pantalla),
`requireAdminRole` en `api-gateway/index.js:113`, y `GrpcRolesGuard` en
`catalog-service/src/admin/admin.controller.ts:21`. El real es el último: el
microservicio revalida porque su puerto gRPC está publicado y el gateway no es su
único interlocutor posible.

**«¿Usaron algún ORM?»**
No. Acceso con `pg` y SQL explícito. Las escrituras van por procedimientos
almacenados.

**«¿Cómo se comunican los microservicios?»**
Solo gRPC con Protocol Buffers (`proto/`). Ningún microservicio expone REST hacia
otro; solo conservan `/health`. Un ejemplo concreto: durante la carga CSV,
`catalog-service` llama a `auth-service` por gRPC para resolver los correos de los
docentes a `teacher_id`, porque los usuarios viven en la otra base de datos.

**«¿Por qué el rol se llama `catedratico` y no `docente`?»**
Porque la práctica pide Administrador / Catedrático / Auxiliar. Se renombró
conservando el id 3 para no invalidar las referencias existentes.

---

## Checklist de 2 minutos antes de entrar

- [ ] `docker compose ps` → los 10 contenedores arriba
- [ ] `http://localhost:5173` carga
- [ ] Sesión iniciada como admin
- [ ] `DB/practica3_sps.sql` abierto en el editor
- [ ] `catalog-service/src/catalog/catalog.service.ts` abierto
- [ ] `catalog-service/src/import/import.service.ts` abierto
- [ ] DBeaver conectado a `yousac_auth_db` con la consulta 4.1 en una pestaña
- [ ] Base **limpia** si vas a demostrar la carga (ver abajo)

### Reiniciar los datos para la demo

Si ya cargaste el CSV probando y querés volver a mostrarlo desde cero:

```sql
-- Sobre yousac_catalog_db
DELETE FROM recordings;
DELETE FROM csv_import_errors;
DELETE FROM csv_import_batches;
DELETE FROM course_teachers;
```

Los usuarios y roles no se tocan.
