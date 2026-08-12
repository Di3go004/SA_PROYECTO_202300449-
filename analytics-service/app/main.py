# app/main.py
# La lógica de negocio (métricas, reportes) se sirve exclusivamente por gRPC
# (app.grpc.server.AnalyticsServicer) — FastAPI queda solo para /health, consumido
# por el healthcheck de docker-compose, que no es tráfico de negocio entre servicios.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.scheduler.tasks import start_scheduler
from app.grpc.server import serve as start_grpc_server
import threading
import uvicorn
import os

app = FastAPI(
    title="YoUSAC Analytics Service",
    description="Microservicio de Analítica (gRPC: métricas y reportes; HTTP: solo /health)",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics"}

@app.on_event("startup")
async def startup_event():
    # Crear tablas solo si la BD está disponible, sin bloquear el arranque
    try:
        from app.database import engine, Base
        Base.metadata.create_all(bind=engine)
        print("✅ Tablas verificadas en MySQL")
    except Exception as e:
        print(f"⚠️  MySQL no disponible al arrancar: {e}")
        print("   El servicio continuará sin BD hasta que esté disponible")

    grpc_port = os.getenv("GRPC_PORT", "50054")

    def _run_grpc_server():
        # Un daemon thread que lanza una excepción no tumba el proceso ni se ve en
        # los logs por defecto — la capturamos explícitamente para que un fallo acá
        # sea visible en vez de dejar el puerto gRPC silenciosamente cerrado.
        try:
            server = start_grpc_server(grpc_port)
            server.wait_for_termination()
        except Exception:
            import traceback
            print(f"❌ Error iniciando gRPC server en puerto {grpc_port}:")
            traceback.print_exc()

    threading.Thread(target=_run_grpc_server, daemon=True).start()

    try:
        start_scheduler()
        print("✅ Analytics service iniciado")
    except Exception as e:
        print(f"⚠️  Error iniciando scheduler: {e}")

if __name__ == "__main__":
    port = int(os.getenv("HTTP_PORT", 3002))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)