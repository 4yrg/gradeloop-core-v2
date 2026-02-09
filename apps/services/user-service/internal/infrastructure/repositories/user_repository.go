package repositories

import (
	"errors"

	"github.com/4YRG/gradeloop-core-v2/apps/services/user-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) CreateUser(user *models.User, student *models.Student, employee *models.Employee) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		if user.UserType == models.UserTypeStudent {
			if student == nil {
				return errors.New("student data required for student user type")
			}
			student.UserID = user.ID
			if err := tx.Create(student).Error; err != nil {
				return err
			}
		} else if user.UserType == models.UserTypeEmployee {
			if employee == nil {
				return errors.New("employee data required for employee user type")
			}
			employee.UserID = user.ID
			if err := tx.Create(employee).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *UserRepository) GetUser(id uuid.UUID, includeDeleted bool) (*models.User, error) {
	var user models.User
	query := r.db
	if includeDeleted {
		query = query.Unscoped()
	}

	// Preload logic not specified? Assuming lazy load or separate call if needed.
	// But requirement says "User CRUD", so maybe we should return subtype info too?
	// Assuming basic user fetch for now as per function signature.

	err := query.First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetUserByEmail(email string, includeDeleted bool) (*models.User, error) {
	var user models.User
	query := r.db
	if includeDeleted {
		query = query.Unscoped()
	}
	err := query.First(&user, "email = ?", email).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) UpdateUser(user *models.User) error {
	// Block user_type and created_at updates
	// Ensure we don't update ID either (though it's PK)
	// Using Omit to exclude specific fields
	return r.db.Model(user).Omit("UserType", "CreatedAt", "ID").Updates(user).Error
}

func (r *UserRepository) DeleteUser(id uuid.UUID) error {
	// Soft delete is default with GORM DeletedAt
	return r.db.Delete(&models.User{}, id).Error
}
