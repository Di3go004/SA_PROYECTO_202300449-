// internal/streaming/service.go
package streaming

import (
	"context"
	"reproduction-service/internal/checkpoints"
)

type Service struct {
	repo           *Repository
	checkpointRepo *checkpoints.Repository
}

func NewService(repo *Repository, checkpointRepo *checkpoints.Repository) *Service {
	return &Service{repo: repo, checkpointRepo: checkpointRepo}
}

// Iniciar sesión de reproducción (RF-019, RF-027)
func (s *Service) StartSession(ctx context.Context, dto StartSessionDTO) (string, *checkpoints.Checkpoint, error) {
	if dto.Resolution == "" {
		dto.Resolution = "720p"
	}

	session := &PlaybackSession{
		UserID:     dto.UserID,
		VideoID:    dto.VideoID,
		Resolution: dto.Resolution,
	}

	sessionID, err := s.repo.CreateSession(ctx, session)
	if err != nil {
		return "", nil, err
	}

	// Cargar último checkpoint (RF-021)
	cp, err := s.checkpointRepo.GetByUserAndVideo(ctx, dto.UserID, dto.VideoID)
	if err != nil {
		return sessionID, nil, err
	}

	return sessionID, cp, nil
}

// Registrar evento de reproducción (RF-027)
func (s *Service) RecordEvent(ctx context.Context, dto EventDTO) error {
	event := PlaybackEvent{
		Type:            dto.Type,
		PositionSeconds: dto.PositionSeconds,
	}
	return s.repo.AddEvent(ctx, dto.SessionID, event)
}
