package repositories

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GormDegreeRepository struct {
	db *gorm.DB
}

func NewGormDegreeRepository(db *gorm.DB) ports.DegreeRepository {
	return &GormDegreeRepository{db: db}
}

func (r *GormDegreeRepository) CreateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error) {
	err := r.db.WithContext(ctx).Create(degree).Error
	if err != nil {
		return nil, err
	}
	return r.GetDegreeByID(ctx, degree.ID, false)
}

func (r *GormDegreeRepository) GetDegreeByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Degree, error) {
	var degree models.Degree
	query := r.db.WithContext(ctx)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.First(&degree, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &degree, nil
}

func (r *GormDegreeRepository) ListDegreesByDepartment(ctx context.Context, departmentID uuid.UUID, includeInactive bool) ([]models.Degree, error) {
	var degrees []models.Degree
	query := r.db.WithContext(ctx).Where("department_id = ?", departmentID)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Find(&degrees).Error
	return degrees, err
}

func (r *GormDegreeRepository) UpdateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error) {
	err := r.db.WithContext(ctx).Model(degree).Omit("ID", "CreatedAt", "DepartmentID", "DeletedAt").Updates(degree).Error
	if err != nil {
		return nil, err
	}
	return r.GetDegreeByID(ctx, degree.ID, true)
}

func (r *GormDegreeRepository) DeleteDegree(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.Degree{}).Where("id = ?", id).Update("is_active", false).Error
}
