package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type SpecializationRepository interface {
	CreateSpecialization(ctx context.Context, specialization *models.Specialization) (*models.Specialization, error)
	GetSpecializationByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Specialization, error)
	ListSpecializationsByDegree(ctx context.Context, degreeID uuid.UUID, includeInactive bool) ([]models.Specialization, error)
	UpdateSpecialization(ctx context.Context, specialization *models.Specialization) (*models.Specialization, error)
	DeleteSpecialization(ctx context.Context, id uuid.UUID) error
}
