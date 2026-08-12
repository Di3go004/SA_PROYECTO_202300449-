// internal/streaming/model.go
package streaming

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type PlaybackSession struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    int                `bson:"user_id"       json:"user_id"`
	VideoID   int                `bson:"video_id"      json:"video_id"`
	StartedAt time.Time          `bson:"started_at"    json:"started_at"`
	// omitempty: un *time.Time nil sin omitempty serializa como BSON null, y el
	// validador $jsonSchema de playback_sessions exige bsonType "date" para este
	// campo cuando está presente (aunque no sea "required") — omitirlo evita el
	// rechazo de Mongo al crear una sesión que todavía no terminó.
	EndedAt    *time.Time      `bson:"ended_at,omitempty" json:"ended_at"`
	Events     []PlaybackEvent `bson:"events"        json:"events"`
	Resolution string          `bson:"resolution"    json:"resolution"`
}

type PlaybackEvent struct {
	Type            string    `bson:"type"             json:"type"`
	PositionSeconds int       `bson:"position_seconds" json:"position_seconds"`
	Timestamp       time.Time `bson:"timestamp"        json:"timestamp"`
}

type StartSessionDTO struct {
	UserID     int    `json:"user_id"    binding:"required"`
	VideoID    int    `json:"video_id"   binding:"required"`
	Resolution string `json:"resolution"`
}

type EventDTO struct {
	SessionID       string `json:"session_id"       binding:"required"`
	Type            string `json:"type"             binding:"required"`
	PositionSeconds int    `json:"position_seconds" binding:"required"`
}
