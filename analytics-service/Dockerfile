FROM python:3.11-slim

WORKDIR /app

# Instalar herramientas del sistema
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Copiar proto desde carpeta local del servicio
COPY proto/ /tmp/proto/

# Generar archivos proto: checkpoints.proto (cliente hacia reproduction-service)
# y analytics.proto (servidor propio, consumido por api-gateway)
RUN python3 -m grpc_tools.protoc \
    --proto_path=/tmp/proto \
    --python_out=app/grpc \
    --grpc_python_out=app/grpc \
    /tmp/proto/checkpoints.proto /tmp/proto/analytics.proto

# Corregir imports relativos generados por protoc
RUN sed -i 's/import checkpoints_pb2 as checkpoints__pb2/from app.grpc import checkpoints_pb2 as checkpoints__pb2/' \
    app/grpc/checkpoints_pb2_grpc.py && \
    sed -i 's/import analytics_pb2 as analytics__pb2/from app.grpc import analytics_pb2 as analytics__pb2/' \
    app/grpc/analytics_pb2_grpc.py

EXPOSE 3002 50054
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3002"]
