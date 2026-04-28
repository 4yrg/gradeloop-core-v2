package migrations

import (
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Seeder struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewSeeder(db *gorm.DB, logger *zap.Logger) *Seeder {
	return &Seeder{
		db:     db,
		logger: logger,
	}
}

func (s *Seeder) Seed() error {
	if err := s.seedSuperAdmin(); err != nil {
		return fmt.Errorf("seeding super_admin: %w", err)
	}
	if err := s.seedAdmin(); err != nil {
		return fmt.Errorf("seeding admin: %w", err)
	}
	if err := s.seedDevUser("student@gradeloop.com", "Student User", "student"); err != nil {
		return fmt.Errorf("seeding student: %w", err)
	}
	if err := s.seedDevUser("instructor@gradeloop.com", "Instructor User", "instructor"); err != nil {
		return fmt.Errorf("seeding instructor: %w", err)
	}

	s.logger.Info("database seeding completed successfully")
	return nil
}

func (s *Seeder) seedDevUser(email, fullName, userType string) error {
	password := "Strong#Pass123!"

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	var existing domain.User
	if err := s.db.Where("email = ?", email).First(&existing).Error; err == nil {
		s.logger.Info("dev user already exists, skipping", zap.String("email", email))
		return nil
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking for existing user: %w", err)
	}

	user := domain.User{
		ID:                      uuid.New(),
		Email:                   email,
		FullName:                fullName,
		PasswordHash:            string(hashedPassword),
		UserType:                userType,
		IsActive:                true,
		IsPasswordResetRequired: false,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return fmt.Errorf("creating dev user: %w", err)
	}

	s.logger.Info("created dev user", zap.String("email", email), zap.String("type", userType))
	return nil
}

func (s *Seeder) seedSuperAdmin() error {
	email := "superadmin@gradeloop.com"
	password := "Strong#Pass123!"

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	var existingUser domain.User
	if err := s.db.Where("email = ?", email).First(&existingUser).Error; err == nil {
		if existingUser.UserType != "super_admin" {
			if err := s.db.Model(&existingUser).Update("user_type", "super_admin").Error; err != nil {
				return fmt.Errorf("promoting %s to super_admin: %w", email, err)
			}
			s.logger.Info("promoted user to super_admin", zap.String("email", email))
		} else {
			s.logger.Info("super admin already exists", zap.String("email", email))
		}
		return nil
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking for existing user: %w", err)
	}

	user := domain.User{
		ID:                      uuid.New(),
		Email:                   email,
		FullName:                "Super Admin",
		PasswordHash:            string(hashedPassword),
		UserType:                "super_admin",
		IsActive:                true,
		IsPasswordResetRequired: false,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return fmt.Errorf("creating super admin user: %w", err)
	}

	s.logger.Info("created super admin user", zap.String("email", email))
	return nil
}

func (s *Seeder) seedAdmin() error {
	email := "admin@gradeloop.com"
	password := "Strong#Pass123!"

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	var existingUser domain.User
	if err := s.db.Where("email = ?", email).First(&existingUser).Error; err == nil {
		s.logger.Info("admin already exists", zap.String("email", email))
		return nil
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking for existing user: %w", err)
	}

	user := domain.User{
		ID:                      uuid.New(),
		Email:                   email,
		FullName:                "Admin User",
		PasswordHash:            string(hashedPassword),
		UserType:                "admin",
		IsActive:                true,
		IsPasswordResetRequired: false,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return fmt.Errorf("creating admin user: %w", err)
	}

	s.logger.Info("created admin user", zap.String("email", email))
	return nil
}
