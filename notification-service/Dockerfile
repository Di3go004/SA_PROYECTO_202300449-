FROM python:3.11-slim

WORKDIR /app

# Se instalan las dependencias antes de copiar el código para que un cambio en
# los fuentes no invalide la capa de dependencias en cada build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3004 50055

CMD ["python", "-m", "app.main"]
