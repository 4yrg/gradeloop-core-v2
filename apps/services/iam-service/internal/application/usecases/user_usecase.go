package usecases

import (
	"errors"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserUsecase struct {
	repo ports.UserRepository
}

func NewUserUsecase(repo ports.UserRepository) *UserUsecase {
	return &UserUsecase{repo: repo}
}

func (uc *UserUsecase) RegisterUser(user *models.User, student *models.Student, employee *models.Employee, password string) error {
	// Validation: EnrollmentDate <= today
	if user.UserType == models.UserTypeStudent && student != nil {
		if student.EnrollmentDate.After(time.Now()) {
			return errors.New("enrollment date cannot be in the future")
		}
	}

	// Password Hashing
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	user.PasswordHash = string(hash)

	return uc.repo.CreateUser(user, student, employee)
}

func (uc *UserUsecase) GetUser(id uuid.UUID, includeDeleted bool) (*models.User, error) {
	return uc.repo.GetUser(id, includeDeleted)
}

func (uc *UserUsecase) ListUsers(page, limit int, includeDeleted bool) ([]models.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	return uc.repo.ListUsers(page, limit, includeDeleted)
}

func (uc *UserUsecase) UpdateUser(user *models.User, student *models.Student, employee *models.Employee) error {
	return uc.repo.UpdateUser(user, student, employee)
}

func (uc *UserUsecase) DeleteUser(id uuid.UUID) error {
	return uc.repo.DeleteUser(id)
}
