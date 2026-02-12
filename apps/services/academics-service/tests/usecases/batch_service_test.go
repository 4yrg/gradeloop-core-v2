package usecases_test

import (
	"context"
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
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

// Test: Create root batch successfully
func TestBatchService_CreateRootBatch_Success(t *testing.T) {
	mockBatchRepo := new(MockBatchRepository)
	mockDegreeRepo := new(MockDegreeRepository)
	mockSpecRepo := new(MockSpecializationRepository)
	mockDeptRepo := new(MockDepartmentRepository)
	mockAuditRepo := new(MockAuditRepository)

	service := usecases.NewBatchService(mockBatchRepo, mockDegreeRepo, mockSpecRepo, mockDeptRepo, mockAuditRepo)

	degreeID := uuid.New()
	deptID := uuid.New()
	facultyID := uuid.New()

	ctx := context.WithValue(context.Background(), "user_id", uuid.New().String())
	ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

	degree := &models.Degree{
		ID:           degreeID,
		DepartmentID: deptID,
		Name:         "BSc IT",
		Code:         "BSCIT",
		Level:        models.DegreeLevelUndergraduate,
		IsActive:     true,
	}

	department := &models.Department{
		ID:        deptID,
		FacultyID: facultyID,
		Name:      "IT Department",
		Code:      "IT",
		IsActive:  true,
	}

	req := dto.CreateBatchRequest{
		DegreeID:  &degreeID,
		Name:      "IT Class of 2025",
		Code:      "IT2025",
		StartYear: 2025,
		EndYear:   2029,
	}

	createdBatch := &models.Batch{
		ID:        uuid.New(),
		DegreeID:  degreeID,
		Name:      req.Name,
		Code:      req.Code,
		StartYear: req.StartYear,
		EndYear:   req.EndYear,
		IsActive:  true,
	}

	mockDegreeRepo.On("GetDegreeByID", ctx, degreeID, false).Return(degree, nil).Once()
	mockDeptRepo.On("GetDepartmentByID", ctx, deptID, true).Return(department, nil).Once()
	mockBatchRepo.On("CreateBatch", ctx, mock.AnythingOfType("*models.Batch")).Return(createdBatch, nil).Once()
	mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

	result, err := service.CreateBatch(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, createdBatch.ID, result.ID)
	mockBatchRepo.AssertExpectations(t)
	mockDegreeRepo.AssertExpectations(t)
	mockDeptRepo.AssertExpectations(t)
	mockAuditRepo.AssertExpectations(t)
}

// Test: Create root batch without degree_id should fail
func TestBatchService_CreateRootBatch_MissingDegreeID(t *testing.T) {
	mockBatchRepo := new(MockBatchRepository)
	mockDegreeRepo := new(MockDegreeRepository)
	mockSpecRepo := new(MockSpecializationRepository)
	mockDeptRepo := new(MockDepartmentRepository)
	mockAuditRepo := new(MockAuditRepository)

	service := usecases.NewBatchService(mockBatchRepo, mockDegreeRepo, mockSpecRepo, mockDeptRepo, mockAuditRepo)

	ctx := context.WithValue(context.Background(), "user_id", uuid.New().String())
	ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

	req := dto.CreateBatchRequest{
		Name:      "IT Class of 2025",
		Code:      "IT2025",
		StartYear: 2025,
		EndYear:   2029,
	}

	result, err := service.CreateBatch(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "degree_id is required for root batches")
}

// Test: Create child batch with parent
func TestBatchService_CreateChildBatch_Success(t *testing.T) {
	mockBatchRepo := new(MockBatchRepository)
	mockDegreeRepo := new(MockDegreeRepository)
	mockSpecRepo := new(MockSpecializationRepository)
	mockDeptRepo := new(MockDepartmentRepository)
	mockAuditRepo := new(MockAuditRepository)

	service := usecases.NewBatchService(mockBatchRepo, mockDegreeRepo, mockSpecRepo, mockDeptRepo, mockAuditRepo)

	parentID := uuid.New()
	degreeID := uuid.New()
	deptID := uuid.New()
	facultyID := uuid.New()

	ctx := context.WithValue(context.Background(), "user_id", uuid.New().String())
	ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

	parent := &models.Batch{
		ID:        parentID,
		DegreeID:  degreeID,
		Name:      "IT Class of 2025",
		Code:      "IT2025",
		StartYear: 2025,
		EndYear:   2029,
		IsActive:  true,
	}

	degree := &models.Degree{
		ID:           degreeID,
		DepartmentID: deptID,
		Name:         "BSc IT",
		Code:         "BSCIT",
		Level:        models.DegreeLevelUndergraduate,
		IsActive:     true,
	}

	department := &models.Department{
		ID:        deptID,
		FacultyID: facultyID,
		Name:      "IT Department",
		Code:      "IT",
		IsActive:  true,
	}

	req := dto.CreateBatchRequest{
		ParentID:  &parentID,
		Name:      "SE Track",
		Code:      "IT2025-SE",
		StartYear: 2025,
		EndYear:   2029,
	}

	createdBatch := &models.Batch{
		ID:        uuid.New(),
		ParentID:  &parentID,
		DegreeID:  degreeID,
		Name:      req.Name,
		Code:      req.Code,
		StartYear: req.StartYear,
		EndYear:   req.EndYear,
		IsActive:  true,
	}

	mockBatchRepo.On("GetBatchByID", ctx, parentID, false).Return(parent, nil).Once()
	mockBatchRepo.On("HasCycle", ctx, mock.AnythingOfType("uuid.UUID"), parentID).Return(false, nil).Once()
	mockDegreeRepo.On("GetDegreeByID", ctx, degreeID, false).Return(degree, nil).Once()
	mockDeptRepo.On("GetDepartmentByID", ctx, deptID, true).Return(department, nil).Once()
	mockBatchRepo.On("CreateBatch", ctx, mock.AnythingOfType("*models.Batch")).Return(createdBatch, nil).Once()
	mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

	result, err := service.CreateBatch(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, createdBatch.ID, result.ID)
	mockBatchRepo.AssertExpectations(t)
	mockDegreeRepo.AssertExpectations(t)
	mockDeptRepo.AssertExpectations(t)
	mockAuditRepo.AssertExpectations(t)
}

// Test: Invalid year range should fail
func TestBatchService_CreateBatch_InvalidYearRange(t *testing.T) {
	mockBatchRepo := new(MockBatchRepository)
	mockDegreeRepo := new(MockDegreeRepository)
	mockSpecRepo := new(MockSpecializationRepository)
	mockDeptRepo := new(MockDepartmentRepository)
	mockAuditRepo := new(MockAuditRepository)

	service := usecases.NewBatchService(mockBatchRepo, mockDegreeRepo, mockSpecRepo, mockDeptRepo, mockAuditRepo)

	ctx := context.WithValue(context.Background(), "user_id", uuid.New().String())
	ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

	degreeID := uuid.New()
	req := dto.CreateBatchRequest{
		DegreeID:  &degreeID,
		Name:      "IT Class of 2025",
		Code:      "IT2025",
		StartYear: 2029,
		EndYear:   2025, // Invalid: end_year <= start_year
	}

	result, err := service.CreateBatch(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "end_year must be greater than start_year")
}

// Test: Delete batch with cascade
func TestBatchService_DeleteBatch_WithCascade(t *testing.T) {
	mockBatchRepo := new(MockBatchRepository)
	mockDegreeRepo := new(MockDegreeRepository)
	mockSpecRepo := new(MockSpecializationRepository)
	mockDeptRepo := new(MockDepartmentRepository)
	mockAuditRepo := new(MockAuditRepository)

	service := usecases.NewBatchService(mockBatchRepo, mockDegreeRepo, mockSpecRepo, mockDeptRepo, mockAuditRepo)

	batchID := uuid.New()
	childID1 := uuid.New()
	childID2 := uuid.New()
	degreeID := uuid.New()
	deptID := uuid.New()
	facultyID := uuid.New()

	ctx := context.WithValue(context.Background(), "user_id", uuid.New().String())
	ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

	batch := &models.Batch{
		ID:        batchID,
		DegreeID:  degreeID,
		Name:      "IT Class of 2025",
		Code:      "IT2025",
		StartYear: 2025,
		EndYear:   2029,
		IsActive:  true,
	}

	degree := &models.Degree{
		ID:           degreeID,
		DepartmentID: deptID,
		Name:         "BSc IT",
		Code:         "BSCIT",
		Level:        models.DegreeLevelUndergraduate,
		IsActive:     true,
	}

	department := &models.Department{
		ID:        deptID,
		FacultyID: facultyID,
		Name:      "IT Department",
		Code:      "IT",
		IsActive:  true,
	}

	child1 := &models.Batch{ID: childID1, DegreeID: degreeID, IsActive: true}
	child2 := &models.Batch{ID: childID2, DegreeID: degreeID, IsActive: true}

	mockBatchRepo.On("GetBatchByID", ctx, batchID, true).Return(batch, nil).Once()
	mockDegreeRepo.On("GetDegreeByID", ctx, degreeID, true).Return(degree, nil).Once()
	mockDeptRepo.On("GetDepartmentByID", ctx, deptID, true).Return(department, nil).Once()
	mockBatchRepo.On("GetAllDescendantIDs", ctx, batchID).Return([]uuid.UUID{childID1, childID2}, nil).Once()
	mockBatchRepo.On("GetBatchByID", ctx, childID1, true).Return(child1, nil).Once()
	mockBatchRepo.On("DeleteBatch", ctx, childID1).Return(nil).Once()
	mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Times(3)
	mockBatchRepo.On("GetBatchByID", ctx, childID2, true).Return(child2, nil).Once()
	mockBatchRepo.On("DeleteBatch", ctx, childID2).Return(nil).Once()
	mockBatchRepo.On("DeleteBatch", ctx, batchID).Return(nil).Once()

	err := service.DeleteBatch(ctx, batchID)

	assert.NoError(t, err)
	mockBatchRepo.AssertExpectations(t)
	mockDegreeRepo.AssertExpectations(t)
	mockDeptRepo.AssertExpectations(t)
	mockAuditRepo.AssertExpectations(t)
}
