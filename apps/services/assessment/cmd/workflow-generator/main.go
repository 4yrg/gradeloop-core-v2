package main

import (
	"bytes"
	"fmt"
	"text/template"
)

type GradingWorkflowConfig struct {
	AssignmentID    string
	AssignmentTitle string
	Language        string
	TestCases       []TestCaseConfig
	TotalPoints     int
	GradingURL      string
}

type TestCaseConfig struct {
	Input          string
	ExpectedOutput string
	IsHidden       bool
	Points         int
}

func GenerateGradingWorkflow(config GradingWorkflowConfig) string {
	const workflowTemplate = `name: GradeLoop Auto-Grading

on:
  push:
    branches: [main, master]
  workflow_dispatch:
    inputs:
      submission_sha:
        description: 'Commit SHA to grade'
        required: true
        type: string

jobs:
  grade:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.submission_sha || github.sha }}
          fetch-depth: 0

      - name: Setup {{.Language}}
        uses: actions/setup-language@v1
        with:
          language: {{.Language}}

      - name: Run tests
        id: test-run
        run: |
          echo "Running auto-grading tests..."
          {{range .TestCases}}
          {{if .IsHidden}}
          # Hidden test case {{.Points}} points
          {{else}}
          # Test case {{.Points}} points
          {{end}}
          echo "Testing: {{.Input}}"
          RESULT=$(python3 main.py <<< "{{.Input}}")
          EXPECTED="{{.ExpectedOutput}}"
          if [ "$RESULT" = "$EXPECTED" ]; then
            echo "✓ Test passed"
          else
            echo "✗ Test failed: expected '$EXPECTED', got '$RESULT'"
            exit 1
          fi
          {{end}}

      - name: Submit grade to GradeLoop
        if: success()
        run: |
          curl -X POST "{{.GradingURL}}" \
            -H "Content-Type: application/json" \
            -d '{
              "assignment_id": "{{.AssignmentID}}",
              "commit_sha": "${{ github.event.inputs.submission_sha || github.sha }}",
              "status": "accepted",
              "score": {{.TotalPoints}},
              "feedback": "All tests passed"
            }'

      - name: Submit failure to GradeLoop
        if: failure()
        run: |
          curl -X POST "{{.GradingURL}}" \
            -H "Content-Type: application/json" \
            -d '{
              "assignment_id": "{{.AssignmentID}}",
              "commit_sha": "${{ github.event.inputs.submission_sha || github.sha }}",
              "status": "rejected",
              "score": 0,
              "feedback": "Test execution failed"
            }'
`

	tmpl, err := template.New("workflow").Parse(workflowTemplate)
	if err != nil {
		return fmt.Sprintf("# Error parsing template: %v", err)
	}

	var buf bytes.Buffer
	err = tmpl.Execute(&buf, config)
	if err != nil {
		return fmt.Sprintf("# Error executing template: %v", err)
	}

	return buf.String()
}

func main() {
	config := GradingWorkflowConfig{
		AssignmentID:    "lab01",
		AssignmentTitle: "Lab 01 - Python Basics",
		Language:        "python",
		TestCases: []TestCaseConfig{
			{Input: "2\n3\n", ExpectedOutput: "5", IsHidden: false, Points: 10},
			{Input: "5\n10\n", ExpectedOutput: "15", IsHidden: false, Points: 10},
			{Input: "100\n200\n", ExpectedOutput: "300", IsHidden: true, Points: 20},
		},
		TotalPoints: 40,
		GradingURL:  "https://api.gradeloop.example.com/github/grading-callback",
	}

	workflow := GenerateGradingWorkflow(config)
	fmt.Println(workflow)
}