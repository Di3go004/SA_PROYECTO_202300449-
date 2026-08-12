// internal/ratings/model.go
package ratings

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Rating struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    int                `bson:"user_id"       json:"user_id"`
	VideoID   int                `bson:"video_id"      json:"video_id"`
	Stars     int                `bson:"stars"         json:"stars"`
	Comment   string             `bson:"comment"       json:"comment"`
	CreatedAt time.Time          `bson:"created_at"    json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at"    json:"updated_at"`
}

type SaveRatingDTO struct {
	UserID  int    `json:"user_id"  binding:"required"`
	VideoID int    `json:"video_id" binding:"required"`
	Stars   int    `json:"stars"    binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

type VideoStats struct {
	VideoID               int     `json:"video_id"`
	TotalRatings          int     `json:"total_ratings"`
	AverageStars          float64 `json:"average_stars"`
	RecommendationPercent float64 `json:"recommendation_percent"`
}
