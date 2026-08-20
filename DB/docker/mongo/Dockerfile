# DB/docker/mongo/Dockerfile
# Motor de reproducción: checkpoints, sesiones y calificaciones.
#
# Documental y no relacional a propósito: los checkpoints son escrituras muy
# frecuentes de un documento pequeño por usuario y video, sin relaciones que
# justifiquen un motor SQL.
# El contexto de build es DB/, donde vive el script.
FROM mongo:7

LABEL servicio="yousac-mongodb" \
      descripcion="Checkpoints, sesiones de reproduccion y ratings"

COPY reproduction_mongodb.js /docker-entrypoint-initdb.d/init.js

EXPOSE 27017
