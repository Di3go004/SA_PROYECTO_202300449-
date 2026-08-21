# frontend/Dockerfile
# Imagen multi-etapa con dos destinos.
#
#   target: development → servidor de Vite con recarga en caliente (compose.local)
#   target: production  → build estático servido por nginx (compose.cloud)
#
# La distinción importa por cómo Vite maneja las variables de entorno: se
# resuelven en tiempo de COMPILACIÓN, no de ejecución. Con el servidor de
# desarrollo basta con pasarlas como variable del contenedor, pero en el build
# quedan horneadas en el bundle. Si la imagen se compila con localhost:8080 y
# luego se despliega en la nube, el navegador seguiría pidiendo a localhost sin
# dar ningún error visible. Por eso VITE_API_URL entra como ARG en la etapa de
# compilación y no como variable de entorno del contenedor final.

# ── Dependencias ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# ── Desarrollo ───────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host"]

# ── Compilación para producción ──────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Debe apuntar a la URL pública del gateway ANTES de compilar.
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

# ── Producción ───────────────────────────────────────────────
FROM nginx:alpine AS production

LABEL servicio="yousac-frontend" \
      descripcion="Cliente web compilado, servido como estatico"

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Comprueba que nginx sirva el index; 127.0.0.1 y no localhost porque dentro del
# contenedor localhost resuelve a ::1 y nginx solo escucha en IPv4.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/ || exit 1
