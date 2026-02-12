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

func TestDepartmentService_CreateDepartment(t *testing.T) {
	mockDeptRepo := new(MockDepartmentRepository)
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewDepartmentService(mockDeptRepo, mockFacultyRepo, mockAuditRepo)

	facultyID := uuid.New()
	userID := uuid.New()
	userFacultyID := facultyID

	req := dto.CreateDepartmentRequest{
		Name: "Dept. of AI",
		Code: "DAI",
	}

	t.Run("Success - Super Admin", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(&models.Faculty{ID: facultyID, IsActive: true}, nil).Once()
		mockDeptRepo.On("CreateDepartment", ctx, mock.AnythingOfType("*models.Department")).Return(&models.Department{ID: uuid.New()}, nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.NoError(t, err)
		mockFacultyRepo.AssertExpectations(t)
		mockDeptRepo.AssertExpectations(t)
		mockAuditRepo.AssertExpectations(t)
	})

	t.Run("Success - Faculty Admin", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"faculty_admin"})
		ctx = context.WithValue(ctx, "faculty_id", userFacultyID.String())

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(&models.Faculty{ID: facultyID, IsActive: true}, nil).Once()
		mockDeptRepo.On("CreateDepartment", ctx, mock.AnythingOfType("*models.Department")).Return(&models.Department{ID: uuid.New()}, nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.NoError(t, err)
		mockFacultyRepo.AssertExpectations(t)
		mockDeptRepo.AssertExpectations(t)
		mockAuditRepo.AssertExpectations(t)
	})

	t.Run("Fail - Unauthorized", func(t *testing.T) {
		otherFacultyID := uuid.New()
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"faculty_admin"})
		ctx = context.WithValue(ctx, "faculty_id", otherFacultyID.String()) // Belongs to another faculty

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(&models.Faculty{ID: facultyID, IsActive: true}, nil).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Forbidden")
		mockFacultyRepo.AssertExpectations(t)
	})

	t.Run("Fail - Inactive Faculty", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(nil, errors.New("not found")).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Active faculty not found")
		mockFacultyRepo.AssertExpectations(t)
	})
}
