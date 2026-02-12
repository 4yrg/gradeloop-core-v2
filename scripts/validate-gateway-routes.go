package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

type RouteConfig struct {
	Path       string `yaml:"path"`
	Method     string `yaml:"method"`
	Permission string `yaml:"permission"`
}

type Config struct {
	Routes []RouteConfig `yaml:"routes"`
}

func main() {
	// 1. Read Gateway Config
	gatewayConfigPath := "apps/services/api-gateway/config/routes.yaml"
	gatewayData, err := os.ReadFile(gatewayConfigPath)
	if err != nil {
		fmt.Printf("Error reading gateway config: %v\n", err)
		os.Exit(1)
	}

	var cfg Config
	if err := yaml.Unmarshal(gatewayData, &cfg); err != nil {
		fmt.Printf("Error unmarshaling gateway config: %v\n", err)
		os.Exit(1)
	}

	gatewayRoutes := make(map[string]bool)
	for _, r := range cfg.Routes {
		key := fmt.Sprintf("%s %s", r.Method, r.Path)
		gatewayRoutes[key] = true
	}

	// 2. Parse Academics Router
	routerPath := "apps/services/academics-service/internal/infrastructure/http/router/router.go"
	routerData, err := os.ReadFile(routerPath)
	if err != nil {
		fmt.Printf("Error reading academics router: %v\n", err)
		os.Exit(1)
	}

	// Simple regex to extract routes: group.Method("path", ...)
	// This is a naive implementation for the task's scope.
	// In production, we'd use a more robust parser or introspect the running app.
	re := regexp.MustCompile(`([a-zA-Z]+)\.(Post|Get|Patch|Delete)\("([^"]+)"`)
	matches := re.FindAllStringSubmatch(string(routerData), -1)

	groups := map[string]string{
		"faculties":       "/api/academics/faculties",
		"departments":     "/api/academics/departments",
		"degrees":         "/api/academics/degrees",
		"specializations": "/api/academics/specializations",
		"batches":         "/api/academics/batches",
		"courseInstances": "/api/academics/course-instances",
		"courses":         "/api/academics/courses",
		"semesters":       "/api/academics/semesters",
	}

	missingRoutes := []string{}
	for _, m := range matches {
		groupName := m[Part1]
		method := strings.ToUpper(m[Part2])
		subPath := m[Part3]

		basePath, ok := groups[groupName]
		if !ok {
			continue // Skip if not a recognized group
		}

		// Handle sub-paths correctly
		fullPath := basePath
		if subPath != "/" {
			fullPath = basePath + subPath
		}

		// Fix sub-paths for nested groups (e.g. faculties.Post("/:faculty_id/departments"))
		if groupName == "faculties" && strings.Contains(subPath, "departments") {
			fullPath = "/api/academics/faculties" + subPath
		}
		if groupName == "departments" && strings.Contains(subPath, "degrees") {
			fullPath = "/api/academics/departments" + subPath
		}
		if groupName == "degrees" && strings.Contains(subPath, "specializations") {
			fullPath = "/api/academics/degrees" + subPath
		}

		key := fmt.Sprintf("%s %s", method, fullPath)
		if !gatewayRoutes[key] {
			missingRoutes = append(missingRoutes, key)
		}
	}

	if len(missingRoutes) > 0 {
		fmt.Println("❌ CI Failure: The following routes are missing from the API Gateway configuration:")
		for _, r := range missingRoutes {
			fmt.Printf("  - %s\n", r)
		}
		os.Exit(1)
	}

	fmt.Println("✅ All Academics Service routes are correctly registered in the API Gateway.")
}

const (
	Part1 = 1
	Part2 = 2
	Part3 = 3
)
