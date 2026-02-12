package repositories

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GormSpecializationRepository struct {
	db *gorm.DB
}

func NewGormSpecializationRepository(db *gorm.DB) ports.SpecializationRepository {
	return &GormSpecializationRepository{db: db}
}

func (r *GormSpecializationRepository) CreateSpecialization(ctx context.Context, specialization *models.Specialization) (*models.Specialization, error) {
	err := r.db.WithContext(ctx).Create(specialization).Error
	if err != nil {
		return nil, err
	}
	return r.GetSpecializationByID(ctx, specialization.ID, false)
}

func (r *GormSpecializationRepository) GetSpecializationByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Specialization, error) {
	var specialization models.Specialization
	query := r.db.WithContext(ctx)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.First(&specialization, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &specialization, nil
}

func (r *GormSpecializationRepository) ListSpecializationsByDegree(ctx context.Context, degreeID uuid.UUID, includeInactive bool) ([]models.Specialization, error) {
	var specializations []models.Specialization
	query := r.db.WithContext(ctx).Where("degree_id = ?", degreeID)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Find(&specializations).Error
	return specializations, err
}

func (r *GormSpecializationRepository) UpdateSpecialization(ctx context.Context, specialization *models.Specialization) (*models.Specialization, error) {
	err := r.db.WithContext(ctx).Model(specialization).Omit("ID", "CreatedAt", "DegreeID", "DeletedAt").Updates(specialization).Error
	if err != nil {
		return nil, err
	}
	return r.GetSpecializationByID(ctx, specialization.ID, true)
}

func (r *GormSpecializationRepository) DeleteSpecialization(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.Specialization{}).Where("id = ?", id).Update("is_active", false).Error
}
