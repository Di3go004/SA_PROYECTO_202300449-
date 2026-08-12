// internal/checkpoints/service.go
// Principio S: solo lógica de negocio de checkpoints
package checkpoints

import (
	"context"
	"time"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Guardar o actualizar checkpoint (RF-020, RF-021)
func (s *Service) SaveCheckpoint(ctx context.Context, dto SaveCheckpointDTO) (*Checkpoint, error) {
	// Calcular porcentaje de avance (RF-022)
	progress := 0.0
	if dto.TotalSeconds > 0 {
		progress = (float64(dto.PositionSeconds) / float64(dto.TotalSeconds)) * 100
		if progress > 100 {
			progress = 100
		}
	}

	// Marcar como completado si el avance es >= 95% (RF-022)
	completed := progress >= 95.0

	cp := &Checkpoint{
		UserID:          dto.UserID,
		VideoID:         dto.VideoID,
		PositionSeconds: dto.PositionSeconds,
		ProgressPercent: progress,
		Completed:       completed,
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.Upsert(ctx, cp); err != nil {
		return nil, err
	}
	return cp, nil
}

// Obtener último checkpoint de un usuario para un video (RF-021)
func (s *Service) GetCheckpoint(ctx context.Context, userID, videoID int) (*Checkpoint, error) {
	return s.repo.GetByUserAndVideo(ctx, userID, videoID)
}

// Obtener progreso de un usuario en múltiples videos (para gRPC)
func (s *Service) GetUserVideoProgress(ctx context.Context, userID int, videoIDs []int) ([]Checkpoint, error) {
	return s.repo.GetByUserAndVideos(ctx, userID, videoIDs)
}
