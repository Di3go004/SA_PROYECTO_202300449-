# Diagramas fuente — YoUSAC

Código PlantUML de los diagramas del proyecto. Sirve de referencia para
reproducirlos en draw.io y mantenerlos actualizados.

> El entregable son los `.drawio.svg` de `Documentation/CDU/`, que son archivos
> editables y cumplen el requisito de subir los archivos crudos. Estos `.puml`
> son la fuente de la que se dibujan: describen sin ambigüedad qué entidades,
> relaciones y notas debe llevar cada diagrama.

## Cómo verlos

| Opción | Cómo |
|---|---|
| Navegador | Pegar el contenido en https://www.plantuml.com/plantuml/uml/ |
| VS Code | Extensión *PlantUML* (`jebbs.plantuml`), `Alt+D` para previsualizar |
| Línea de comandos | `plantuml -tsvg archivo.puml` |

Para dibujarlos en draw.io: abrir el diagrama, ver la vista previa del `.puml`
al lado y reproducirlo. draw.io también importa PlantUML directamente desde
**Extras → Editar diagrama**, aunque el resultado conviene reacomodarlo a mano.

## Vista previa

`render/` contiene los diagramas ya generados desde estos `.puml`. **No son el
entregable**: sirven de referencia visual para reproducirlos en draw.io y para
verificar de un vistazo que un cambio en el código no rompió el diagrama.

Para regenerarlos tras editar un `.puml`:

```bash
docker run --rm -v "$PWD":/data -w /data plantuml/plantuml:latest \
  -tsvg -o /data/render "*.puml"
```

## Contenido

| Archivo | Diagrama | Estado respecto de `Documentation/CDU/` |
|---|---|---|
| `01-componentes.puml` | Componentes | **Reemplaza** a `COMPONENTES.drawio.svg` — suma Redis, notificaciones y servidor de medios |
| `02-despliegue.puml` | Despliegue (GCP) | **Reemplaza** a `DESPLIEGUE.drawio.svg` — ahora sobre Compute Engine |
| `03-secuencia-carga-csv.puml` | Secuencia · carga masiva CSV | **Nuevo** |
| `04-secuencia-cache-redis.puml` | Secuencia · caché con Redis | **Nuevo** |
| `05-secuencia-notificaciones.puml` | Secuencia · aviso de nueva clase | **Nuevo** |
| `06-der.puml` | Entidad-Relación (4 bases) | **Reemplaza** a los `.svg` de DB/ — suma semestres, auditoría CSV, tendencias semanales y notificaciones |
| `07-casos-uso-alto-nivel.puml` | Casos de uso de alto nivel | **Reemplaza** a `Diagrama_Alto_Nivel.drawio.svg` — 4 roles y 26 casos de uso |
| `08-descomposicion-modulo5-admin.puml` | Descomposición · Módulo 5 | **Nuevo** |
| `09-descomposicion-modulo6-7.puml` | Descomposición · Módulos 6 y 7 | **Nuevo** |

Los diagramas de `Documentation/CDU/` que **no** aparecen acá siguen vigentes sin
cambios: `CU-01` a `CU-12`, `Descomposicion_Modulo1` a `Modulo4`, `ESCENARIO`,
`PAQUETES`, `SECUENCIA1` y `SECUENCIA2`.

## Qué cambió y por qué

**Cuatro roles en lugar de tres.** El proyecto exige Estudiante, Catedrático,
Auxiliar y Administrador. El rol `docente` pasó a `catedratico` conservando su
id, y se añadió `auxiliar`. Afecta a los diagramas de casos de uso.

**Dos microservicios nuevos.** `notification-service` (Python) y el servidor de
medios se suman a los cuatro existentes. Afecta a componentes y despliegue.

**Redis como capa de caché.** Aparece en componentes, despliegue y en su propio
diagrama de secuencia, que cubre los tres caminos: fallo de caché, acierto y
caída del servicio.

**Tres bases de PostgreSQL en lugar de dos.** Se suma
`yousac_notifications_db`, más las tablas nuevas de semestres, auditoría de
importación y tendencias semanales. Afecta al modelo entidad-relación.

**Comunicación entre microservicios.** Hasta la fase anterior todo el tráfico
nacía en el gateway. Ahora `catalog-service` llama a `auth-service` y a
`notification-service`, y `auth-service` llama a `notification-service`. Esas
flechas son nuevas en el diagrama de componentes.

## Convención de las referencias lógicas

En el modelo entidad-relación, las líneas punteadas entre paquetes distintos
representan **referencias lógicas**: se guarda el identificador de una entidad
que vive en otra base, pero no existe clave foránea porque el motor es distinto.
Se resuelven por gRPC en tiempo de ejecución.

Es la consecuencia directa del patrón *Database per Microservice*: `recordings`
guarda `teacher_id`, pero la fila del docente está en `yousac_auth_db` y solo
`auth-service` puede leerla.
