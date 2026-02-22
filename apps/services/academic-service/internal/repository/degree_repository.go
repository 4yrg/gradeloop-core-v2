package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/gradeloop/academic-service/internal/domain"
	"gorm.io/gorm"
)

// DegreeRepository defines degree data operations
type DegreeRepository interface {
	CreateDegree(degree *domain.Degree) error
	UpdateDegree(degree *domain.Degree) error
	GetDegreeByID(id uuid.UUID) (*domain.Degree, error)
	ListDegrees(includeInactive bool) ([]domain.Degree, error)
	ListDegreesByDepartment(departmentID uuid.UUID, includeInactive bool) ([]domain.Degree, error)
	SoftDeleteDegree(id uuid.UUID) error
}

// degreeRepository is the concrete implementation
type degreeRepository struct {
	db *gorm.DB
}

// NewDegreeRepository creates a new degree repository
func NewDegreeRepository(db *gorm.DB) DegreeRepository {
	return &degreeRepository{db: db}
}

// CreateDegree creates a new degree
func (r *degreeRepository) CreateDegree(degree *domain.Degree) error {
	return r.db.Create(degree).Error
}

// UpdateDegree updates an existing degree
func (r *degreeRepository) UpdateDegree(degree *domain.Degree) error {
	return r.db.Save(degree).Error
}

// GetDegreeByID retrieves a degree by ID
func (r *degreeRepository) GetDegreeByID(id uuid.UUID) (*domain.Degree, error) {
	var degree domain.Degree
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).
		Preload("Specializations", "deleted_at IS NULL").
		First(&degree).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &degree, nil
}

// ListDegrees retrieves all degrees
func (r *degreeRepository) ListDegrees(includeInactive bool) ([]domain.Degree, error) {
	var degrees []domain.Degree
	query := r.db.Where("deleted_at IS NULL")

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.
		Preload("Specializations", "deleted_at IS NULL AND is_active = ?", true).
		Order("created_at DESC").
		Find(&degrees).Error

	if err != nil {
		return nil, err
	}

	return degrees, nil
}

// ListDegreesByDepartment retrieves all degrees for a specific department
func (r *degreeRepository) ListDegreesByDepartment(departmentID uuid.UUID, includeInactive bool) ([]domain.Degree, error) {
	var degrees []domain.Degree
	query := r.db.Where("department_id = ? AND deleted_at IS NULL", departmentID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.
		Preload("Specializations", "deleted_at IS NULL AND is_active = ?", true).
		Order("created_at DESC").
		Find(&degrees).Error

	if err != nil {
		return nil, err
	}

	return degrees, nil
}

// SoftDeleteDegree soft deletes a degree (sets deleted_at)
func (r *degreeRepository) SoftDeleteDegree(id uuid.UUID) error {
	return r.db.Model(&domain.Degree{}).
		Where("id = ?", id).
		Update("deleted_at", gorm.Expr("NOW()")).Error
}
