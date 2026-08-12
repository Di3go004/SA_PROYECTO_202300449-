// internal/database/mongo.go
package database

import (
	"context"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoClient struct {
	Client *mongo.Client
	DB     *mongo.Database
}

func NewMongoClient() (*MongoClient, error) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		uri = "mongodb://yousac:yousac_secret@localhost:27017/yousac_reproduction_db?authSource=admin"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	// Verificar conexión
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	dbName := "yousac_reproduction_db"
	return &MongoClient{
		Client: client,
		DB:     client.Database(dbName),
	}, nil
}

func (m *MongoClient) Disconnect() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	m.Client.Disconnect(ctx)
}

func (m *MongoClient) Collection(name string) *mongo.Collection {
	return m.DB.Collection(name)
}
