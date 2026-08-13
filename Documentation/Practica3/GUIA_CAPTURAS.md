# Guía de capturas — Práctica 3

El informe ya tiene los `![](img/...)` puestos. Solo hay que tomar cada captura y
guardarla en `Documentation/Practica3/img/` **con el nombre exacto** de la
primera columna; el informe queda armado sin tocar nada más.

## Antes de empezar

```bash
# 1. Levantar todo desde cero (asegura datos limpios)
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d --build

# 2. Esperar a que los 10 contenedores estén healthy
watch -n 3 'docker ps --format "{{.Names}}\t{{.Status}}" | grep yousac'
```

Usuarios (contraseña `Yousac2026!` para todos):

| Correo | Rol |
|---|---|
| `admin@ingenieria.usac.edu.gt` | administrador |
| `catedratico@ingenieria.usac.edu.gt` | catedratico |
| `auxiliar@ingenieria.usac.edu.gt` | auxiliar |
| `estudiante@ingenieria.usac.edu.gt` | estudiante |

> Consejo: poné la ventana del navegador en ~1440 px de ancho y usá zoom 100 %.
> Para las capturas de terminal, ampliá la fuente antes de capturar.

---

## Bloque 1 · Panel administrativo (sección 11.1)

| Archivo | Qué capturar |
|---|---|
| `01-login.png` | `http://localhost:5173/login` — pantalla de inicio de sesión completa |
| `02-panel-resumen.png` | Tras entrar como **admin**: sección **Resumen**, con las tarjetas de conteo |
| `03-semestres.png` | Sección **Semestres**, tabla completa |
| `04-semestres-alta.png` | Botón *+ Nuevo semestre* → el modal abierto con el formulario |
| `05-escuelas.png` | Sección **Escuelas** |
| `06-cursos.png` | Sección **Cursos**, con los dos selectores de filtro visibles |
| `07-cursos-docentes.png` | En un curso, botón *Docentes* → modal con el docente asignado |
| `08-usuarios.png` | Sección **Usuarios**, mostrando los 4 roles distintos |
| `09-docentes.png` | Sección **Docentes** |
| `10-error-dependientes.png` | Sección **Escuelas** → *Eliminar* en ECYS → confirmar. **Capturar el toast rojo** con el mensaje del SP: *"No se puede eliminar la escuela: tiene N curso(s) asociado(s)"* |

> `10-error-dependientes.png` es la evidencia de que las reglas viven en la base
> y el mensaje llega literal al usuario. Es de las más valiosas del informe.

---

## Bloque 2 · RBAC (sección 11.2)

| Archivo | Qué capturar |
|---|---|
| `11-rbac-estudiante.png` | Cerrar sesión → entrar como **estudiante** → escribir `http://localhost:5173/admin` en la barra. Capturar cómo queda redirigido al catálogo, sin acceso al panel |

Opcionalmente, para reforzar la evidencia, podés capturar la salida de este
comando, que prueba las dos barreras desde la terminal:

```bash
# 403 con token de estudiante, 401 sin token
TOK=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"estudiante@ingenieria.usac.edu.gt","password":"Yousac2026!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -o /dev/null -w "estudiante → %{http_code}\n" \
  -H "Authorization: Bearer $TOK" http://localhost:8080/api/admin/semesters
curl -s -o /dev/null -w "sin token  → %{http_code}\n" \
  http://localhost:8080/api/admin/semesters
```

---

## Bloque 3 · Carga masiva CSV (sección 11.3)

Sección **Carga CSV** del panel.

| Archivo | Qué capturar |
|---|---|
| `12-csv-formato.png` | Botón *Ver formato requerido* → modal con la tabla de columnas |
| `13-csv-seleccion.png` | Arrastrar `DB/samples/clases_semestres_anteriores.csv` a la zona de carga, **antes** de procesar (se ve el nombre y el tamaño) |
| `14-csv-resultado.png` | Tras *Procesar archivo*: las 4 tarjetas con **12 insertadas, 0 omitidas, 0 con error** y el badge `COMPLETADO` |
| `15-csv-errores.png` | Cargar ahora `DB/samples/clases_con_errores.csv` → capturar el badge `COMPLETADO CON ERRORES` **y la tabla de errores por fila** |
| `16-csv-idempotencia.png` | Volver a cargar `clases_semestres_anteriores.csv` → **0 insertadas, 12 omitidas** |
| `17-csv-historial.png` | La tabla *Historial de cargas* con los 3 lotes |

> El orden importa: `14` antes de `16`, porque la idempotencia solo se demuestra
> si el archivo ya se cargó una vez.

---

## Bloque 4 · Registros en la base de datos (sección 11.4)

Capturas de terminal. Cada bloque es una captura.

**`18-db-grabaciones.png`**
```bash
docker exec -it yousac_postgres psql -U yousac -d yousac_catalog_db -c \
"SELECT r.id, r.title, c.code AS curso, c.semester, c.year, r.teacher_id
   FROM recordings r JOIN courses c ON c.id = r.course_id
  ORDER BY r.id LIMIT 12;"
```

**`19-db-lotes.png`**
```bash
docker exec -it yousac_postgres psql -U yousac -d yousac_catalog_db -c \
"SELECT id, filename, total_rows, inserted_rows, skipped_rows, failed_rows, status
   FROM csv_import_batches ORDER BY id;"
```

**`20-db-errores.png`**
```bash
docker exec -it yousac_postgres psql -U yousac -d yousac_catalog_db -c \
"SELECT batch_id, row_number, column_name, error_message
   FROM csv_import_errors ORDER BY id;"
```

**`21-db-cascada.png`** — entidades que creó el CSV solo:
```bash
docker exec -it yousac_postgres psql -U yousac -d yousac_catalog_db -c \
"SELECT 'escuelas' AS entidad, code, name FROM schools WHERE code = 'EIME'
 UNION ALL
 SELECT 'cursos', code, name FROM courses WHERE code IN ('IPC1-2024-1','EDD-2024-2','MAT1-2024-1');" \
-c "SELECT course_id, teacher_id FROM course_teachers ORDER BY course_id;"
```

---

## Bloque 5 · Paginación (sección 11.5)

Antes de capturar, entrá como **admin** al catálogo (`/catalog`) para ver todo el
catálogo, no solo los cursos inscritos.

| Archivo | Qué capturar |
|---|---|
| `22-paginacion-p1.png` | Catálogo en página 1. **Que se vea el pie**: *"Mostrando 1–10 de N · 10 por página"* y los botones de página |
| `23-paginacion-p2.png` | Página 2, con el `2` resaltado |
| `24-paginacion-p3.png` | Última página (incompleta, con menos de 10 tarjetas) |
| `25-paginacion-filtros.png` | Aplicar un filtro de escuela **y** uno de semestre a la vez; que se vea cómo el total y las páginas se recalculan |

Para demostrar que el tope de 10 lo impone la base aunque el cliente pida más,
podés capturar además esta salida:

```bash
TOK=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ingenieria.usac.edu.gt","password":"Yousac2026!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -H "Authorization: Bearer $TOK" \
  "http://localhost:8080/api/catalog?page=1&limit=500" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('filas devueltas:',len(d['data']),'| limit:',d['limit'],'| total:',d['total'])"
```

---

## Bloque 6 · Reproducción y despliegue (secciones 11.6 y 11.7)

| Archivo | Qué capturar |
|---|---|
| `26-reproductor.png` | Clic en cualquier tarjeta del catálogo → el video **reproduciéndose**, con los datos de la clase y el panel de calificación |
| `27-compose-ps.png` | Terminal con `docker compose -f docker-compose.local.yml ps` mostrando los 10 servicios |

---

## Checklist final

- [ ] Las 27 imágenes están en `Documentation/Practica3/img/`
- [ ] Los nombres coinciden exactamente (minúsculas, guiones, `.png`)
- [ ] El informe se ve bien en GitHub (las imágenes cargan)
- [ ] Ninguna captura muestra un token JWT completo ni datos personales reales
