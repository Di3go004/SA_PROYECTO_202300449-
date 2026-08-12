// internal/ratings/service.go
package ratings

import (
	"context"
	"errors"
	"time"

	"reproduction-service/internal/checkpoints"
)

type Service struct {
	repo           *Repository
	checkpointRepo *checkpoints.Repository
}

func NewService(repo *Repository, checkpointRepo *checkpoints.Repository) *Service {
	return &Service{repo: repo, checkpointRepo: checkpointRepo}
}

// Guardar calificación (RF-023, RF-024)
func (s *Service) SaveRating(ctx context.Context, dto SaveRatingDTO) (*VideoStats, error) {
	// Verificar que el usuario reprodujo el video antes de calificar (RF-023)
	cp, err := s.checkpointRepo.GetByUserAndVideo(ctx, dto.UserID, dto.VideoID)
	if err != nil {
		return nil, err
	}
	if cp == nil {
		return nil, errors.New("debes ver la clase antes de calificarla")
	}

	rating := &Rating{
		UserID:    dto.UserID,
		VideoID:   dto.VideoID,
		Stars:     dto.Stars,
		Comment:   dto.Comment,
		UpdatedAt: time.Now(),
	}

	if err := s.repo.Upsert(ctx, rating); err != nil {
		return nil, err
	}

	// Recalcular estadísticas del video (RF-024)
	stats, err := s.repo.GetVideoStats(ctx, dto.VideoID)
	if err != nil {
		return nil, err
	}

	// Actualizar cache en video_stats (Change Stream equivalente)
	if err := s.repo.UpdateVideoStats(ctx, stats); err != nil {
		return nil, err
	}

	return stats, nil
}

// Obtener estadísticas de un video
func (s *Service) GetVideoStats(ctx context.Context, videoID int) (*VideoStats, error) {
	return s.repo.GetVideoStats(ctx, videoID)
}
