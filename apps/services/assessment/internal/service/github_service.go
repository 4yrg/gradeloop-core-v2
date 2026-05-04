package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type GitHubService interface {
	CreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.GitHubRepo, error)
	GetOrCreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.GitHubRepo, error)
	GetRepoFiles(ctx context.Context, orgName, repoName, path string) ([]repository.GitHubContent, error)
	GetFileContent(ctx context.Context, orgName, repoName, filePath string) (content string, sha string, err error)
	CommitFile(ctx context.Context, orgName, repoName, filePath, content, message, sha string) error
	SubmitAssignment(ctx context.Context, repo *domain.GitHubRepo, userID, assignmentID uuid.UUID, message string) (*domain.GitHubSubmissionVersion, error)
	GetSubmissionVersions(ctx context.Context, userID, assignmentID uuid.UUID) ([]domain.GitHubSubmissionVersion, error)
	GetCommitHistory(ctx context.Context, orgName, repoName string) ([]GitCommitInfo, error)
	TriggerGrading(ctx context.Context, orgName, repoName, workflowFileName string) error
	CloneAndGrade(ctx context.Context, orgName, repoName string) (string, error)
}

type gitHubService struct {
	githubRepo repository.GitHubRepository
	db         *gorm.DB
	logger     *zap.Logger
}

func NewGitHubService(githubRepo repository.GitHubRepository, db *gorm.DB, logger *zap.Logger) GitHubService {
	return &gitHubService{
		githubRepo: githubRepo,
		db:         db,
		logger:     logger,
	}
}

func (s *gitHubService) GetAppToken() string {
	return os.Getenv("APP_GITHUB_TOKEN")
}

func (s *gitHubService) CreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.GitHubRepo, error) {
	orgName := assignment.GitHubOrg
	if orgName == "" {
		orgName = os.Getenv("APP_GITHUB_ORG_NAME")
	}

	repoName := fmt.Sprintf("%s-%s", assignment.Code, userID.String()[:8])

	exists, _ := s.githubRepo.GetRepoByAssignmentAndUser(assignmentID, userID)
	if exists != nil {
		return exists, nil
	}

	repoURL, err := s.createRepo(ctx, orgName, repoName, fmt.Sprintf("Assignment: %s", assignment.Title))
	if err != nil {
		s.logger.Error("failed to create GitHub repo", zap.Error(err))
		return nil, fmt.Errorf("failed to create repo: %w", err)
	}

	repo := &domain.GitHubRepo{
		AssignmentID: assignmentID,
		UserID:       userID,
		OrgName:      orgName,
		RepoName:     repoName,
		RepoURL:      repoURL,
		CloneURL:     fmt.Sprintf("git@github.com:%s/%s.git", orgName, repoName),
		HTMLURL:      repoURL,
		LanguageID:   assignment.LanguageID,
		Language:     "python",
		IsActive:     true,
		UsedAt:       time.Now(),
	}

	if err := s.githubRepo.CreateRepo(repo); err != nil {
		return nil, fmt.Errorf("failed to save repo: %w", err)
	}

	return repo, nil
}

func (s *gitHubService) GetOrCreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.GitHubRepo, error) {
	repo, err := s.githubRepo.GetRepoByAssignmentAndUser(assignmentID, userID)
	if err != nil {
		return nil, err
	}
	if repo != nil {
		repo.UsedAt = time.Now()
		_ = s.githubRepo.UpdateRepo(repo)
		return repo, nil
	}

	return s.CreateStudentRepo(ctx, assignmentID, userID, assignment)
}

func (s *gitHubService) createRepo(ctx context.Context, orgName, repoName, description string) (string, error) {
	url := fmt.Sprintf("https://api.github.com/orgs/%s/repos", orgName)

	data := map[string]interface{}{
		"name":        repoName,
		"description": description,
		"private":     true,
		"auto_init":   true,
	}

	body, _ := json.Marshal(data)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 201 {
		if bytes.Contains(respBody, []byte("name already exists")) {
			return fmt.Sprintf("https://github.com/%s/%s", orgName, repoName), nil
		}
		return "", fmt.Errorf("failed to create repo: %s", string(respBody))
	}

	return fmt.Sprintf("https://github.com/%s/%s", orgName, repoName), nil
}

type GitHubContent struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	SHA         string `json:"sha"`
	Size        int    `json:"size"`
	Type        string `json:"type"`
	Content     string `json:"content,omitempty"`
	DownloadURL string `json:"download_url,omitempty"`
}

func (s *gitHubService) GetRepoFiles(ctx context.Context, orgName, repoName, path string) ([]GitHubContent, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", orgName, repoName, path)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	req.Header.Set("Accept", "application/vnd.github+json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 404 {
		return []GitHubContent{}, nil
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to get contents: %s", string(respBody))
	}

	var contents []GitHubContent
	if err := json.Unmarshal(respBody, &contents); err != nil {
		var singleFile GitHubContent
		if err := json.Unmarshal(respBody, &singleFile); err != nil {
			return nil, err
		}
		contents = []GitHubContent{singleFile}
	}

	return contents, nil
}

func (s *gitHubService) GetFileContent(ctx context.Context, orgName, repoName, filePath string) (string, string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", orgName, repoName, filePath)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", "", err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	req.Header.Set("Accept", "application/vnd.github+json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", "", fmt.Errorf("failed to get file: %s", string(respBody))
	}

	var file struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		SHA      string `json:"sha"`
	}

	if err := json.Unmarshal(respBody, &file); err != nil {
		return "", "", err
	}

	decoded, err := base64.StdEncoding.DecodeString(file.Content)
	if err != nil {
		return "", "", err
	}

	return string(decoded), file.SHA, nil
}

func (s *gitHubService) CommitFile(ctx context.Context, orgName, repoName, filePath, content, message, sha string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", orgName, repoName, filePath)

	data := map[string]interface{}{
		"message": message,
		"content": base64.StdEncoding.EncodeToString([]byte(content)),
	}

	if sha != "" {
		data["sha"] = sha
	}

	body, _ := json.Marshal(data)

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return fmt.Errorf("failed to commit file: %s", string(respBody))
	}

	return nil
}

type GitCommitInfo struct {
	SHA      string    `json:"sha"`
	Message  string    `json:"message"`
	Date     time.Time `json:"date"`
	Author   struct {
		Login string `json:"login"`
		Name  string `json:"name"`
	} `json:"author"`
}

func (s *gitHubService) GetCommitHistory(ctx context.Context, orgName, repoName string) ([]GitCommitInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/commits?per_page=50", orgName, repoName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	req.Header.Set("Accept", "application/vnd.github+json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var commits []GitCommitInfo
	if err := json.Unmarshal(respBody, &commits); err != nil {
		return nil, err
	}

	return commits, nil
}

func (s *gitHubService) SubmitAssignment(ctx context.Context, repo *domain.GitHubRepo, userID, assignmentID uuid.UUID, message string) (*domain.GitHubSubmissionVersion, error) {
	latestVersion, err := s.githubRepo.GetLatestVersion(userID, assignmentID)
	if err != nil {
		return nil, err
	}

	nextVersion := 1
	if latestVersion != nil {
		nextVersion = latestVersion.Version + 1
	}

	commits, err := s.GetCommitHistory(ctx, repo.OrgName, repo.RepoName)
	if err != nil || len(commits) == 0 {
		return nil, fmt.Errorf("failed to get commit history")
	}

	latestCommit := commits[0]

	tagName := fmt.Sprintf("submission-v%d", nextVersion)

	version := &domain.GitHubSubmissionVersion{
		GitHubRepoID:   repo.ID,
		AssignmentID:  assignmentID,
		UserID:         userID,
		Version:        nextVersion,
		CommitSHA:      latestCommit.SHA,
		CommitMessage: latestCommit.Message,
		TagName:        tagName,
		GradingStatus:  "pending",
		SubmittedAt:    time.Now(),
	}

	if err := s.githubRepo.CreateVersion(version); err != nil {
		return nil, fmt.Errorf("failed to create version: %w", err)
	}

	_ = s.createTag(ctx, repo.OrgName, repo.RepoName, tagName, fmt.Sprintf("Submission version %d", nextVersion))

	return version, nil
}

func (s *gitHubService) createTag(ctx context.Context, orgName, repoName, tagName, message string) error {
	tagUrl := fmt.Sprintf("https://api.github.com/repos/%s/%s/git/tags", orgName, repoName)

	tagData := map[string]interface{}{
		"tag":     tagName,
		"message": message,
		"object": map[string]string{
			"sha": "HEAD",
			"type": "commit",
		},
	}

	tagBody, _ := json.Marshal(tagData)
	tagReq, _ := http.NewRequestWithContext(ctx, "POST", tagUrl, bytes.NewReader(tagBody))
	tagReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	tagReq.Header.Set("Accept", "application/vnd.github+json")

	httpClient := &http.Client{}
	tagResp, _ := httpClient.Do(tagReq)
	if tagResp != nil {
		defer tagResp.Body.Close()
	}

	return nil
}

func (s *gitHubService) GetSubmissionVersions(ctx context.Context, userID, assignmentID uuid.UUID) ([]domain.GitHubSubmissionVersion, error) {
	return s.githubRepo.GetVersionsByUserAndAssignment(userID, assignmentID)
}

func (s *gitHubService) TriggerGrading(ctx context.Context, orgName, repoName, workflowFileName string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/actions/workflows/%s/dispatch", orgName, repoName, workflowFileName)

	data := map[string]interface{}{
		"ref": "main",
	}

	body, _ := json.Marshal(data)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 204 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to trigger workflow: %s", string(respBody))
	}

	return nil
}

func (s *gitHubService) CloneAndGrade(ctx context.Context, orgName, repoName string) (string, error) {
	return fmt.Sprintf("https://github.com/%s/%s", orgName, repoName), nil
}

func (s *gitHubService) GetSubmissionVersionsByCommit(ctx context.Context, assignmentID uuid.UUID, commitSHA string) ([]domain.GitHubSubmissionVersion, error) {
	return s.githubRepo.GetVersionsByCommit(assignmentID, commitSHA)
}

func (s *gitHubService) UpdateVersion(version *domain.GitHubSubmissionVersion) error {
	return s.githubRepo.UpdateVersion(version)
}