package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type DepartmentRepository interface {
	CreateDepartment(ctx context.Context, department *models.Department) (*models.Department, error)
	GetDepartmentByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Department, error)
	ListDepartmentsByFaculty(ctx context.Context, facultyID uuid.UUID, includeInactive bool) ([]models.Department, error)
	UpdateDepartment(ctx context.Context, department *models.Department) (*models.Department, error)
	DeleteDepartment(ctx context.Context, id uuid.UUID) error
}
