package seeder

import (
	"fmt"
	"log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func Seed(db *gorm.DB) error {
	log.Println("Seeding super admin...")
	superAdminEmail := "superadmin@gradeloop.com"
	superAdminPassword := "Strong#Pass123!"

	var user domain.User
	if err := db.Where("email = ?", superAdminEmail).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(superAdminPassword), bcrypt.DefaultCost)
			if err != nil {
				return fmt.Errorf("failed to hash password: %w", err)
			}

			user = domain.User{
				ID:           uuid.New(),
				Email:        superAdminEmail,
				PasswordHash: string(hashedPassword),
				UserType:     "super_admin",
				IsActive:     true,
			}

			if err := db.Create(&user).Error; err != nil {
				return fmt.Errorf("failed to create super admin: %w", err)
			}
			log.Printf("Created super admin user: %s", superAdminEmail)
		} else {
			return fmt.Errorf("failed to check super admin: %w", err)
		}
	} else {
		if user.UserType != "super_admin" {
			if err := db.Model(&user).Update("user_type", "super_admin").Error; err != nil {
				return fmt.Errorf("failed to promote superadmin@gradeloop.com to super_admin: %w", err)
			}
			log.Printf("Promoted superadmin@gradeloop.com from %q to super_admin", user.UserType)
		} else {
			log.Printf("Super admin already exists: %s", superAdminEmail)
		}
	}

	log.Println("Seeding admin...")
	adminEmail := "admin@gradeloop.com"
	adminPassword := "Strong#Pass123!"

	if err := db.Where("email = ?", adminEmail).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
			if err != nil {
				return fmt.Errorf("failed to hash password: %w", err)
			}

			user = domain.User{
				ID:           uuid.New(),
				Email:        adminEmail,
				PasswordHash: string(hashedPassword),
				UserType:     "admin",
				IsActive:     true,
			}

			if err := db.Create(&user).Error; err != nil {
				return fmt.Errorf("failed to create admin: %w", err)
			}
			log.Printf("Created admin user: %s", adminEmail)
		} else {
			return fmt.Errorf("failed to check admin: %w", err)
		}
	} else {
		log.Printf("Admin user already exists: %s", adminEmail)
	}

	return nil
}
