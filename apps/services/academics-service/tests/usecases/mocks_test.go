package usecases_test

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

// MockBatchRepository is a mock implementation of ports.BatchRepository
type MockBatchRepository struct {
	mock.Mock
}

func (m *MockBatchRepository) CreateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error) {
	args := m.Called(ctx, batch)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetBatchByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Batch, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetDirectChildren(ctx context.Context, parentID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	args := m.Called(ctx, parentID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetSubtree(ctx context.Context, rootID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	args := m.Called(ctx, rootID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Batch), args.Error(1)
}

func (m *MockBatchRepository) UpdateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error) {
	args := m.Called(ctx, batch)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Batch), args.Error(1)
}

func (m *MockBatchRepository) DeleteBatch(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockBatchRepository) HasCycle(ctx context.Context, batchID uuid.UUID, newParentID uuid.UUID) (bool, error) {
	args := m.Called(ctx, batchID, newParentID)
	return args.Bool(0), args.Error(1)
}

func (m *MockBatchRepository) GetAncestorChain(ctx context.Context, batchID uuid.UUID) ([]models.Batch, error) {
	args := m.Called(ctx, batchID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetAllDescendantIDs(ctx context.Context, rootID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, rootID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// MockDegreeRepository is a mock implementation of ports.DegreeRepository
type MockDegreeRepository struct {
	mock.Mock
}

func (m *MockDegreeRepository) CreateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error) {
	args := m.Called(ctx, degree)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) GetDegreeByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Degree, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) ListDegreesByDepartment(ctx context.Context, departmentID uuid.UUID, includeInactive bool) ([]models.Degree, error) {
	args := m.Called(ctx, departmentID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) UpdateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error) {
	args := m.Called(ctx, degree)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) DeleteDegree(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockSpecializationRepository is a mock implementation of ports.SpecializationRepository
type MockSpecializationRepository struct {
	mock.Mock
}

func (m *MockSpecializationRepository) CreateSpecialization(ctx context.Context, spec *models.Specialization) (*models.Specialization, error) {
	args := m.Called(ctx, spec)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) GetSpecializationByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Specialization, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) ListSpecializationsByDegree(ctx context.Context, degreeID uuid.UUID, includeInactive bool) ([]models.Specialization, error) {
	args := m.Called(ctx, degreeID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) UpdateSpecialization(ctx context.Context, spec *models.Specialization) (*models.Specialization, error) {
	args := m.Called(ctx, spec)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) DeleteSpecialization(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockDepartmentRepository is a mock implementation of ports.DepartmentRepository
type MockDepartmentRepository struct {
	mock.Mock
}

func (m *MockDepartmentRepository) CreateDepartment(ctx context.Context, dept *models.Department) (*models.Department, error) {
	args := m.Called(ctx, dept)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) GetDepartmentByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Department, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) ListDepartmentsByFaculty(ctx context.Context, facultyID uuid.UUID, includeInactive bool) ([]models.Department, error) {
	args := m.Called(ctx, facultyID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) UpdateDepartment(ctx context.Context, dept *models.Department) (*models.Department, error) {
	args := m.Called(ctx, dept)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) DeleteDepartment(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockFacultyRepository is a mock implementation of ports.FacultyRepository
type MockFacultyRepository struct {
	mock.Mock
}

func (m *MockFacultyRepository) CreateFaculty(ctx context.Context, faculty *models.Faculty, leaders []models.FacultyLeadership) (*models.Faculty, error) {
	args := m.Called(ctx, faculty, leaders)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) GetFacultyByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Faculty, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) ListFaculties(ctx context.Context, includeInactive bool) ([]models.Faculty, error) {
	args := m.Called(ctx, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) UpdateFaculty(ctx context.Context, faculty *models.Faculty) (*models.Faculty, error) {
	args := m.Called(ctx, faculty)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) DeleteFaculty(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockFacultyRepository) GetFacultyLeaders(ctx context.Context, facultyID uuid.UUID) ([]models.FacultyLeadership, error) {
	args := m.Called(ctx, facultyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.FacultyLeadership), args.Error(1)
}

// MockAuditRepository is a mock implementation of ports.AuditRepository
type MockAuditRepository struct {
	mock.Mock
}

func (m *MockAuditRepository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	args := m.Called(ctx, log)
	return args.Error(0)
}
