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
