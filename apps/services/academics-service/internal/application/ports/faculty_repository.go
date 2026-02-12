package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type FacultyRepository interface {
	CreateFaculty(ctx context.Context, faculty *models.Faculty, leaders []models.FacultyLeadership) (*models.Faculty, error)
	GetFacultyByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Faculty, error)
	ListFaculties(ctx context.Context, includeInactive bool) ([]models.Faculty, error)
	UpdateFaculty(ctx context.Context, faculty *models.Faculty) (*models.Faculty, error)
	DeleteFaculty(ctx context.Context, id uuid.UUID) error
	GetFacultyLeaders(ctx context.Context, facultyID uuid.UUID) ([]models.FacultyLeadership, error)
}
