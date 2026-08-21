# redis/Dockerfile
# El enunciado exige un Dockerfile propio por cada componente, incluida la caché.
# Se parte de la imagen oficial y se hornea la configuración, de modo que la
# imagen quede autocontenida y no dependa de montar el .conf al desplegar.
FROM redis:7-alpine

LABEL servicio="yousac-cache" \
      descripcion="Caché de catálogo y tendencias para el servicio de Analítica"

COPY redis.conf /usr/local/etc/redis/redis.conf

EXPOSE 6379

# Arranca leyendo la configuración horneada en la imagen.
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
