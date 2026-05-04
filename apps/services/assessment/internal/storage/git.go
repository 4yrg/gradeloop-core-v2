package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"
)

type SeaweedGitStorage struct {
	client     *minio.Client
	bucketName string
	logger     *zap.Logger
}

func NewSeaweedGitStorage(
	endpoint, accessKey, secretKey, bucketName string,
	useSSL bool,
	logger *zap.Logger,
) (*SeaweedGitStorage, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("creating seaweed client: %w", err)
	}

	s := &SeaweedGitStorage{
		client:     client,
		bucketName: bucketName,
		logger:     logger,
	}

	ctx := context.Background()
	if err := s.ensureBucket(ctx); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *SeaweedGitStorage) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucketName)
	if err != nil {
		return fmt.Errorf("checking bucket existence: %w", err)
	}

	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucketName, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("creating bucket: %w", err)
		}
		s.logger.Info("seaweed bucket created", zap.String("bucket", s.bucketName))
	}
	return nil
}

func (s *SeaweedGitStorage) repoPath(assignmentID, userID string) string {
	return fmt.Sprintf("code/%s/%s", assignmentID, userID)
}

func (s *SeaweedGitStorage) gitPath(assignmentID, userID, subPath string) string {
	return fmt.Sprintf("code/%s/%s/.git/%s", assignmentID, userID, subPath)
}

func (s *SeaweedGitStorage) filesPath(assignmentID, userID string) string {
	return fmt.Sprintf("code/%s/%s/files", assignmentID, userID)
}

func (s *SeaweedGitStorage) RepoExists(ctx context.Context, assignmentID, userID string) (bool, error) {
	prefix := s.gitPath(assignmentID, userID, "")

	objCh := s.client.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		MaxKeys:   1,
		Recursive: false,
	})

	_, ok := <-objCh
	if !ok {
		return false, nil
	}
	return true, nil
}

func (s *SeaweedGitStorage) InitRepo(ctx context.Context, assignmentID, userID string) error {
	repoPath := s.repoPath(assignmentID, userID)

	emptyContent := []byte("")
	reader := bytes.NewReader(emptyContent)

	_, err := s.client.PutObject(ctx, s.bucketName, repoPath+"/.git/HEAD", reader, 0, minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("creating repo: %w", err)
	}

	s.logger.Info("git repo initialized",
		zap.String("assignment", assignmentID),
		zap.String("user", userID),
	)

	return nil
}

func (s *SeaweedGitStorage) ListFiles(ctx context.Context, assignmentID, userID, path string) ([]FileInfo, error) {
	prefix := s.filesPath(assignmentID, userID)
	if path != "" {
		prefix = prefix + "/" + path
	}

	var files []FileInfo

	objCh := s.client.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false,
	})

	for obj := range objCh {
		if obj.Err != nil {
			return nil, fmt.Errorf("listing objects: %w", obj.Err)
		}

		name := obj.Key
		if len(name) > len(prefix) {
			name = name[len(prefix)+1:]
		}

		if name == "" {
			continue
		}

		files = append(files, FileInfo{
			Name:     name,
			Path:     name,
			Size:     obj.Size,
			IsFolder: strings.HasSuffix(obj.Key, "/"),
		})
	}

	return files, nil
}

func (s *SeaweedGitStorage) GetFile(ctx context.Context, assignmentID, userID, filePath string) (string, error) {
	objectName := s.filesPath(assignmentID, userID) + "/" + filePath

	obj, err := s.client.GetObject(ctx, s.bucketName, objectName, minio.GetObjectOptions{})
	if err != nil {
		return "", fmt.Errorf("getting file: %w", err)
	}
	defer obj.Close()

	content, err := io.ReadAll(obj)
	if err != nil {
		return "", fmt.Errorf("reading file content: %w", err)
	}

	return string(content), nil
}

func (s *SeaweedGitStorage) SaveFile(ctx context.Context, assignmentID, userID, filePath, content string) (string, error) {
	objectName := s.filesPath(assignmentID, userID) + "/" + filePath

	reader := bytes.NewReader([]byte(content))

	info, err := s.client.PutObject(ctx, s.bucketName, objectName, reader, int64(len(content)), minio.PutObjectOptions{
		ContentType: "text/plain; charset=utf-8",
	})
	if err != nil {
		return "", fmt.Errorf("saving file: %w", err)
	}

	s.logger.Info("file saved",
		zap.String("path", objectName),
		zap.Int64("size", info.Size),
	)

	return info.Key, nil
}

func (s *SeaweedGitStorage) DeleteFile(ctx context.Context, assignmentID, userID, filePath string) error {
	objectName := s.filesPath(assignmentID, userID) + "/" + filePath

	err := s.client.RemoveObject(ctx, s.bucketName, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("deleting file: %w", err)
	}

	return nil
}

type CommitInfo struct {
	SHA     string
	Message string
	Author  string
	Date    time.Time
	Files   []string
}

func (s *SeaweedGitStorage) GetCommits(ctx context.Context, assignmentID, userID string) ([]CommitInfo, error) {
	prefix := s.gitPath(assignmentID, userID, "commits/")

	var commits []CommitInfo

	objCh := s.client.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false,
	})

	for obj := range objCh {
		if obj.Err != nil {
			break
		}

		name := obj.Key
		if len(name) > len(prefix) {
			commitHash := name[len(prefix):]
			commits = append(commits, CommitInfo{
				SHA: commitHash,
			})
		}
	}

	return commits, nil
}

func (s *SeaweedGitStorage) SaveCommit(ctx context.Context, assignmentID, userID, sha, message, author string, files []string) error {
	commitPath := s.gitPath(assignmentID, userID, "commits/") + sha

	content := fmt.Sprintf("message: %s\nauthor: %s\ndate: %s\nfiles: %s", message, author, time.Now().Format(time.RFC3339), joinStrings(files))
	reader := bytes.NewReader([]byte(content))

	_, err := s.client.PutObject(ctx, s.bucketName, commitPath, reader, int64(len(content)), minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("saving commit: %w", err)
	}

	s.logger.Info("commit saved",
		zap.String("sha", sha),
		zap.String("assignment", assignmentID),
	)

	return nil
}

func (s *SeaweedGitStorage) GetCommit(ctx context.Context, assignmentID, userID, sha string) (*CommitInfo, error) {
	commitPath := s.gitPath(assignmentID, userID, "commits/") + sha

	obj, err := s.client.GetObject(ctx, s.bucketName, commitPath, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("getting commit: %w", err)
	}
	defer obj.Close()

	content, err := io.ReadAll(obj)
	if err != nil {
		return nil, fmt.Errorf("reading commit: %w", err)
	}

	commit := &CommitInfo{
		SHA: sha,
	}
	parseCommitData(string(content), commit)

	return commit, nil
}

func (s *SeaweedGitStorage) GetLatestCommitSHA(ctx context.Context, assignmentID, userID string) (string, error) {
	headPath := s.gitPath(assignmentID, userID, "HEAD")

	obj, err := s.client.GetObject(ctx, s.bucketName, headPath, minio.GetObjectOptions{})
	if err != nil {
		return "", nil
	}
	defer obj.Close()

	content, err := io.ReadAll(obj)
	if err != nil {
		return "", nil
	}

	return string(bytes.TrimSpace(content)), nil
}

func (s *SeaweedGitStorage) UpdateHead(ctx context.Context, assignmentID, userID, sha string) error {
	headPath := s.gitPath(assignmentID, userID, "HEAD")

	reader := bytes.NewReader([]byte(sha))
	_, err := s.client.PutObject(ctx, s.bucketName, headPath, reader, int64(len(sha)), minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("updating HEAD: %w", err)
	}

	return nil
}

func (s *SeaweedGitStorage) SaveVersion(ctx context.Context, assignmentID, userID, version, message string, files []string) error {
	sha := generateSHA(message, assignmentID, userID, version)

	err := s.SaveCommit(ctx, assignmentID, userID, sha, message, "system", files)
	if err != nil {
		return err
	}

	err = s.UpdateHead(ctx, assignmentID, userID, sha)
	if err != nil {
		return err
	}

	return nil
}

func (s *SeaweedGitStorage) GetVersions(ctx context.Context, assignmentID, userID string) ([]VersionInfo, error) {
	commits, err := s.GetCommits(ctx, assignmentID, userID)
	if err != nil {
		return nil, err
	}

	var versions []VersionInfo
	for _, c := range commits {
		versions = append(versions, VersionInfo{
			ID:          c.SHA,
			Version:     len(versions) + 1,
			CommitSHA:   c.SHA,
			Message:     c.Message,
			SubmittedAt: c.Date,
		})
	}

	return versions, nil
}

type FileInfo struct {
	Name     string
	Path     string
	Size     int64
	IsFolder bool
}

type VersionInfo struct {
	ID          string
	Version     int
	CommitSHA   string
	Message     string
	SubmittedAt time.Time
}

func generateSHA(message, assignmentID, userID, version string) string {
	return fmt.Sprintf("%s-%s-%s-%d", assignmentID[:8], userID[:8], message[:8], len(message))
}

func joinStrings(files []string) string {
	result := ""
	for i, f := range files {
		if i > 0 {
			result += ","
		}
		result += f
	}
	return result
}

func parseCommitData(content string, commit *CommitInfo) {
	var message, author, date, files string
	fmt.Sscanf(content, "message: %s\nauthor: %s\ndate: %s\nfiles: %s", &message, &author, &date, &files)
	commit.Message = message
	commit.Author = author

	if t, err := time.Parse(time.RFC3339, date); err == nil {
		commit.Date = t
	}

	if files != "" {
		commit.Files = splitStrings(files)
	}
}

func splitStrings(s string) []string {
	if s == "" {
		return nil
	}
	var result []string
	for _, f := range split(s, ",") {
		result = append(result, f)
	}
	return result
}

func split(s, sep string) []string {
	if s == "" {
		return nil
	}
	var result []string
	start := 0
	for i := 0; i <= len(s)-len(sep); i++ {
		if s[i:i+len(sep)] == sep {
			result = append(result, s[start:i])
			start = i + len(sep)
			i += len(sep) - 1
		}
	}
	result = append(result, s[start:])
	return result
}
