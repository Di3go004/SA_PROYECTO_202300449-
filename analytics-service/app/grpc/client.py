# app/grpc/client.py
# Principio S: solo maneja la comunicación gRPC con el servicio de Reproducción
import grpc
import os
from app.grpc import checkpoints_pb2, checkpoints_pb2_grpc

GRPC_HOST = os.getenv("GRPC_REPRODUCTION_HOST", "localhost")
GRPC_PORT = os.getenv("GRPC_REPRODUCTION_PORT", "50051")

def get_grpc_channel():
    """Crea un canal gRPC reutilizable"""
    return grpc.insecure_channel(f"{GRPC_HOST}:{GRPC_PORT}")

def get_video_stats(video_id: int) -> dict:
    """
    Llama al servicio de Reproducción via gRPC para obtener
    estadísticas de un video (RF-024)
    """
    try:
        with get_grpc_channel() as channel:
            stub = checkpoints_pb2_grpc.ReproduccionServiceStub(channel)
            request = checkpoints_pb2.VideoStatsRequest(video_id=str(video_id))
            response = stub.GetVideoStats(request, timeout=5)
            return {
                "video_id":               video_id,
                "total_views":            response.total_views,
                "average_progress":       response.average_progress,
                "recommendation_percent": response.recommendation_percent,
            }
    except grpc.RpcError as e:
        print(f"❌ Error gRPC GetVideoStats: {e.code()} - {e.details()}")
        return None

def get_checkpoint(user_id: int, video_id: int) -> dict:
    """
    Llama al servicio de Reproducción via gRPC para obtener
    el checkpoint de un usuario en un video (RF-021)
    """
    try:
        with get_grpc_channel() as channel:
            stub = checkpoints_pb2_grpc.ReproduccionServiceStub(channel)
            request = checkpoints_pb2.CheckpointRequest(
                user_id=str(user_id),
                video_id=str(video_id)
            )
            response = stub.GetCheckpoint(request, timeout=5)
            return {
                "user_id":          user_id,
                "video_id":         video_id,
                "position_seconds": response.position_seconds,
                "progress_percent": response.progress_percent,
                "completed":        response.completed,
            }
    except grpc.RpcError as e:
        print(f"❌ Error gRPC GetCheckpoint: {e.code()} - {e.details()}")
        return None

def get_user_course_progress(user_id: int, course_id: int) -> dict:
    """
    Llama al servicio de Reproducción via gRPC para obtener
    el progreso de un estudiante en un curso (RF-032)
    """
    try:
        with get_grpc_channel() as channel:
            stub = checkpoints_pb2_grpc.ReproduccionServiceStub(channel)
            request = checkpoints_pb2.UserProgressRequest(
                user_id=str(user_id),
                course_id=str(course_id)
            )
            response = stub.GetUserProgress(request, timeout=5)
            return {
                "user_id":          user_id,
                "course_id":        course_id,
                "overall_progress": response.overall_progress,
                "videos":           [
                    {
                        "video_id":         v.video_id,
                        "progress_percent": v.progress_percent,
                        "completed":        v.completed,
                    }
                    for v in response.videos
                ],
            }
    except grpc.RpcError as e:
        print(f"❌ Error gRPC GetUserProgress: {e.code()} - {e.details()}")
        return None
