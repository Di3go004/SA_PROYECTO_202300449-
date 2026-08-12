// internal/grpc/server/server.go
package server

import (
	"context"
	"strconv"

	"reproduction-service/internal/checkpoints"
	"reproduction-service/internal/ratings"
	"reproduction-service/internal/streaming"
	pb "reproduction-service/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ReproduccionServer implementa la interfaz generada por protoc.
// Reutiliza exactamente los mismos *Service que el transporte HTTP (Principio S:
// este archivo solo traduce gRPC↔dominio, la lógica de negocio vive en internal/*).
type ReproduccionServer struct {
	pb.UnimplementedReproduccionServiceServer
	checkpointSvc *checkpoints.Service
	ratingSvc     *ratings.Service
	streamingSvc  *streaming.Service
}

// NewReproduccionServer crea e inicializa el servidor gRPC
func NewReproduccionServer(
	checkpointSvc *checkpoints.Service,
	ratingSvc *ratings.Service,
	streamingSvc *streaming.Service,
) *ReproduccionServer {
	return &ReproduccionServer{
		checkpointSvc: checkpointSvc,
		ratingSvc:     ratingSvc,
		streamingSvc:  streamingSvc,
	}
}

// Register registra el servidor en el grpc.Server
func Register(
	grpcServer *grpc.Server,
	checkpointSvc *checkpoints.Service,
	ratingSvc *ratings.Service,
	streamingSvc *streaming.Service,
) {
	srv := NewReproduccionServer(checkpointSvc, ratingSvc, streamingSvc)
	pb.RegisterReproduccionServiceServer(grpcServer, srv)
}

// GetCheckpoint devuelve el checkpoint de un usuario para un video
func (s *ReproduccionServer) GetCheckpoint(
	ctx context.Context,
	req *pb.CheckpointRequest,
) (*pb.CheckpointResponse, error) {
	// Los IDs vienen como string desde el proto
	userID, _ := strconv.Atoi(req.GetUserId())
	videoID, _ := strconv.Atoi(req.GetVideoId())

	cp, err := s.checkpointSvc.GetCheckpoint(ctx, userID, videoID)
	if err != nil {
		return nil, err
	}

	if cp == nil {
		return &pb.CheckpointResponse{
			UserId:          req.GetUserId(),
			VideoId:         req.GetVideoId(),
			PositionSeconds: 0,
			ProgressPercent: 0,
			Completed:       false,
		}, nil
	}

	return &pb.CheckpointResponse{
		UserId:          req.GetUserId(),
		VideoId:         req.GetVideoId(),
		PositionSeconds: int32(cp.PositionSeconds),
		ProgressPercent: float32(cp.ProgressPercent),
		Completed:       cp.Completed,
	}, nil
}

// SaveCheckpoint guarda/actualiza el checkpoint de un usuario en un video (RF-020, RF-021, RF-022)
func (s *ReproduccionServer) SaveCheckpoint(
	ctx context.Context,
	req *pb.SaveCheckpointRequest,
) (*pb.CheckpointResponse, error) {
	userID, err := strconv.Atoi(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "user_id inválido")
	}
	videoID, err := strconv.Atoi(req.GetVideoId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "video_id inválido")
	}

	cp, err := s.checkpointSvc.SaveCheckpoint(ctx, checkpoints.SaveCheckpointDTO{
		UserID:          userID,
		VideoID:         videoID,
		PositionSeconds: int(req.GetPositionSeconds()),
		TotalSeconds:    int(req.GetTotalSeconds()),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "Error al guardar checkpoint")
	}

	return &pb.CheckpointResponse{
		UserId:          req.GetUserId(),
		VideoId:         req.GetVideoId(),
		PositionSeconds: int32(cp.PositionSeconds),
		ProgressPercent: float32(cp.ProgressPercent),
		Completed:       cp.Completed,
	}, nil
}

// GetVideoStats devuelve estadísticas de un video para Analítica
func (s *ReproduccionServer) GetVideoStats(
	ctx context.Context,
	req *pb.VideoStatsRequest,
) (*pb.VideoStatsResponse, error) {
	videoID, _ := strconv.Atoi(req.GetVideoId())

	stats, err := s.ratingSvc.GetVideoStats(ctx, videoID)
	if err != nil {
		return nil, err
	}

	return &pb.VideoStatsResponse{
		VideoId:               req.GetVideoId(),
		TotalViews:            int32(stats.TotalRatings),
		AverageProgress:       float32(stats.AverageStars),
		RecommendationPercent: float32(stats.RecommendationPercent),
	}, nil
}

// SaveRating guarda/actualiza la calificación de un usuario sobre un video (RF-023, RF-024)
func (s *ReproduccionServer) SaveRating(
	ctx context.Context,
	req *pb.SaveRatingRequest,
) (*pb.RatingStatsResponse, error) {
	userID, err := strconv.Atoi(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "user_id inválido")
	}
	videoID, err := strconv.Atoi(req.GetVideoId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "video_id inválido")
	}

	stats, err := s.ratingSvc.SaveRating(ctx, ratings.SaveRatingDTO{
		UserID:  userID,
		VideoID: videoID,
		Stars:   int(req.GetStars()),
		Comment: req.GetComment(),
	})
	if err != nil {
		// El caso esperado es "debes ver la clase antes de calificarla" (regla de negocio)
		return nil, status.Error(codes.FailedPrecondition, err.Error())
	}

	return &pb.RatingStatsResponse{
		VideoId:               req.GetVideoId(),
		TotalRatings:          int32(stats.TotalRatings),
		AverageStars:          float32(stats.AverageStars),
		RecommendationPercent: float32(stats.RecommendationPercent),
	}, nil
}

// GetRatingStats devuelve las estadísticas reales de calificación de un video
// (usada por api-gateway para GET /api/ratings/:video_id/stats; distinta de
// GetVideoStats, que analytics-service consume con su propio mapeo de campos).
func (s *ReproduccionServer) GetRatingStats(
	ctx context.Context,
	req *pb.VideoStatsRequest,
) (*pb.RatingStatsResponse, error) {
	videoID, err := strconv.Atoi(req.GetVideoId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "video_id inválido")
	}

	stats, err := s.ratingSvc.GetVideoStats(ctx, videoID)
	if err != nil {
		return nil, status.Error(codes.Internal, "Error al obtener estadísticas")
	}

	return &pb.RatingStatsResponse{
		VideoId:               req.GetVideoId(),
		TotalRatings:          int32(stats.TotalRatings),
		AverageStars:          float32(stats.AverageStars),
		RecommendationPercent: float32(stats.RecommendationPercent),
	}, nil
}

// GetUserProgress devuelve el progreso real de un usuario agregando sus checkpoints
// sobre la lista de video_ids recibida (reproduction-service no conoce la relación
// curso→video, que vive en catalog_db/Postgres — quien llama debe resolverla antes).
func (s *ReproduccionServer) GetUserProgress(
	ctx context.Context,
	req *pb.UserProgressRequest,
) (*pb.UserProgressResponse, error) {
	userID, err := strconv.Atoi(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "user_id inválido")
	}

	videoIDs := make([]int, 0, len(req.GetVideoIds()))
	for _, v := range req.GetVideoIds() {
		id, err := strconv.Atoi(v)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "video_ids inválido: "+v)
		}
		videoIDs = append(videoIDs, id)
	}

	if len(videoIDs) == 0 {
		// Nada que agregar: respuesta explícita en 0, no un stub silencioso.
		return &pb.UserProgressResponse{
			UserId:          req.GetUserId(),
			CourseId:        req.GetCourseId(),
			OverallProgress: 0,
			Videos:          []*pb.VideoProgress{},
		}, nil
	}

	checkpointsList, err := s.checkpointSvc.GetUserVideoProgress(ctx, userID, videoIDs)
	if err != nil {
		return nil, status.Error(codes.Internal, "Error al obtener progreso del usuario")
	}

	progressByVideo := make(map[int]checkpoints.Checkpoint, len(checkpointsList))
	for _, cp := range checkpointsList {
		progressByVideo[cp.VideoID] = cp
	}

	videos := make([]*pb.VideoProgress, 0, len(videoIDs))
	var totalProgress float64
	for _, videoID := range videoIDs {
		cp, found := progressByVideo[videoID]
		videos = append(videos, &pb.VideoProgress{
			VideoId:         strconv.Itoa(videoID),
			ProgressPercent: float32(cp.ProgressPercent),
			Completed:       found && cp.Completed,
		})
		totalProgress += cp.ProgressPercent // 0 si no hay checkpoint (video no visto)
	}

	return &pb.UserProgressResponse{
		UserId:          req.GetUserId(),
		CourseId:        req.GetCourseId(),
		OverallProgress: float32(totalProgress / float64(len(videoIDs))),
		Videos:          videos,
	}, nil
}

// StartSession inicia una sesión de reproducción y devuelve el checkpoint previo si existe (RF-019, RF-021, RF-027)
func (s *ReproduccionServer) StartSession(
	ctx context.Context,
	req *pb.StartSessionRequest,
) (*pb.StartSessionResponse, error) {
	userID, err := strconv.Atoi(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "user_id inválido")
	}
	videoID, err := strconv.Atoi(req.GetVideoId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "video_id inválido")
	}

	sessionID, cp, err := s.streamingSvc.StartSession(ctx, streaming.StartSessionDTO{
		UserID:     userID,
		VideoID:    videoID,
		Resolution: req.GetResolution(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "Error al iniciar sesión")
	}

	resp := &pb.StartSessionResponse{SessionId: sessionID, StartPosition: 0}
	if cp != nil {
		resp.StartPosition = int32(cp.PositionSeconds)
		resp.Checkpoint = &pb.CheckpointResponse{
			UserId:          req.GetUserId(),
			VideoId:         req.GetVideoId(),
			PositionSeconds: int32(cp.PositionSeconds),
			ProgressPercent: float32(cp.ProgressPercent),
			Completed:       cp.Completed,
		}
	}
	return resp, nil
}

// RecordEvent registra un evento de reproducción (play/pause/seek/...) (RF-027)
func (s *ReproduccionServer) RecordEvent(
	ctx context.Context,
	req *pb.RecordEventRequest,
) (*pb.Ack, error) {
	err := s.streamingSvc.RecordEvent(ctx, streaming.EventDTO{
		SessionID:       req.GetSessionId(),
		Type:            req.GetType(),
		PositionSeconds: int(req.GetPositionSeconds()),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "Error al registrar evento")
	}
	return &pb.Ack{Ok: true}, nil
}
