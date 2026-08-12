#!/bin/bash
# Ejecutar desde la raíz de analytics-service/
# Genera los archivos Python desde los contratos .proto unificados (../proto)

echo "Generando archivos proto para Python..."

pip install grpcio-tools --quiet

python -m grpc_tools.protoc \
    --proto_path=../proto \
    --python_out=app/grpc \
    --grpc_python_out=app/grpc \
    ../proto/checkpoints.proto ../proto/analytics.proto

# protoc genera imports absolutos (import xxx_pb2) que no resuelven dentro del paquete app.grpc
sed -i 's/^import checkpoints_pb2 as checkpoints__pb2/from app.grpc import checkpoints_pb2 as checkpoints__pb2/' app/grpc/checkpoints_pb2_grpc.py
sed -i 's/^import analytics_pb2 as analytics__pb2/from app.grpc import analytics_pb2 as analytics__pb2/'       app/grpc/analytics_pb2_grpc.py

echo "✅ Archivos generados:"
echo "   app/grpc/checkpoints_pb2.py / checkpoints_pb2_grpc.py"
echo "   app/grpc/analytics_pb2.py / analytics_pb2_grpc.py"
