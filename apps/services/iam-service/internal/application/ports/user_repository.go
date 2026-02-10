package ports

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
)

type UserRepository interface {
	CreateUser(user *models.User, student *models.Student, employee *models.Employee) error
	GetUser(id uuid.UUID, includeDeleted bool) (*models.User, error)
	GetUserByEmail(email string, includeDeleted bool) (*models.User, error)
	ListUsers(page, limit int, includeDeleted bool) ([]models.User, int64, error)
	UpdateUser(user *models.User, student *models.Student, employee *models.Employee) error
	UpdateActivationFields(user *models.User) error
	DeleteUser(id uuid.UUID) error
	GetPermissionsByUserID(userID uuid.UUID) ([]string, error)
	GetRolesByUserID(userID uuid.UUID) ([]string, error)
	RestoreUser(id uuid.UUID) error
}
