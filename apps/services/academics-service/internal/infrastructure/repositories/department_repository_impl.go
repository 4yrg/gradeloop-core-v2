package repositories

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GormDepartmentRepository struct {
	db *gorm.DB
}

func NewGormDepartmentRepository(db *gorm.DB) ports.DepartmentRepository {
	return &GormDepartmentRepository{db: db}
}

func (r *GormDepartmentRepository) CreateDepartment(ctx context.Context, department *models.Department) (*models.Department, error) {
	err := r.db.WithContext(ctx).Create(department).Error
	if err != nil {
		return nil, err
	}
	return r.GetDepartmentByID(ctx, department.ID, false)
}

func (r *GormDepartmentRepository) GetDepartmentByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Department, error) {
	var department models.Department
	query := r.db.WithContext(ctx)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.First(&department, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &department, nil
}

func (r *GormDepartmentRepository) ListDepartmentsByFaculty(ctx context.Context, facultyID uuid.UUID, includeInactive bool) ([]models.Department, error) {
	var departments []models.Department
	query := r.db.WithContext(ctx).Where("faculty_id = ?", facultyID)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Find(&departments).Error
	return departments, err
}

func (r *GormDepartmentRepository) UpdateDepartment(ctx context.Context, department *models.Department) (*models.Department, error) {
	err := r.db.WithContext(ctx).Model(department).Omit("ID", "CreatedAt", "FacultyID", "DeletedAt").Updates(department).Error
	if err != nil {
		return nil, err
	}
	return r.GetDepartmentByID(ctx, department.ID, true)
}

func (r *GormDepartmentRepository) DeleteDepartment(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.Department{}).Where("id = ?", id).Update("is_active", false).Error
}
