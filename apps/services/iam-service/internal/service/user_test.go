package service_test

import (
	"context"
	"errors"
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/dto"
	repoMocks "github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/repository/mocks"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestUserService_CreateUser(t *testing.T) {
	mockUserRepo := new(repoMocks.UserRepository)
	mockRoleRepo := new(repoMocks.RoleRepository)
	mockAuditRepo := new(repoMocks.AuditRepository)
	userService := service.NewUserService(mockUserRepo, mockRoleRepo, mockAuditRepo)

	t.Run("Success", func(t *testing.T) {
		req := dto.CreateUserRequest{
			Email: "test@example.com",
			// Username: "testuser", // Removed from DTO
			FullName:     "Test User",
			UserType:     "EMPLOYEE",
			EmployeeID:   &[]string{"EMP001"}[0],
			Designation:  &[]string{"Engineer"}[0],
			EmployeeType: &[]string{"FullTime"}[0],
		}

		mockUserRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(nil, errors.New("not found")) // User shouldn't exist
		mockUserRepo.On("Create", mock.Anything, mock.MatchedBy(func(u *domain.User) bool {
			return u.Email == "test@example.com" && u.UserType == domain.UserTypeEmployee
		})).Return(nil)

		mockAuditRepo.On("Create", mock.Anything, mock.Anything).Return(nil)

		user, tempPass, err := userService.CreateUser(context.Background(), req)

		assert.NoError(t, err)
		assert.NotNil(t, user)
		assert.NotEmpty(t, tempPass)
		assert.Equal(t, "test@example.com", user.Email)
		mockUserRepo.AssertExpectations(t)
	})

	t.Run("EmailAlreadyExists", func(t *testing.T) {
		req := dto.CreateUserRequest{
			Email:    "existing@example.com",
			UserType: "EMPLOYEE",
			// other fields
		}

		existingUser := &domain.User{Email: "existing@example.com"}
		mockUserRepo.On("FindByEmail", mock.Anything, "existing@example.com").Return(existingUser, nil)

		user, _, err := userService.CreateUser(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, user)
		// assert.Equal(t, 409, err.(*errors.AppError).Code) // Check error type if needed
	})

	t.Run("ValidationError_Student", func(t *testing.T) {
		req := dto.CreateUserRequest{
			Email:    "student@example.com",
			UserType: "STUDENT",
			// Missing EnrollmentDate and StudentID
		}

		mockUserRepo.On("FindByEmail", mock.Anything, "student@example.com").Return(nil, errors.New("not found"))

		user, _, err := userService.CreateUser(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, user)
		assert.Contains(t, err.Error(), "Student details")
	})
}
