// internal/checkpoints/repository.go
// Principio S: solo maneja persistencia de checkpoints
package checkpoints

import (
	"context"
	"time"

	"reproduction-service/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository struct {
	collection *mongo.Collection
}

func NewRepository(db *database.MongoClient) *Repository {
	return &Repository{
		collection: db.Collection("checkpoints"),
	}
}

// Upsert: crea o actualiza el checkpoint de un usuario para un video
func (r *Repository) Upsert(ctx context.Context, cp *Checkpoint) error {
	filter := bson.M{
		"user_id":  cp.UserID,
		"video_id": cp.VideoID,
	}

	update := bson.M{
		"$set": bson.M{
			"position_seconds": cp.PositionSeconds,
			"progress_percent": cp.ProgressPercent,
			"completed":        cp.Completed,
			"updated_at":       time.Now(),
		},
		"$setOnInsert": bson.M{
			"created_at": time.Now(),
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := r.collection.UpdateOne(ctx, filter, update, opts)
	return err
}

// Obtener checkpoint de un usuario para un video específico
func (r *Repository) GetByUserAndVideo(ctx context.Context, userID, videoID int) (*Checkpoint, error) {
	filter := bson.M{
		"user_id":  userID,
		"video_id": videoID,
	}

	var cp Checkpoint
	err := r.collection.FindOne(ctx, filter).Decode(&cp)
	if err == mongo.ErrNoDocuments {
		return nil, nil // No existe checkpoint, es la primera vez
	}
	return &cp, err
}

// Obtener todos los checkpoints de un usuario en una lista de videos
func (r *Repository) GetByUserAndVideos(ctx context.Context, userID int, videoIDs []int) ([]Checkpoint, error) {
	filter := bson.M{
		"user_id":  userID,
		"video_id": bson.M{"$in": videoIDs},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var checkpoints []Checkpoint
	if err := cursor.All(ctx, &checkpoints); err != nil {
		return nil, err
	}
	return checkpoints, nil
}
