package handler

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/client"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// StudentHandler handles student-scoped HTTP requests such as listing the
// courses a student is enrolled in.
type StudentHandler struct {
	enrollmentService       service.EnrollmentService
	courseInstructorService service.CourseInstructorService
	courseService           service.CourseService
	semesterService         service.SemesterService
	batchService            service.BatchService
	iamClient               *client.IAMClient
	logger                  *zap.Logger
}

// NewStudentHandler wires all dependencies together.
func NewStudentHandler(
	enrollmentService service.EnrollmentService,
	courseInstructorService service.CourseInstructorService,
	courseService service.CourseService,
	semesterService service.SemesterService,
	batchService service.BatchService,
	iamClient *client.IAMClient,
	logger *zap.Logger,
) *StudentHandler {
	return &StudentHandler{
		enrollmentService:       enrollmentService,
		courseInstructorService: courseInstructorService,
		courseService:           courseService,
		semesterService:         semesterService,
		batchService:            batchService,
		iamClient:               iamClient,
		logger:                  logger,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract user_id from JWT locals
// ─────────────────────────────────────────────────────────────────────────────

func studentUserID(c fiber.Ctx) (uuid.UUID, error) {
	raw, _ := c.Locals("user_id").(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, utils.ErrUnauthorized("user not authenticated")
	}
	return id, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build an enriched StudentCourseEnrollmentResponse for one instance
// ─────────────────────────────────────────────────────────────────────────────

func (h *StudentHandler) buildEnrollmentResponse(instanceID uuid.UUID, status, finalGrade string) dto.StudentCourseEnrollmentResponse {
	resp := dto.StudentCourseEnrollmentResponse{
		CourseInstanceID: instanceID,
		Status:           status,
		FinalGrade:       finalGrade,
	}

	// Retrieve course instance (reuse CourseInstructorService which already owns GetCourseInstance)
	instance, err := h.courseInstructorService.GetCourseInstance(instanceID)
	if err != nil {
		h.logger.Warn("failed to fetch course instance", zap.Error(err), zap.String("instance_id", instanceID.String()))
		return resp
	}

	resp.BatchID = instance.BatchID
	resp.SemesterID = instance.SemesterID

	// Course details
	course, err := h.courseService.GetCourse(instance.CourseID)
	if err != nil {
		h.logger.Warn("failed to fetch course", zap.Error(err), zap.String("course_id", instance.CourseID.String()))
	} else {
		resp.CourseID = course.ID
		resp.CourseCode = course.Code
		resp.CourseTitle = course.Title
		resp.CourseDescription = course.Description
		resp.CourseCredits = course.Credits
	}

	// Semester details
	semester, err := h.semesterService.GetSemester(instance.SemesterID)
	if err != nil {
		h.logger.Warn("failed to fetch semester", zap.Error(err), zap.String("semester_id", instance.SemesterID.String()))
	} else {
		resp.SemesterName = semester.Name
		resp.SemesterTerm = semester.TermType
		resp.SemesterStartDate = semester.StartDate
		resp.SemesterEndDate = semester.EndDate
	}

	// Batch details
	batch, err := h.batchService.GetBatchByID(instance.BatchID)
	if err != nil {
		h.logger.Warn("failed to fetch batch", zap.Error(err), zap.String("batch_id", instance.BatchID.String()))
	} else if batch != nil {
		resp.BatchName = batch.Name
	}

	return resp
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/student-courses/me
// ─────────────────────────────────────────────────────────────────────────────

// GetMyCourses returns all course enrollments for the authenticated student,
// enriched with course, semester, and batch metadata.
func (h *StudentHandler) GetMyCourses(c fiber.Ctx) error {
	userID, err := studentUserID(c)
	if err != nil {
		return err
	}

	enrollments, err := h.enrollmentService.GetMyEnrollments(userID)
	if err != nil {
		return err
	}

	responses := make([]dto.StudentCourseEnrollmentResponse, len(enrollments))
	for i, e := range enrollments {
		resp := h.buildEnrollmentResponse(e.CourseInstanceID, e.Status, e.FinalGrade)
		resp.EnrolledAt = e.EnrolledAt
		responses[i] = resp
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"enrollments": responses,
		"count":       len(responses),
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/student-courses/:id
// ─────────────────────────────────────────────────────────────────────────────

// GetCourseInstance returns the enriched enrollment for a single course instance
// for the authenticated student, verifying that the student is enrolled.
func (h *StudentHandler) GetCourseInstance(c fiber.Ctx) error {
	userID, err := studentUserID(c)
	if err != nil {
		return err
	}

	rawID := c.Params("id")
	instanceID, err := uuid.Parse(rawID)
	if err != nil {
		return utils.ErrBadRequest("invalid course instance id")
	}

	// Fetch all enrollments for this instance and find the student's own record
	enrollments, err := h.enrollmentService.GetEnrollments(instanceID)
	if err != nil {
		return err
	}

	for _, e := range enrollments {
		if e.UserID == userID {
			resp := h.buildEnrollmentResponse(instanceID, e.Status, e.FinalGrade)
			resp.EnrolledAt = e.EnrolledAt
			return c.Status(fiber.StatusOK).JSON(resp)
		}
	}

	return utils.ErrNotFound("enrollment not found")
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/student-courses/:id/instructors
// ─────────────────────────────────────────────────────────────────────────────

// GetCourseInstructors returns the teaching team for a course instance that
// the authenticated student is enrolled in.
func (h *StudentHandler) GetCourseInstructors(c fiber.Ctx) error {
	userID, err := studentUserID(c)
	if err != nil {
		return err
	}

	rawID := c.Params("id")
	instanceID, err := uuid.Parse(rawID)
	if err != nil {
		return utils.ErrBadRequest("invalid course instance id")
	}

	// Verify the student is enrolled
	enrollments, err := h.enrollmentService.GetEnrollments(instanceID)
	if err != nil {
		return err
	}

	enrolled := false
	for _, e := range enrollments {
		if e.UserID == userID {
			enrolled = true
			break
		}
	}
	if !enrolled {
		return utils.ErrForbidden("you are not enrolled in this course instance")
	}

	// Fetch instructors
	instructors, err := h.courseInstructorService.GetInstructors(instanceID)
	if err != nil {
		return err
	}

	token := c.Get("Authorization")
	responses := make([]dto.CourseInstructorResponse, len(instructors))
	for i, inst := range instructors {
		courseInstance, err := h.courseInstructorService.GetCourseInstance(inst.CourseInstanceID)
		if err != nil {
			h.logger.Warn("failed to fetch course instance", zap.Error(err))
			responses[i] = dto.CourseInstructorResponse{CourseInstanceID: inst.CourseInstanceID, UserID: inst.UserID, Role: inst.Role}
			continue
		}

		course, err := h.courseService.GetCourse(courseInstance.CourseID)
		if err != nil {
			h.logger.Warn("failed to fetch course", zap.Error(err))
			responses[i] = dto.CourseInstructorResponse{CourseInstanceID: inst.CourseInstanceID, UserID: inst.UserID, Role: inst.Role}
			continue
		}

		userInfo, err := h.iamClient.GetUserInfo(context.Background(), token, inst.UserID.String())
		if err != nil {
			h.logger.Warn("failed to fetch user info", zap.Error(err), zap.String("user_id", inst.UserID.String()))
			responses[i] = dto.CourseInstructorResponse{CourseInstanceID: inst.CourseInstanceID, CourseCode: course.Code, CourseTitle: course.Title, UserID: inst.UserID, Role: inst.Role}
			continue
		}

		responses[i] = dto.CourseInstructorResponse{
			CourseInstanceID: inst.CourseInstanceID,
			CourseCode:       course.Code,
			CourseTitle:      course.Title,
			UserID:           inst.UserID,
			Designation:      userInfo.Designation,
			FullName:         userInfo.FullName,
			Email:            userInfo.Email,
			Role:             inst.Role,
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"instructors": responses,
		"count":       len(responses),
	})
}
