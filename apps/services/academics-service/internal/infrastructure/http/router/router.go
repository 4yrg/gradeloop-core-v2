package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/infrastructure/http/handlers"
	"github.com/gofiber/fiber/v3"
)

func Setup(app *fiber.App, facultyHandler *handlers.FacultyHandler) {
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
}
