package repositories

import (
	"errors"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
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
		// Omit Student and Employee associations during the base user creation to prevent
		// GORM from attempting to insert them twice or with zeroed values.
		if err := tx.Omit("Student", "Employee").Create(user).Error; err != nil {
			return err
		}

		if user.UserType == models.UserTypeStudent {
			if student == nil {
				return errors.New("student data required for student user type")
			}
			student.ID = user.ID
			if err := tx.Create(student).Error; err != nil {
				return err
			}
		} else if user.UserType == models.UserTypeEmployee {
			if employee == nil {
				return errors.New("employee data required for employee user type")
			}
			employee.ID = user.ID
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

	err := query.Preload("Student").Preload("Employee").Preload("Roles").First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) ListUsers(page, limit int, includeDeleted bool) ([]models.User, int64, error) {
	var users []models.User
	var total int64
	query := r.db.Model(&models.User{})

	if includeDeleted {
		query = query.Unscoped()
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err := query.Preload("Student").Preload("Employee").Preload("Roles").Offset(offset).Limit(limit).Find(&users).Error
	return users, total, err
}

func (r *UserRepository) UpdateUser(user *models.User, student *models.Student, employee *models.Employee) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existingUser models.User
		if err := tx.First(&existingUser, "id = ?", user.ID).Error; err != nil {
			return err
		}

		// Prevent switching user subtype if provided
		if user.UserType != "" && existingUser.UserType != user.UserType {
			return errors.New("changing user type is not allowed")
		}

		// Update base user fields
		if err := tx.Model(user).Omit("UserType", "CreatedAt", "ID", "PasswordHash", "Student", "Employee").Updates(user).Error; err != nil {
			return err
		}

		// Update subtype fields based on existing user type
		if existingUser.UserType == models.UserTypeStudent && student != nil {
			student.ID = user.ID
			if err := tx.Model(&models.Student{}).Where("id = ?", user.ID).Updates(student).Error; err != nil {
				return err
			}
		} else if existingUser.UserType == models.UserTypeEmployee && employee != nil {
			employee.ID = user.ID
			if err := tx.Model(&models.Employee{}).Where("id = ?", user.ID).Updates(employee).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *UserRepository) GetUserByEmail(email string, includeDeleted bool) (*models.User, error) {
	var user models.User
	query := r.db
	if includeDeleted {
		query = query.Unscoped()
	}
	err := query.Preload("Roles").First(&user, "email = ?", email).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) UpdateActivationFields(user *models.User) error {
	return r.db.Model(user).Select("PasswordHash", "PasswordSetAt", "PasswordChangedAt", "ActivationTokenID", "IsPasswordResetRequired").Updates(user).Error
}

func (r *UserRepository) DeleteUser(id uuid.UUID) error {
	// Soft delete is default with GORM DeletedAt
	return r.db.Delete(&models.User{}, id).Error
}

func (r *UserRepository) GetPermissionsByUserID(userID uuid.UUID) ([]string, error) {
	var permissions []string

	// Join users -> users_roles -> roles -> roles_permissions -> permissions
	err := r.db.Table("permissions").
		Joins("JOIN roles_permissions ON roles_permissions.permission_id = permissions.id").
		Joins("JOIN roles ON roles.id = roles_permissions.role_id").
		Joins("JOIN users_roles ON users_roles.role_id = roles.id").
		Where("users_roles.user_id = ?", userID).
		Pluck("permissions.name", &permissions).Error

	if err != nil {
		return nil, err
	}

	return permissions, nil
}

func (r *UserRepository) GetRolesByUserID(userID uuid.UUID) ([]string, error) {
	var roles []string

	err := r.db.Table("roles").
		Joins("JOIN users_roles ON users_roles.role_id = roles.id").
		Where("users_roles.user_id = ?", userID).
		Pluck("roles.role_name", &roles).Error

	if err != nil {
		return nil, err
	}

	return roles, nil
}

func (r *UserRepository) RestoreUser(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.Unscoped().First(&user, "id = ?", id).Error; err != nil {
			return err
		}

		// Check for email conflict with any active user
		var existingUser models.User
		if err := tx.Where("email = ?", user.Email).First(&existingUser).Error; err == nil {
			return errors.New("cannot restore: another active user with the same email already exists")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		return tx.Unscoped().Model(&user).Update("deleted_at", nil).Error
	})
}
