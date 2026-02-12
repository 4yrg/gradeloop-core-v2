package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/infrastructure/http/handlers"
	"github.com/gofiber/fiber/v3"
)

func Setup(
	app *fiber.App,
	facultyHandler *handlers.FacultyHandler,
	departmentHandler *handlers.DepartmentHandler,
	degreeHandler *handlers.DegreeHandler,
	specializationHandler *handlers.SpecializationHandler,
	batchHandler *handlers.BatchHandler,
	enrollmentHandler *handlers.EnrollmentHandler,
	academicStructureHandler *handlers.AcademicStructureHandler,
) {
	api := app.Group("/api")
	academics := api.Group("/academics")

	// Faculty routes
	faculties := academics.Group("/faculties")
	faculties.Post("/", facultyHandler.CreateFaculty)
	faculties.Get("/", facultyHandler.ListFaculties)
	faculties.Get("/:id", facultyHandler.GetFaculty)
	faculties.Patch("/:id", facultyHandler.UpdateFaculty)
	faculties.Delete("/:id", facultyHandler.DeactivateFaculty)
	faculties.Get("/:id/leaders", facultyHandler.GetFacultyLeaders)

	// Department routes (nested under faculties)
	faculties.Post("/:faculty_id/departments", departmentHandler.CreateDepartment)
	faculties.Get("/:faculty_id/departments", departmentHandler.ListDepartments)

	// Department routes (top-level)
	departments := academics.Group("/departments")
	departments.Get("/:id", departmentHandler.GetDepartment)
	departments.Patch("/:id", departmentHandler.UpdateDepartment)
	departments.Delete("/:id", departmentHandler.DeleteDepartment)

	// Degree routes (nested under departments)
	departments.Post("/:department_id/degrees", degreeHandler.CreateDegree)
	departments.Get("/:department_id/degrees", degreeHandler.ListDegrees)

	// Degree routes (top-level)
	degrees := academics.Group("/degrees")
	degrees.Get("/:id", degreeHandler.GetDegree)
	degrees.Patch("/:id", degreeHandler.UpdateDegree)
	degrees.Delete("/:id", degreeHandler.DeleteDegree)

	// Specialization routes (nested under degrees)
	degrees.Post("/:degree_id/specializations", specializationHandler.CreateSpecialization)
	degrees.Get("/:degree_id/specializations", specializationHandler.ListSpecializations)

	// Specialization routes (top-level)
	specializations := academics.Group("/specializations")
	specializations.Get("/:id", specializationHandler.GetSpecialization)
	specializations.Patch("/:id", specializationHandler.UpdateSpecialization)
	specializations.Delete("/:id", specializationHandler.DeleteSpecialization)

	// Batch routes
	batches := academics.Group("/batches")
	batches.Post("/", batchHandler.CreateBatch)
	batches.Get("/:id", batchHandler.GetBatch)
	batches.Get("/:id/children", batchHandler.GetDirectChildren)
	batches.Get("/tree/:root_id", batchHandler.GetSubtree)
	batches.Patch("/:id", batchHandler.UpdateBatch)
	batches.Delete("/:id", batchHandler.DeleteBatch)

	// Batch Membership (GRADLOOP-57)
	batches.Post("/:batch_id/members", enrollmentHandler.AddBatchMember)
	batches.Get("/:batch_id/members", enrollmentHandler.GetBatchMembers)
	batches.Patch("/:batch_id/members/:user_id", enrollmentHandler.UpdateBatchMember)

	// Course Instance (GRADLOOP-57)
	courseInstances := academics.Group("/course-instances")
	courseInstances.Post("/", enrollmentHandler.CreateCourseInstance)
	courseInstances.Get("/:id", enrollmentHandler.GetCourseInstance)
	courseInstances.Patch("/:id", enrollmentHandler.UpdateCourseInstance)

	// Course Instructor (GRADLOOP-57)
	courseInstances.Post("/:id/instructors", enrollmentHandler.AssignInstructor)
	courseInstances.Get("/:id/instructors", enrollmentHandler.GetCourseInstructors)
	courseInstances.Delete("/:id/instructors/:user_id", enrollmentHandler.RemoveInstructor)

	// Course Enrollment (GRADLOOP-57)
	courseInstances.Post("/:id/enrollments", enrollmentHandler.EnrollStudent)
	courseInstances.Get("/:id/enrollments", enrollmentHandler.GetEnrollments)
	courseInstances.Patch("/:id/enrollments/:user_id", enrollmentHandler.UpdateEnrollment)

	// Academic Structure (Support for CourseInstance)
	courses := academics.Group("/courses")
	courses.Post("/", academicStructureHandler.CreateCourse)
	courses.Get("/", academicStructureHandler.ListCourses)

	semesters := academics.Group("/semesters")
	semesters.Post("/", academicStructureHandler.CreateSemester)
	semesters.Get("/", academicStructureHandler.ListSemesters)
}
