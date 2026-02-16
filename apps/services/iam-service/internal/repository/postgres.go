package repository

import (
	"fmt"
	"log"
	"os"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type PostgresRepository struct {
	DB *gorm.DB
}

func NewPostgresRepository() (*PostgresRepository, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("POSTGRES_SSLMODE"),
	)

	// Config for Aiven or other providers if needed, simplified for now based on envs
	if os.Getenv("POSTGRES_URL_BASE") != "" {
		log.Println("Using POSTGRES_URL_BASE is not fully implemented in this refactor yet, relying on DB_* vars")
	}

	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	db, err := gorm.Open(postgres.Open(dsn), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return &PostgresRepository{DB: db}, nil
}

func (r *PostgresRepository) AutoMigrate() error {
	log.Println("Starting AutoMigrate...")
	err := r.DB.AutoMigrate(
		&domain.User{},
		&domain.Role{},
		&domain.Permission{},
		&domain.AuditLog{},
		&domain.PasswordResetToken{},
		&domain.RefreshToken{},
	)
	if err != nil {
		return fmt.Errorf("auto migration failed: %w", err)
	}
	log.Println("AutoMigrate completed.")
	return r.Seed()
}

func (r *PostgresRepository) Seed() error {
	log.Println("Seeding database...")

	// Seed Permissions
	permissions := []domain.Permission{
		{Name: "USER_CREATE", Description: "Can create users"},
		{Name: "USER_READ", Description: "Can read users"},
		{Name: "USER_UPDATE", Description: "Can update users"},
		{Name: "USER_DELETE", Description: "Can delete users"},
		{Name: "ROLE_ASSIGN", Description: "Can assign roles to users"},
		{Name: "COURSE_MANAGE", Description: "Can manage courses"},
	}

	for _, p := range permissions {
		if err := r.DB.Where(&domain.Permission{Name: p.Name}).FirstOrCreate(&p).Error; err != nil {
			log.Printf("Failed to seed permission %s: %v", p.Name, err)
		}
	}

	// Seed Roles
	roles := []domain.Role{
		{Name: "SUPER_ADMIN", Description: "Full system access"},
		{Name: "ADMIN", Description: "Administrative access"},
		{Name: "INSTRUCTOR", Description: "Instructor access"},
		{Name: "STUDENT", Description: "Student access"},
	}

	for _, role := range roles {
		if err := r.DB.Where(&domain.Role{Name: role.Name}).FirstOrCreate(&role).Error; err != nil {
			log.Printf("Failed to seed role %s: %v", role.Name, err)
		}
	}

	// Seed Super Admin
	superEmail := os.Getenv("SUPER_ADMIN_EMAIL")
	superPass := os.Getenv("SUPER_ADMIN_PASSWORD")
	if superEmail != "" && superPass != "" {
		var user domain.User
		if err := r.DB.Where("email = ?", superEmail).First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				hash, _ := bcrypt.GenerateFromPassword([]byte(superPass), bcrypt.DefaultCost)

				// Fetch SUPER_ADMIN role
				var superRole domain.Role
				r.DB.Where("name = ?", "SUPER_ADMIN").First(&superRole)

				admin := domain.User{
					Email:        superEmail,
					PasswordHash: string(hash),
					FullName:     "Super Admin",
					UserType:     domain.UserTypeEmployee,
					IsActive:     true,
					Roles:        []domain.Role{superRole},
				}
				if err := r.DB.Create(&admin).Error; err != nil {
					log.Printf("Failed to create super admin: %v", err)
				} else {
					log.Println("Super admin seeded successfully")
				}
			} else {
				log.Printf("Error checking super admin: %v", err)
			}
		}
	}

	return nil
}
