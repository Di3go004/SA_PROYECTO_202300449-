# Despliegue en Google Cloud Platform — YoUSAC

Guía del entorno cloud del proyecto. Cubre desde la activación de la cuenta hasta
dejar el ecosistema corriendo con `docker-compose.cloud.yml`.

---

## Índice

1. [Activar los créditos gratuitos](#1-activar-los-créditos-gratuitos)
2. [Crear el proyecto](#2-crear-el-proyecto)
3. [Proteger el presupuesto](#3-proteger-el-presupuesto)
4. [Crear la máquina virtual](#4-crear-la-máquina-virtual)
5. [Abrir los puertos](#5-abrir-los-puertos-reglas-de-firewall)
6. [Instalar Docker en la VM](#6-instalar-docker-en-la-vm)
7. [Desplegar YoUSAC](#7-desplegar-yousac)
8. [Verificación](#8-verificación)

---

## 1. Activar los créditos gratuitos

Google ofrece **USD 300 por 90 días** para cuentas nuevas.

### Qué necesitás a mano

| Requisito | Detalle |
|---|---|
| Cuenta de Google | Puede ser tu Gmail personal |
| Tarjeta de crédito o débito | **Solo para verificar identidad.** Google hace un cargo temporal de ~USD 1 que se reversa |
| Teléfono | Puede pedir verificación por SMS |

> **No te cobran al terminar los créditos.** Al agotarse o vencer los 90 días, los
> servicios simplemente se detienen. Para que Google cobre hay que activar
> manualmente la cuenta de pago completa, y esa opción **no** se toca.

### Pasos

1. Entrá a **https://cloud.google.com/free** y hacé clic en **«Comenzar gratis»**
   (o *«Empezar gratis»* / *«Get started for free»*).

2. **Paso 1 de 2 — País y términos**
   - País: **Guatemala**
   - Tipo de cuenta / propósito: personal o estudiante
   - Aceptá los Términos del Servicio → **Continuar**

3. **Paso 2 de 2 — Verificación de identidad**
   - Puede pedirte verificar tu número por SMS
   - Datos del perfil de pago: **Tipo de cuenta = Individual**
   - Nombre y dirección: poné los mismos que figuran en el estado de cuenta de la
     tarjeta. Si no coinciden, es la causa más común de rechazo
   - Ingresá la tarjeta → **Comenzar mi prueba gratuita**

4. Al terminar caés en la consola con un banner que dice cuántos créditos te
   quedan y cuántos días. Ese banner es tu confirmación.

### ⚠️ No uses la cuenta institucional

**La causa más común de bloqueo, y la menos evidente.**

Si te registrás con la cuenta `@ingenieria.usac.edu.gt`, Google crea el perfil de
pagos como **Organización** vinculado a la Universidad, y no como Individual. El
síntoma es inconfundible:

- En «Información de contacto» aparece *«Universidad San Carlos de Guatemala ·
  Organización»*
- **Todas** las tarjetas que agregues quedan en *«Se requiere verificación»*
- El botón *«Comenzar gratis»* permanece deshabilitado

No es un problema de la tarjeta: un perfil de Organización exige verificación
documental de la entidad, y además el administrador del dominio de la USAC
normalmente tiene bloqueada la facturación para las cuentas del dominio.

**Solución:** registrarse con una **cuenta de Gmail personal** y elegir
**Tipo de cuenta = Individual** en el Paso 2.

Google **no permite convertir** un perfil de Organización en Individual una vez
creado, así que no sirve intentar corregirlo desde la misma cuenta.

> Que la cuenta de GCP sea personal no afecta al proyecto. La validación de
> dominio institucional que pide el enunciado ocurre **dentro de la aplicación**
> (`auth-service` rechaza correos fuera de `@ingenieria.usac.edu.gt` /
> `@ing.usac.edu.gt`), y es independiente de con qué cuenta se paga la nube.

### Si la tarjeta es rechazada

Descartado ya lo anterior, es frecuente con tarjetas guatemaltecas. En orden de
probabilidad de éxito:

1. **Usá una tarjeta de crédito, no de débito.** Google rechaza muchas débito.
2. **Habilitá compras internacionales** desde la app de tu banco. Suele estar
   desactivado por defecto.
3. **Verificá que la dirección coincida** exactamente con la del banco.
4. **Probá otro navegador o modo incógnito**, sin VPN ni bloqueadores.
5. Si nada funciona, pedí prestada una tarjeta a un familiar: la cuenta queda a
   nombre de tu correo, la tarjeta es solo verificación.

---

## 2. Crear el proyecto

Un «proyecto» en GCP agrupa todos los recursos y su facturación.

1. En la consola, arriba a la izquierda, hacé clic en el selector de proyecto
2. **«Proyecto nuevo»**
3. Nombre: `yousac-sa-202300449`
4. **Crear**, y esperá a que aparezca seleccionado arriba

> Anotá el **ID del proyecto** (no el nombre): lo genera Google y puede llevar un
> sufijo numérico. Lo vas a necesitar en los comandos.

---

## 3. Proteger el presupuesto

Dos minutos que evitan sustos. Hacelo antes de crear nada.

1. Menú ☰ → **Facturación** → **Presupuestos y alertas**
2. **Crear presupuesto**
3. Nombre: `alerta-yousac`, importe: **USD 50**
4. Marcá alertas al **50%, 90% y 100%**
5. **Finalizar**

Te llega correo si el gasto se dispara. Con la VM que usa este proyecto el
consumo real ronda los USD 25–30 al mes, así que los créditos alcanzan de sobra.

---

## 4. Crear la máquina virtual

El proyecto levanta 11 contenedores, así que se despliega sobre una VM de Compute
Engine con Docker Compose. Es la vía más directa: la misma topología que corre en
local, sin reescribir nada para servicios administrados.

1. Menú ☰ → **Compute Engine** → **Instancias de VM**
   (la primera vez pide habilitar la API: aceptá y esperá ~1 minuto)

2. **Crear instancia** con estos valores:

| Campo | Valor | Por qué |
|---|---|---|
| Nombre | `yousac-server` | |
| Región | `us-central1` | De las más baratas y cercana a Guatemala |
| Zona | `us-central1-a` | |
| Serie | `E2` | |
| Tipo de máquina | **`e2-standard-4`** (4 vCPU, 16 GB) | 11 contenedores con 3 bases de datos no entran en 4 GB |
| Disco de arranque | Ubuntu **22.04 LTS**, **50 GB**, tipo Balanced | Las imágenes de Docker ocupan bastante |
| Firewall | ✅ Permitir tráfico HTTP<br>✅ Permitir tráfico HTTPS | |

3. **Crear**. En un minuto aparece con su **IP externa** — anotala.

> Si `e2-standard-4` se ve caro, `e2-medium` (2 vCPU, 4 GB) puede arrancar el
> stack pero va justo de memoria y MySQL suele morir. No lo recomiendo para la
> sustentación.

---

## 5. Abrir los puertos (reglas de firewall)

Por defecto GCP solo abre 80 y 443. El proyecto necesita más.

Menú ☰ → **Red de VPC** → **Firewall** → **Crear regla de firewall**

| Campo | Valor |
|---|---|
| Nombre | `yousac-puertos` |
| Dirección | Entrada |
| Destinos | Todas las instancias de la red |
| Rangos de IPv4 de origen | `0.0.0.0/0` |
| Protocolos y puertos | TCP: `5173,8080,8081` |

**Crear**.

| Puerto | Servicio |
|---|---|
| 5173 | Frontend |
| 8080 | API Gateway |
| 8081 | Servidor de medios |

> Las bases de datos y los puertos gRPC **no se exponen**: solo se comunican
> dentro de la red interna de Docker. Abrirlos sería un agujero de seguridad
> innecesario.

---

## 6. Instalar Docker en la VM

Conectate por SSH desde el botón **SSH** de la consola (abre una terminal en el
navegador, no hace falta configurar llaves).

```bash
# Actualizar el sistema
sudo apt-get update && sudo apt-get upgrade -y

# Docker y el plugin de Compose
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Poder usar docker sin sudo
sudo usermod -aG docker $USER
newgrp docker

# Comprobar
docker --version && docker compose version
```

---

## 7. Desplegar YoUSAC

```bash
# Clonar el repositorio
git clone https://github.com/Di3go004/SA_PROYECTO_202300449-.git
cd SA_PROYECTO_202300449-

# Crear el archivo de variables a partir de la plantilla
cp .env.example .env

# Editarlo con los valores reales
nano .env
```

Valores que hay que ajustar sí o sí:

| Variable | Qué poner |
|---|---|
| `PUBLIC_HOST` | La IP externa de la VM |
| `APP_PUBLIC_URL` | `http://IP_EXTERNA:5173` |
| `CORS_ORIGIN` | `http://IP_EXTERNA:5173` |
| `VITE_API_URL` | `http://IP_EXTERNA:8080` |
| `JWT_SECRET` | Una cadena larga y aleatoria: `openssl rand -base64 48` |
| `POSTGRES_PASSWORD` / `MYSQL_PASSWORD` / `MONGO_PASSWORD` / `MYSQL_ROOT_PASSWORD` | Contraseñas propias |
| `SMTP_USER` / `SMTP_PASSWORD` | Tu correo y la contraseña de aplicación de Gmail |

Guardá con `Ctrl+O`, `Enter`, `Ctrl+X`. Luego:

```bash
docker compose -f docker-compose.cloud.yml up -d --build
```

La primera vez tarda **5–10 minutos** compilando las imágenes.

```bash
# Ver el estado
docker compose -f docker-compose.cloud.yml ps

# Seguir los logs si algo falla
docker compose -f docker-compose.cloud.yml logs -f
```

---

## 8. Verificación

Desde tu máquina, reemplazando `IP_EXTERNA`:

| Qué | URL |
|---|---|
| Frontend | `http://IP_EXTERNA:5173` |
| Salud del gateway | `http://IP_EXTERNA:8080/health` |
| Servidor de medios | `http://IP_EXTERNA:8081/health` |

Y la verificación de Redis que pide la sustentación:

```bash
# Dentro de la VM
docker exec yousac_redis redis-cli ping          # → PONG
docker exec yousac_redis redis-cli keys 'yousac:*'
```

Desde el navegador, autenticado como administrador:

```
http://IP_EXTERNA:8080/api/analytics/cache/stats
```

Devuelve las claves vivas con su TTL, los aciertos y la tasa de acierto.

---

## Apagar la VM cuando no la uses

Los créditos se consumen mientras la VM está encendida, aunque nadie la use.

En **Compute Engine → Instancias de VM**, botón **Detener**. Al reanudarla, los
contenedores levantan solos gracias a `restart: unless-stopped`.

> Cuidado: al detener y reanudar, **la IP externa cambia** salvo que reserves una
> IP estática (VPC → Direcciones IP → Reservar). Si vas a dejarla apagada entre
> pruebas, conviene reservarla para no reconfigurar nada.

---

## Notas

- La consola de GCP cambia de aspecto con frecuencia. Si algún botón no está
  donde dice la guía, buscá el nombre del servicio en la barra superior.
- El despliegue usa Compute Engine con Docker Compose y no Cloud Run porque el
  proyecto necesita estado persistente (tres bases de datos, Redis y archivos de
  video), que Cloud Run no ofrece sin servicios administrados adicionales.
