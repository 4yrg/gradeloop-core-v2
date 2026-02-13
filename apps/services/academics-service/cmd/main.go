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
	"github.com/google/uuid"

	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/4yrg/gradeloop-core-v2/shared/libs/go/secrets"
	"github.com/gofiber/fiber/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	l := gl_logger.New("academics-service")
	startupTraceID := "startup-" + uuid.New().String()
	ctx := context.WithValue(context.Background(), gl_logger.TraceIDKey, startupTraceID)

	l.Info("Starting Academics Service...")

	l.Info("Starting Academics Service...")

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

	l.Info("Connected to database. Ensuring ENUM types exist...")
	// Create degree_level enum if it doesn't exist
	if err := db.Exec(`
		DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'degree_level') THEN
				CREATE TYPE degree_level AS ENUM ('Undergraduate', 'Postgraduate');
			END IF;
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_member_status') THEN
				CREATE TYPE batch_member_status AS ENUM ('Active', 'Graduated', 'Suspended');
			END IF;
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_instance_status') THEN
				CREATE TYPE course_instance_status AS ENUM ('Planned', 'Active', 'Completed', 'Cancelled');
			END IF;
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_instructor_role') THEN
				CREATE TYPE course_instructor_role AS ENUM ('Lead', 'TA');
			END IF;
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
				CREATE TYPE enrollment_status AS ENUM ('Enrolled', 'Dropped', 'Completed');
			END IF;
		END $$;
	`).Error; err != nil {
		l.Error("failed to create degree_level type", "error", err)
		os.Exit(1)
	}

	l.Info("Running auto-migrations...")
	if err := db.AutoMigrate(
		&models.Faculty{},
		&models.FacultyLeadership{},
		&models.Department{},
		&models.Degree{},
		&models.Specialization{},
		&models.Batch{},
		&models.AuditLog{},
		&models.Course{},
		&models.Semester{},
		&models.BatchMember{},
		&models.CourseInstance{},
		&models.CourseInstructor{},
		&models.CourseEnrollment{},
	); err != nil {
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
	batchRepo := repositories.NewBatchRepository(db)
	enrollmentRepo := repositories.NewEnrollmentRepository(db)
	courseRepo := repositories.NewCourseRepository(db)
	semesterRepo := repositories.NewSemesterRepository(db)

	facultyService := usecases.NewFacultyService(facultyRepo, auditRepo)
	deptService := usecases.NewDepartmentService(deptRepo, facultyRepo, auditRepo)
	degreeService := usecases.NewDegreeService(degreeRepo, deptRepo, specializationRepo, auditRepo)
	specializationService := usecases.NewSpecializationService(specializationRepo, degreeRepo, deptRepo, auditRepo)
	batchService := usecases.NewBatchService(batchRepo, degreeRepo, specializationRepo, deptRepo, auditRepo)
	enrollmentService := usecases.NewEnrollmentService(enrollmentRepo, batchRepo, auditRepo)
	academicStructureService := usecases.NewAcademicStructureService(courseRepo, semesterRepo, auditRepo)

	facultyHandler := handlers.NewFacultyHandler(facultyService)
	deptHandler := handlers.NewDepartmentHandler(deptService)
	degreeHandler := handlers.NewDegreeHandler(degreeService)
	specializationHandler := handlers.NewSpecializationHandler(specializationService)
	batchHandler := handlers.NewBatchHandler(batchService)
	enrollmentHandler := handlers.NewEnrollmentHandler(enrollmentService)
	academicStructureHandler := handlers.NewAcademicStructureHandler(academicStructureService)

	// Start Server
	app := fiber.New()
	app.Get("/api/academics/health", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})

	router.Setup(app, facultyHandler, deptHandler, degreeHandler, specializationHandler, batchHandler, enrollmentHandler, academicStructureHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	l.Info("Server starting", "port", port)
	if err := app.Listen(":" + port); err != nil {
		l.Error("Error starting server", "error", err)
		os.Exit(1)
	}
}
