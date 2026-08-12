// internal/checkpoints/model.go
package checkpoints

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

// Modelo principal de checkpoint
type Checkpoint struct {
	ID              primitive.ObjectID `bson:"_id,omitempty"    json:"id"`
	UserID          int                `bson:"user_id"          json:"user_id"`
	VideoID         int                `bson:"video_id"         json:"video_id"`
	PositionSeconds int                `bson:"position_seconds" json:"position_seconds"`
	ProgressPercent float64            `bson:"progress_percent" json:"progress_percent"`
	Completed       bool               `bson:"completed"        json:"completed"`
	CreatedAt       time.Time          `bson:"created_at"       json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at"       json:"updated_at"`
}

// DTO para guardar/actualizar checkpoint
type SaveCheckpointDTO struct {
	UserID          int `json:"user_id"          binding:"required"`
	VideoID         int `json:"video_id"         binding:"required"`
	PositionSeconds int `json:"position_seconds" binding:"required"`
	TotalSeconds    int `json:"total_seconds"    binding:"required"`
}
