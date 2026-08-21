# DB/docker/mysql/Dockerfile
# Motor de la analítica académica.
# El contexto de build es DB/, donde vive el script.
FROM mysql:8

LABEL servicio="yousac-mysql" \
      descripcion="Metricas, tendencias semanales y reportes"

COPY analytics_mysql.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 3306
