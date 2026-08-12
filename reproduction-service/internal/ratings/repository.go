// internal/ratings/repository.go
package ratings

import (
	"context"
	"time"

	"reproduction-service/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository struct {
	ratings    *mongo.Collection
	videoStats *mongo.Collection
}

func NewRepository(db *database.MongoClient) *Repository {
	return &Repository{
		ratings:    db.Collection("ratings"),
		videoStats: db.Collection("video_stats"),
	}
}

// Upsert: crea o actualiza calificación (un usuario, un voto por video)
func (r *Repository) Upsert(ctx context.Context, rating *Rating) error {
	filter := bson.M{"user_id": rating.UserID, "video_id": rating.VideoID}
	update := bson.M{
		"$set": bson.M{
			"stars":      rating.Stars,
			"comment":    rating.Comment,
			"updated_at": time.Now(),
		},
		"$setOnInsert": bson.M{"created_at": time.Now()},
	}
	_, err := r.ratings.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	return err
}

// Calcular estadísticas de un video via agregación MongoDB
func (r *Repository) GetVideoStats(ctx context.Context, videoID int) (*VideoStats, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{{Key: "video_id", Value: videoID}}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$video_id"},
			{Key: "total_ratings", Value: bson.D{{Key: "$sum", Value: 1}}},
			{Key: "average_stars", Value: bson.D{{Key: "$avg", Value: "$stars"}}},
			{Key: "recommendation_percent", Value: bson.D{
				{Key: "$avg", Value: bson.D{
					{Key: "$multiply", Value: bson.A{"$stars", 20}},
				}},
			}},
		}}},
	}

	cursor, err := r.ratings.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []struct {
		TotalRatings          int     `bson:"total_ratings"`
		AverageStars          float64 `bson:"average_stars"`
		RecommendationPercent float64 `bson:"recommendation_percent"`
	}

	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return &VideoStats{VideoID: videoID}, nil
	}

	return &VideoStats{
		VideoID:               videoID,
		TotalRatings:          results[0].TotalRatings,
		AverageStars:          results[0].AverageStars,
		RecommendationPercent: results[0].RecommendationPercent,
	}, nil
}

// Actualizar video_stats collection (cache de estadísticas).
// El validador $jsonSchema de video_stats (reproduction_mongodb.js) exige
// total_views/average_progress además de recommendation_percent — campos que
// se derivan de checkpoints, no de calificaciones, y esta ruta de escritura
// solo tiene datos de rating. Se inicializan en 0 vía $setOnInsert (no se
// inventan datos) para satisfacer el esquema sin pisar un valor real que ya
// haya sido calculado por otra vía.
func (r *Repository) UpdateVideoStats(ctx context.Context, stats *VideoStats) error {
	filter := bson.M{"video_id": stats.VideoID}
	update := bson.M{
		"$set": bson.M{
			"total_ratings":          stats.TotalRatings,
			"average_stars":          stats.AverageStars,
			"recommendation_percent": stats.RecommendationPercent,
			"last_updated":           time.Now(),
		},
		"$setOnInsert": bson.M{
			"total_views":      0,
			"average_progress": 0.0,
		},
	}
	_, err := r.videoStats.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	return err
}
