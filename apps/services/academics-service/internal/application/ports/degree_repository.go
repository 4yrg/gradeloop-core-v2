package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type DegreeRepository interface {
	CreateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error)
	GetDegreeByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Degree, error)
	ListDegreesByDepartment(ctx context.Context, departmentID uuid.UUID, includeInactive bool) ([]models.Degree, error)
	UpdateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error)
	DeleteDegree(ctx context.Context, id uuid.UUID) error
}
