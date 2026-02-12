package usecases_test

import (
	"context"
	"errors"
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

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

func TestFacultyService_CreateFaculty(t *testing.T) {
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewFacultyService(mockFacultyRepo, mockAuditRepo)
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		req := dto.CreateFacultyRequest{
			Name: "Faculty of Science",
			Code: "FOS",
			Leaders: []dto.LeadershipRequest{
				{UserID: uuid.New(), Role: "Dean"},
			},
		}

		createdFaculty := &models.Faculty{
			ID:   uuid.New(),
			Name: req.Name,
			Code: req.Code,
		}

		mockFacultyRepo.On("CreateFaculty", ctx, mock.AnythingOfType("*models.Faculty"), mock.AnythingOfType("[]models.FacultyLeadership")).Return(createdFaculty, nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

		result, err := service.CreateFaculty(ctx, req)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, createdFaculty.ID, result.ID)
		mockFacultyRepo.AssertExpectations(t)
		mockAuditRepo.AssertExpectations(t)
	})

	t.Run("Fail - No Leaders", func(t *testing.T) {
		req := dto.CreateFacultyRequest{
			Name:    "Faculty of Arts",
			Code:    "FOA",
			Leaders: []dto.LeadershipRequest{}, // Business rule violation
		}

		result, err := service.CreateFaculty(ctx, req)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, "a new faculty must be created with at least one leader", err.Error())
	})

	t.Run("Fail - Repository Error", func(t *testing.T) {
		req := dto.CreateFacultyRequest{
			Name: "Faculty of Engineering",
			Code: "FOE",
			Leaders: []dto.LeadershipRequest{
				{UserID: uuid.New(), Role: "Dean"},
			},
		}
		repoErr := errors.New("database error")

		mockFacultyRepo.On("CreateFaculty", ctx, mock.Anything, mock.Anything).Return(nil, repoErr).Once()

		result, err := service.CreateFaculty(ctx, req)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, repoErr, err)
		mockFacultyRepo.AssertExpectations(t)
	})
}
