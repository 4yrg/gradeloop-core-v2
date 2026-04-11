package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/gradeloop/academic-service/internal/domain"
	"gorm.io/gorm"
)

// SpecializationRepository defines the interface for specialization data operations
type SpecializationRepository interface {
	CreateSpecialization(spec *domain.Specialization) error
	UpdateSpecialization(spec *domain.Specialization) error
	GetSpecializationByID(id uuid.UUID) (*domain.Specialization, error)
	ListSpecializationsByDegree(degreeID uuid.UUID, includeInactive bool) ([]domain.Specialization, error)
	SoftDeleteSpecialization(id uuid.UUID) error
	DeactivateByDegreeID(degreeID uuid.UUID) error
}

// specializationRepository is the concrete implementation
type specializationRepository struct {
	db *gorm.DB
}

// NewSpecializationRepository creates a new specialization repository
func NewSpecializationRepository(db *gorm.DB) SpecializationRepository {
	return &specializationRepository{db: db}
}

// CreateSpecialization creates a new specialization
func (r *specializationRepository) CreateSpecialization(spec *domain.Specialization) error {
	return r.db.Create(spec).Error
}

// UpdateSpecialization updates an existing specialization
func (r *specializationRepository) UpdateSpecialization(spec *domain.Specialization) error {
	return r.db.Save(spec).Error
}

// GetSpecializationByID retrieves a specialization by ID
func (r *specializationRepository) GetSpecializationByID(id uuid.UUID) (*domain.Specialization, error) {
	var spec domain.Specialization
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).
		First(&spec).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &spec, nil
}

// ListSpecializationsByDegree retrieves all specializations for a specific degree
func (r *specializationRepository) ListSpecializationsByDegree(degreeID uuid.UUID, includeInactive bool) ([]domain.Specialization, error) {
	var specs []domain.Specialization
	query := r.db.Where("degree_id = ? AND deleted_at IS NULL", degreeID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Order("created_at DESC").Find(&specs).Error
	if err != nil {
		return nil, err
	}

	return specs, nil
}

// SoftDeleteSpecialization soft deletes a specialization
func (r *specializationRepository) SoftDeleteSpecialization(id uuid.UUID) error {
	return r.db.Model(&domain.Specialization{}).
		Where("id = ?", id).
		Update("deleted_at", gorm.Expr("NOW()")).Error
}

// DeactivateByDegreeID deactivates all specializations for a degree
func (r *specializationRepository) DeactivateByDegreeID(degreeID uuid.UUID) error {
	return r.db.Model(&domain.Specialization{}).
		Where("degree_id = ? AND deleted_at IS NULL", degreeID).
		Update("is_active", false).Error
}
