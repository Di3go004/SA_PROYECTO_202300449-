# media/Dockerfile
# Servidor de medios: entrega los .mp4 del catálogo.
#
# En un despliegue real esto sería un CDN o un bucket de objetos. Acá se hornea
# la configuración y los archivos en la imagen para que el reproductor tenga
# contenido que servir sin depender de una red externa durante la demostración.
FROM nginx:alpine

LABEL servicio="yousac-media" \
      descripcion="Servidor estatico de grabaciones con soporte de rangos HTTP"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY videos/    /usr/share/nginx/media/

EXPOSE 80
