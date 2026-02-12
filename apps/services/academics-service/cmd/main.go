package main

import (
	"context"
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/infrastructure/http/router"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/infrastructure/repositories"

	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/4yrg/gradeloop-core-v2/shared/libs/go/secrets"
	gl_tracing "github.com/4yrg/gradeloop-core-v2/shared/libs/go/tracing"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/uptrace/opentelemetry-go-extra/otelgorm"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	l := gl_logger.New("academics-service")
	startupTraceID := "startup-" + uuid.New().String()
	ctx := context.WithValue(context.Background(), gl_logger.TraceIDKey, startupTraceID)

	l.Info("Starting Academics Service...")

	// Initialize Tracer
	tp, err := gl_tracing.InitTracer("academics-service")
	if err != nil {
		l.Error("failed to initialize tracer", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := tp.Shutdown(context.Background()); err != nil {
			l.Error("failed to shutdown tracer provider", "error", err)
		}
	}()

	startupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	l.Info("Initializing secrets client...")
	secretsClient, err := secrets.NewClient(nil)
	if err != nil {
		l.Error("failed to initialize secrets client", "error", err)
		os.Exit(1)
	}
	defer secretsClient.Close()

	l.Info("Retrieving database configuration from Vault...")
	var dbConfig *secrets.DatabaseConfig
	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		dbConfig, err = secretsClient.GetDatabaseConfig(startupCtx)
		if err == nil {
			break
		}
		l.Info("Waiting for secrets to be seeded", "attempt", i+1, "max_retries", maxRetries)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		l.Error("failed to retrieve database configuration from vault after retries", "error", err)
		os.Exit(1)
	}

	dsn := dbConfig.ConnectionString()
	l.Info("Connecting to database...")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		l.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}

	if err := db.Use(otelgorm.NewPlugin()); err != nil {
		l.Error("failed to use otelgorm plugin", "error", err)
		os.Exit(1)
	}

	l.Info("Connected to database. Running auto-migrations...")
	if err := db.AutoMigrate(&models.Faculty{}, &models.FacultyLeadership{}, &models.Department{}, &models.Degree{}, &models.Specialization{}, &models.AuditLog{}); err != nil {
		l.Error("failed to migrate database", "error", err)
		os.Exit(1)
	}

	l.Info("Auto-migrations completed. Initializing dependencies...")

	// Dependency Injection
	auditRepo := repositories.NewGormAuditRepository(db)
	facultyRepo := repositories.NewGormFacultyRepository(db)
	deptRepo := repositories.NewGormDepartmentRepository(db)
	degreeRepo := repositories.NewGormDegreeRepository(db)
	specializationRepo := repositories.NewGormSpecializationRepository(db)

	facultyService := usecases.NewFacultyService(facultyRepo, auditRepo)
	deptService := usecases.NewDepartmentService(deptRepo, facultyRepo, auditRepo)
	degreeService := usecases.NewDegreeService(degreeRepo, deptRepo, specializationRepo, auditRepo)
	specializationService := usecases.NewSpecializationService(specializationRepo, degreeRepo, deptRepo, auditRepo)

	facultyHandler := handlers.NewFacultyHandler(facultyService)
	deptHandler := handlers.NewDepartmentHandler(deptService)
	degreeHandler := handlers.NewDegreeHandler(degreeService)
	specializationHandler := handlers.NewSpecializationHandler(specializationService)

	// Start Server
	app := fiber.New()
	app.Get("/api/academics/health", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})

	router.Setup(app, facultyHandler, deptHandler, degreeHandler, specializationHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	l.Info("Server starting", "port", port)
	if err := app.Listen(":" + port); err != nil {
		l.Error("Error starting server", "error", err)
		os.Exit(1)
	}
}
