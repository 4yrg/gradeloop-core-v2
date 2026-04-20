package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/domain"
	"gorm.io/gorm"
)

// DepartmentRepository defines the interface for department data operations
type DepartmentRepository interface {
	CreateDepartment(department *domain.Department) error
	UpdateDepartment(department *domain.Department) error
	GetDepartmentByID(id uuid.UUID) (*domain.Department, error)
	GetDepartmentByCodeAndFaculty(code string, facultyID uuid.UUID) (*domain.Department, error)
	ListDepartments(includeInactive bool) ([]domain.Department, error)
	ListDepartmentsByFaculty(facultyID uuid.UUID, includeInactive bool) ([]domain.Department, error)
	SoftDeleteDepartment(id uuid.UUID) error
	DeactivateDepartmentsByFacultyID(facultyID uuid.UUID) error
	DepartmentExists(id uuid.UUID) (bool, error)
}

// departmentRepository is the concrete implementation
type departmentRepository struct {
	db *gorm.DB
}

// NewDepartmentRepository creates a new department repository
func NewDepartmentRepository(db *gorm.DB) DepartmentRepository {
	return &departmentRepository{db: db}
}

// CreateDepartment creates a new department
func (r *departmentRepository) CreateDepartment(department *domain.Department) error {
	return r.db.Create(department).Error
}

// UpdateDepartment updates an existing department
func (r *departmentRepository) UpdateDepartment(department *domain.Department) error {
	return r.db.Save(department).Error
}

// GetDepartmentByID retrieves a department by ID
func (r *departmentRepository) GetDepartmentByID(id uuid.UUID) (*domain.Department, error) {
	var department domain.Department
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).
		Preload("Faculty").
		First(&department).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &department, nil
}

// GetDepartmentByCodeAndFaculty retrieves a department by code and faculty
func (r *departmentRepository) GetDepartmentByCodeAndFaculty(code string, facultyID uuid.UUID) (*domain.Department, error) {
	var department domain.Department
	err := r.db.Where("code = ? AND faculty_id = ? AND deleted_at IS NULL", code, facultyID).
		First(&department).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &department, nil
}

// ListDepartments retrieves all departments
func (r *departmentRepository) ListDepartments(includeInactive bool) ([]domain.Department, error) {
	var departments []domain.Department
	query := r.db.Where("deleted_at IS NULL")

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Preload("Faculty").
		Order("created_at DESC").
		Find(&departments).Error

	if err != nil {
		return nil, err
	}

	return departments, nil
}

// ListDepartmentsByFaculty retrieves all departments for a specific faculty
func (r *departmentRepository) ListDepartmentsByFaculty(facultyID uuid.UUID, includeInactive bool) ([]domain.Department, error) {
	var departments []domain.Department
	query := r.db.Where("faculty_id = ? AND deleted_at IS NULL", facultyID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Preload("Faculty").
		Order("created_at DESC").
		Find(&departments).Error

	if err != nil {
		return nil, err
	}

	return departments, nil
}

// SoftDeleteDepartment soft deletes a department
func (r *departmentRepository) SoftDeleteDepartment(id uuid.UUID) error {
	return r.db.Model(&domain.Department{}).
		Where("id = ?", id).
		Update("deleted_at", gorm.Expr("NOW()")).Error
}

// DeactivateDepartmentsByFacultyID deactivates all departments for a faculty
func (r *departmentRepository) DeactivateDepartmentsByFacultyID(facultyID uuid.UUID) error {
	return r.db.Model(&domain.Department{}).
		Where("faculty_id = ? AND deleted_at IS NULL", facultyID).
		Update("is_active", false).Error
}

// DepartmentExists checks if a department exists
func (r *departmentRepository) DepartmentExists(id uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&domain.Department{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Count(&count).Error

	if err != nil {
		return false, err
	}

	return count > 0, nil
}
