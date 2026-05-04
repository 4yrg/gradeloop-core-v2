package service

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/dto"
)

type GitHubService struct {
	config config.GitHubConfig
}

func NewGitHubService(cfg config.GitHubConfig) *GitHubService {
	return &GitHubService{config: cfg}
}

type GitHubTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

func (s *GitHubService) GetAuthURL() string {
	state := uuid.New().String()
	return fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=read:user:email&state=%s",
		s.config.ClientID,
		s.config.RedirectURL,
		state,
	)
}

func (s *GitHubService) ExchangeCodeForToken(ctx context.Context, code string) (*GitHubTokenResponse, error) {
	data := map[string]string{
		"client_id":     s.config.ClientID,
		"client_secret": s.config.ClientSecret,
		"code":          code,
	}

	body, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var tokenResp GitHubTokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return &tokenResp, nil
}

func (s *GitHubService) GetGitHubUser(ctx context.Context, accessToken string) (*dto.GitHubUserResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Accept", "application/vnd.github+json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var user dto.GitHubUserResponse
	if err := json.Unmarshal(respBody, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user response: %w", err)
	}

	return &user, nil
}

func (s *GitHubService) GetUserEmail(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Accept", "application/vnd.github+json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get emails: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}

	if err := json.Unmarshal(respBody, &emails); err != nil {
		return "", fmt.Errorf("failed to parse emails: %w", err)
	}

	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}

	return "", fmt.Errorf("no verified primary email found")
}

func (s *GitHubService) EncryptToken(token string) (string, error) {
	key := []byte(s.config.EncryptionKey)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	ciphertext := make([]byte, aes.BlockSize+len(token))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], []byte(token))

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (s *GitHubService) DecryptToken(encryptedToken string) (string, error) {
	key := []byte(s.config.EncryptionKey)
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedToken)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < aes.BlockSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(ciphertext, ciphertext)

	return string(ciphertext), nil
}

func (s *GitHubService) LinkGitHubToUser(user *domain.User, githubToken string) error {
	user.GitHubUsername = user.GitHubUsername
	user.GitHubID = &user.GitHubUsername

	encryptedToken, err := s.EncryptToken(githubToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt token: %w", err)
	}

	user.GitHubTokenEncrypted = encryptedToken
	return nil
}

func (s *GitHubService) GetUserGitHubToken(user *domain.User) (string, error) {
	if user.GitHubTokenEncrypted == "" {
		return "", fmt.Errorf("no GitHub token found")
	}
	return s.DecryptToken(user.GitHubTokenEncrypted)
}

func (s *GitHubService) GetAppToken() string {
	return os.Getenv("APP_GITHUB_TOKEN")
}

func (s *GitHubService) CreateRepo(ctx context.Context, orgName, repoName, description string) (string, error) {
	url := fmt.Sprintf("https://api.github.com/orgs/%s/repos", orgName)

	data := map[string]interface{}{
		"name":        repoName,
		"description": description,
		"private":     true,
		"auto_init":   true,
	}

	body, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

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

func (s *GitHubService) GetRepoContents(ctx context.Context, orgName, repoName, path string) ([]GitHubContent, error) {
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

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

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

func (s *GitHubService) GetFileContent(ctx context.Context, orgName, repoName, filePath string) (string, string, error) {
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

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

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

func (s *GitHubService) CreateOrUpdateFile(ctx context.Context, orgName, repoName, filePath, content, message, sha string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", orgName, repoName, filePath)

	data := map[string]interface{}{
		"message": message,
		"content": base64.StdEncoding.EncodeToString([]byte(content)),
	}

	if sha != "" {
		data["sha"] = sha
	}

	body, err := json.Marshal(data)
	if err != nil {
		return err
	}

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
		return fmt.Errorf("failed to update file: %s", string(respBody))
	}

	return nil
}

type GitCommit struct {
	SHA      string    `json:"sha"`
	Message  string    `json:"message"`
	Date     time.Time `json:"date"`
	Author   struct {
		Login string `json:"login"`
		Name  string `json:"name"`
	} `json:"author"`
}

func (s *GitHubService) GetCommits(ctx context.Context, orgName, repoName string) ([]GitCommit, error) {
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

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var commits []GitCommit
	if err := json.Unmarshal(respBody, &commits); err != nil {
		return nil, err
	}

	return commits, nil
}

func (s *GitHubService) CreateTag(ctx context.Context, orgName, repoName, tagName, message, sha string) error {
	refUrl := fmt.Sprintf("https://api.github.com/repos/%s/%s/git/refs", orgName, repoName)

	refData := map[string]interface{}{
		"ref": fmt.Sprintf("refs/tags/%s", tagName),
		"sha": sha,
	}

	refBody, _ := json.Marshal(refData)
	refReq, _ := http.NewRequestWithContext(ctx, "POST", refUrl, bytes.NewReader(refBody))
	refReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.GetAppToken()))
	refReq.Header.Set("Accept", "application/vnd.github+json")
	refReq.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	refResp, _ := httpClient.Do(refReq)
	if refResp != nil {
		defer refResp.Body.Close()
	}

	return nil
}

func (s *GitHubService) GetTags(ctx context.Context, orgName, repoName string) ([]struct {
	Name string `json:"name"`
	SHA  string `json:"commit"`
}, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/tags", orgName, repoName)

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

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var tags []struct {
		Name string `json:"name"`
		SHA  string `json:"commit"`
	}

	if err := json.Unmarshal(respBody, &tags); err != nil {
		return nil, err
	}

	return tags, nil
}

func (s *GitHubService) TriggerWorkflow(ctx context.Context, orgName, repoName, workflowFileName string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/actions/workflows/%s/dispatch", orgName, repoName, workflowFileName)

	data := map[string]interface{}{
		"ref": "main",
	}

	body, err := json.Marshal(data)
	if err != nil {
		return err
	}

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