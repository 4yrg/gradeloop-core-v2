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
	Service    string `yaml:"service"`
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
		key := fmt.Sprintf("%s %s %s", r.Service, r.Method, r.Path)
		gatewayRoutes[key] = true
	}

	validateAcademics(gatewayRoutes)
	validateIAM(gatewayRoutes)
	validateEmail(gatewayRoutes)

	fmt.Println("✅ All Service routes are correctly registered in the API Gateway.")
}

func validateAcademics(gatewayRoutes map[string]bool) {
	fmt.Println("Checking Academics Service...")
	routerPath := "apps/services/academics-service/internal/infrastructure/http/router/router.go"
	data, _ := os.ReadFile(routerPath)

	re := regexp.MustCompile(`([a-zA-Z]+)\.(Post|Get|Patch|Delete|Put)\("([^"]+)"`)
	matches := re.FindAllStringSubmatch(string(data), -1)

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

	checkRoutes("academics", matches, groups, gatewayRoutes)
}

func validateIAM(gatewayRoutes map[string]bool) {
	fmt.Println("Checking IAM Service...")
	routerPath := "apps/services/iam-service/internal/infrastructure/http/router/router.go"
	data, _ := os.ReadFile(routerPath)

	re := regexp.MustCompile(`([a-zA-Z]+)\.(Post|Get|Patch|Delete|Put)\("([^"]+)"`)
	matches := re.FindAllStringSubmatch(string(data), -1)

	groups := map[string]string{
		"auth":        "/api/v1/auth",
		"users":       "/api/v1/users",
		"roles":       "/api/v1/roles",
		"permissions": "/api/v1/permissions",
		"app":         "/api/iam",
	}

	checkRoutes("iam", matches, groups, gatewayRoutes)
}

func validateEmail(gatewayRoutes map[string]bool) {
	fmt.Println("Checking Email Notify Service...")
	routerPath := "apps/services/email-notify-service/internal/server/server.go"
	data, _ := os.ReadFile(routerPath)

	// Gin Regex: router.GET("path" or group.POST("path"
	re := regexp.MustCompile(`([a-zA-Z]+)\.(POST|GET|PATCH|DELETE|PUT)\("([^"]+)"`)
	matches := re.FindAllStringSubmatch(string(data), -1)

	groups := map[string]string{
		"email":  "/api/v1/email",
		"router": "",
	}

	checkRoutes("email-notify", matches, groups, gatewayRoutes)
}

func checkRoutes(serviceName string, matches [][]string, groups map[string]string, gatewayRoutes map[string]bool) {
	missingRoutes := []string{}

	for _, m := range matches {
		groupName := m[Part1]
		method := strings.ToUpper(m[Part2])
		subPath := m[Part3]

		basePath, ok := groups[groupName]
		if !ok {
			continue
		}

		fullPath := basePath
		if subPath != "/" {
			if basePath == "" {
				fullPath = subPath
			} else {
				fullPath = basePath + subPath
			}
		} else if basePath == "" {
			fullPath = "/"
		} else {
			// basePath is set, subPath is /
			fullPath = basePath
		}

		// Fix sub-paths logic for nested routes (simplified for Academics)
		if serviceName == "academics" {
			if groupName == "faculties" && strings.Contains(subPath, "departments") {
				fullPath = "/api/academics/faculties/:faculty_id/departments"
				if subPath != "/:faculty_id/departments" { // for List/Create
					// It might be specific? Regex match logic is simple here.
					// The subPath in code is likely `/:faculty_id/departments`.
					// Let's rely on the regex capture.
					fullPath = "/api/academics/faculties" + subPath
				}
			}
			if groupName == "departments" && strings.Contains(subPath, "degrees") {
				fullPath = "/api/academics/departments" + subPath
			}
			if groupName == "degrees" && strings.Contains(subPath, "specializations") {
				fullPath = "/api/academics/degrees" + subPath
			}
		}

		// Special case handling for IAM
		if serviceName == "iam" {
			if groupName == "app" {
				fullPath = subPath
			}
			if fullPath == "/api/v1/auth/validate" {
				continue
			} // Internal
			if fullPath == "/api/iam/health" {
				continue
			} // Public/Internal health often ignored or handled differently
		}

		// Special case handling for Email
		if serviceName == "email-notify" {
			if fullPath == "/health" {
				continue
			}
			if fullPath == "/" {
				continue
			}
		}

		// Normalize paths for comparison (optional, but good for :id vs {id} etc if needed)
		// Here we assume exact match with config.

		key := fmt.Sprintf("%s %s %s", serviceName, method, fullPath)
		if !gatewayRoutes[key] {
			missingRoutes = append(missingRoutes, key)
		}
	}

	if len(missingRoutes) > 0 {
		fmt.Printf("❌ %s Failure: Missing routes:\n", serviceName)
		for _, r := range missingRoutes {
			fmt.Printf("  - %s\n", r)
		}
		os.Exit(1)
	}
}

const (
	Part1 = 1
	Part2 = 2
	Part3 = 3
)
