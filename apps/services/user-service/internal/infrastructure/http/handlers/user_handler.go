package handlers

import (
	"errors"

	"github.com/4YRG/gradeloop-core-v2/apps/services/user-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/user-service/internal/domain/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateUserRequest struct {
	*models.User
	Student  *models.Student  `json:"student,omitempty"`
	Employee *models.Employee `json:"employee,omitempty"`
	Password string           `json:"password"`
}

type UserHandler struct {
	usecase *usecases.UserUsecase
}

func NewUserHandler(uc *usecases.UserUsecase) *UserHandler {
	return &UserHandler{usecase: uc}
}

func (h *UserHandler) CreateUser(ctx fiber.Ctx) error {
	var req CreateUserRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	if req.User == nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User data is required"})
	}

	if err := h.usecase.RegisterUser(req.User, req.Student, req.Employee, req.Password); err != nil {
		// Map specific errors if possible (e.g. conflict)
		// Assuming repo/gorm returns duplicate key error for conflict
		// Simple string check for now or specific error type check
		return ctx.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}

	// Don't return password hash
	req.User.PasswordHash = ""
	return ctx.Status(fiber.StatusCreated).JSON(req.User)
}

func (h *UserHandler) GetUser(ctx fiber.Ctx) error {
	idParam := ctx.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	includeDeleted := ctx.Query("include_deleted") == "true"

	user, err := h.usecase.GetUser(id, includeDeleted)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusOK).JSON(user)
}

func (h *UserHandler) UpdateUser(ctx fiber.Ctx) error {
	idParam := ctx.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	var user models.User
	if err := ctx.Bind().Body(&user); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	user.ID = id // Ensure ID matches URL

	if err := h.usecase.UpdateUser(&user); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusOK).JSON(user)
}

func (h *UserHandler) DeleteUser(ctx fiber.Ctx) error {
	idParam := ctx.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	if err := h.usecase.DeleteUser(id); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.SendStatus(fiber.StatusNoContent)
}
