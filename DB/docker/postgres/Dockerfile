# DB/docker/postgres/Dockerfile
# Motor de auth, catálogo y notificaciones.
#
# El enunciado exige un Dockerfile propio por componente, bases de datos
# incluidas. Se parte de la imagen oficial y se hornean los scripts de
# inicialización, de modo que la imagen quede autocontenida: al desplegarla en la
# nube no hace falta montar volúmenes de configuración ni copiar los .sql aparte.
#
# El contexto de build es DB/, no este directorio, porque los .sql viven allí.
FROM postgres:16-alpine

LABEL servicio="yousac-postgres" \
      descripcion="auth_db, catalog_db y notifications_db"

# docker-entrypoint-initdb.d ejecuta en orden alfabético y el orden importa: las
# bases antes que las tablas, y las tablas antes que los procedimientos.
COPY init_postgres.sql      /docker-entrypoint-initdb.d/00_init.sql
COPY auth_db.sql            /docker-entrypoint-initdb.d/01_auth.sql
COPY catalog_db.sql         /docker-entrypoint-initdb.d/02_catalog.sql
COPY practica3_sps.sql      /docker-entrypoint-initdb.d/03_practica3_sps.sql
COPY notifications_db.sql   /docker-entrypoint-initdb.d/04_notifications.sql
COPY proyecto_fase1_sps.sql /docker-entrypoint-initdb.d/05_proyecto_sps.sql

EXPOSE 5432
