# app/main.py
# La lógica de negocio se sirve exclusivamente por gRPC; FastAPI queda solo para
# /health, que consume el healthcheck de docker-compose y no es tráfico entre
# servicios. Mismo criterio que analytics-service.
import os
import threading

import uvicorn
from fastapi import FastAPI

from app.database import db
from app.grpc.server import serve as start_grpc_server

app = FastAPI(
    title="YoUSAC Notification Service",
    description="Microservicio de Notificaciones (gRPC: envío y bitácora; HTTP: solo /health)",
    version="1.0.0",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "notifications"}


@app.on_event("startup")
async def startup_event():
    try:
        db.connect()
    except Exception as exc:
        print(f"⚠️  PostgreSQL no disponible al arrancar: {exc}")
        print("   El servicio reintentará la conexión en la primera consulta")

    grpc_port = os.getenv("GRPC_PORT", "50055")

    def _run_grpc_server():
        # Un daemon thread que revienta no tumba el proceso ni deja rastro en los
        # logs; se captura para que un fallo sea visible en vez de dejar el puerto
        # silenciosamente cerrado.
        try:
            server = start_grpc_server(grpc_port)
            server.wait_for_termination()
        except Exception:
            import traceback
            print(f"❌ Error iniciando gRPC server en el puerto {grpc_port}:")
            traceback.print_exc()

    threading.Thread(target=_run_grpc_server, daemon=True).start()
    print(f"✅ Notification service iniciado (gRPC :{grpc_port})")


@app.on_event("shutdown")
async def shutdown_event():
    db.close()


if __name__ == "__main__":
    port = int(os.getenv("HTTP_PORT", 3004))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
