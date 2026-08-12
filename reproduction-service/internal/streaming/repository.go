// internal/streaming/repository.go
package streaming

import (
	"context"
	"time"

	"reproduction-service/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Repository struct {
	collection *mongo.Collection
}

func NewRepository(db *database.MongoClient) *Repository {
	return &Repository{collection: db.Collection("playback_sessions")}
}

func (r *Repository) CreateSession(ctx context.Context, session *PlaybackSession) (string, error) {
	session.StartedAt = time.Now()
	if session.Events == nil {
		// Un slice nil serializa como BSON null; el validador $jsonSchema exige
		// bsonType "array" para "events" cuando está presente. [] sí es válido.
		session.Events = []PlaybackEvent{}
	}
	result, err := r.collection.InsertOne(ctx, session)
	if err != nil {
		return "", err
	}
	return result.InsertedID.(primitive.ObjectID).Hex(), nil
}

func (r *Repository) AddEvent(ctx context.Context, sessionID string, event PlaybackEvent) error {
	oid, err := primitive.ObjectIDFromHex(sessionID)
	if err != nil {
		return err
	}
	event.Timestamp = time.Now()
	_, err = r.collection.UpdateOne(ctx,
		bson.M{"_id": oid},
		bson.M{"$push": bson.M{"events": event}},
	)
	return err
}
