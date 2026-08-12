// cmd/main.go
package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"reproduction-service/internal/checkpoints"
	"reproduction-service/internal/database"
	grpcserver "reproduction-service/internal/grpc/server"
	"reproduction-service/internal/ratings"
	"reproduction-service/internal/streaming"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
)

func main() {
	// Inicializar conexión a MongoDB
	db, err := database.NewMongoClient()
	if err != nil {
		log.Fatalf("Error conectando a MongoDB: %v", err)
	}
	defer db.Disconnect()
	fmt.Println("Conectado a MongoDB")

	// Inicializar repositorios
	checkpointRepo := checkpoints.NewRepository(db)
	ratingRepo := ratings.NewRepository(db)
	streamingRepo := streaming.NewRepository(db)

	// Inicializar servicios
	checkpointSvc := checkpoints.NewService(checkpointRepo)
	ratingSvc := ratings.NewService(ratingRepo, checkpointRepo)
	streamingSvc := streaming.NewService(streamingRepo, checkpointRepo)

	// ── Servidor gRPC ────────────────────────────────────────
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}

	go func() {
		lis, err := net.Listen("tcp", ":"+grpcPort)
		if err != nil {
			log.Fatalf("Error iniciando gRPC listener: %v", err)
		}
		grpcServer := grpc.NewServer()
		grpcserver.Register(grpcServer, checkpointSvc, ratingSvc, streamingSvc)
		fmt.Printf("gRPC server corriendo en puerto %s\n", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Error en gRPC server: %v", err)
		}
	}()

	// ── Servidor HTTP (solo /health) ──────────────────────────
	// Toda la comunicación de negocio (checkpoints, ratings, sesiones de reproducción)
	// migró a gRPC. El único endpoint HTTP que sobrevive es /health, consumido por el
	// healthcheck de docker-compose — no es tráfico "entre microservicios" de negocio.
	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "3001"
	}

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "reproduction"})
	})

	fmt.Printf("HTTP server (solo /health) corriendo en puerto %s\n", httpPort)
	if err := r.Run(":" + httpPort); err != nil {
		log.Fatalf("Error iniciando HTTP server: %v", err)
	}
}
