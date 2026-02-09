package usecases

import (
	"errors"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/user-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/user-service/internal/infrastructure/repositories"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserUsecase struct {
	repo *repositories.UserRepository
}

func NewUserUsecase(repo *repositories.UserRepository) *UserUsecase {
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

func (uc *UserUsecase) UpdateUser(user *models.User) error {
	// Business logic: prevent user_type change is enforced in repo
	return uc.repo.UpdateUser(user)
}

func (uc *UserUsecase) DeleteUser(id uuid.UUID) error {
	return uc.repo.DeleteUser(id)
}
