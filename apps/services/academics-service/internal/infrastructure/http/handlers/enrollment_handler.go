package handlers

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type EnrollmentHandler struct {
	service *usecases.EnrollmentService
}

func NewEnrollmentHandler(service *usecases.EnrollmentService) *EnrollmentHandler {
	return &EnrollmentHandler{service: service}
}

// Batch Membership

func (h *EnrollmentHandler) AddBatchMember(c fiber.Ctx) error {
	batchID, err := uuid.Parse(c.Params("batch_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch_id"})
	}

	var req dto.CreateBatchMemberRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	member, err := h.service.AddBatchMember(c.Context(), batchID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(member)
}

func (h *EnrollmentHandler) GetBatchMembers(c fiber.Ctx) error {
	batchID, err := uuid.Parse(c.Params("batch_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch_id"})
	}

	members, err := h.service.GetBatchMembers(c.Context(), batchID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(members)
}

func (h *EnrollmentHandler) UpdateBatchMember(c fiber.Ctx) error {
	batchID, err := uuid.Parse(c.Params("batch_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch_id"})
	}
	userID, err := uuid.Parse(c.Params("user_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_id"})
	}

	var req dto.UpdateBatchMemberRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	member, err := h.service.UpdateBatchMember(c.Context(), batchID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(member)
}

// Course Instance

func (h *EnrollmentHandler) CreateCourseInstance(c fiber.Ctx) error {
	var req dto.CreateCourseInstanceRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	instance, err := h.service.CreateCourseInstance(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(instance)
}

func (h *EnrollmentHandler) GetCourseInstance(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	instance, err := h.service.GetCourseInstance(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "course instance not found"})
	}

	return c.JSON(instance)
}

func (h *EnrollmentHandler) UpdateCourseInstance(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	var req dto.UpdateCourseInstanceRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	instance, err := h.service.UpdateCourseInstance(c.Context(), id, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(instance)
}

// Course Instructors

func (h *EnrollmentHandler) AssignInstructor(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	var req dto.AssignInstructorRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	assignment, err := h.service.AssignInstructor(c.Context(), id, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(assignment)
}

func (h *EnrollmentHandler) RemoveInstructor(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	userID, err := uuid.Parse(c.Params("user_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_id"})
	}

	if err := h.service.RemoveInstructor(c.Context(), id, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *EnrollmentHandler) GetCourseInstructors(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	instructors, err := h.service.GetCourseInstructors(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(instructors)
}

// Course Enrollment

func (h *EnrollmentHandler) EnrollStudent(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	var req dto.EnrollStudentRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	enrollment, err := h.service.EnrollStudent(c.Context(), id, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(enrollment)
}

func (h *EnrollmentHandler) GetEnrollments(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	enrollments, err := h.service.GetEnrollments(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(enrollments)
}

func (h *EnrollmentHandler) UpdateEnrollment(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	userID, err := uuid.Parse(c.Params("user_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_id"})
	}

	var req dto.UpdateEnrollmentRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	enrollment, err := h.service.UpdateEnrollment(c.Context(), id, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(enrollment)
}
