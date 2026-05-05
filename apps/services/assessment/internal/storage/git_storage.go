package storage

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"
)

type GoGitSeaweedStorage struct {
	minio      *minio.Client
	bucketName string
	logger    *zap.Logger
}

func NewGoGitSeaweedStorage(
	endpoint, accessKey, secretKey, bucketName string,
	useSSL bool,
	logger *zap.Logger,
) (*GoGitSeaweedStorage, error) {
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("creating seaweed client: %w", err)
	}

	s := &GoGitSeaweedStorage{
		minio:      minioClient,
		bucketName: bucketName,
		logger:    logger,
	}

	ctx := context.Background()
	if err := s.ensureBucket(ctx); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *GoGitSeaweedStorage) ensureBucket(ctx context.Context) error {
	exists, err := s.minio.BucketExists(ctx, s.bucketName)
	if err != nil {
		return fmt.Errorf("checking bucket existence: %w", err)
	}

	if !exists {
		if err := s.minio.MakeBucket(ctx, s.bucketName, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("creating bucket: %w", err)
		}
		s.logger.Info("go-git seaweed bucket created", zap.String("bucket", s.bucketName))
	}
	return nil
}

func (s *GoGitSeaweedStorage) basePath(assignmentID, userID string) string {
	return fmt.Sprintf("code/%s/%s", assignmentID, userID)
}

func (s *GoGitSeaweedStorage) gitPath(assignmentID, userID, subPath string) string {
	return fmt.Sprintf("code/%s/%s/.git/%s", assignmentID, userID, subPath)
}

func (s *GoGitSeaweedStorage) objectPath(assignmentID, userID, objType, hash string) string {
	return fmt.Sprintf("code/%s/%s/.git/objects/%s/%s", assignmentID, userID, objType, hash)
}

func (s *GoGitSeaweedStorage) computeHash(content string) string {
	h := sha1.New()
	h.Write([]byte(content))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *GoGitSeaweedStorage) InitRepo(ctx context.Context, assignmentID, userID string) error {
	repoPath := s.basePath(assignmentID, userID)

	emptyContent := []byte("")
	reader := bytes.NewReader(emptyContent)

	_, err := s.minio.PutObject(ctx, s.bucketName, repoPath+"/.git/HEAD", reader, 0, minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("creating repo: %w", err)
	}

	headContent := "ref: refs/heads/main"
	headReader := bytes.NewReader([]byte(headContent))
	s.minio.PutObject(ctx, s.bucketName, s.gitPath(assignmentID, userID, "HEAD"), headReader, int64(len(headContent)), minio.PutObjectOptions{})

	configContent := "repositoryformatversion = 0\n"
	configReader := bytes.NewReader([]byte(configContent))
	s.minio.PutObject(ctx, s.bucketName, s.gitPath(assignmentID, userID, "config"), configReader, int64(len(configContent)), minio.PutObjectOptions{})

	s.logger.Info("go-git repo initialized",
		zap.String("assignment", assignmentID),
		zap.String("user", userID),
	)

	return nil
}

func (s *GoGitSeaweedStorage) ListFiles(ctx context.Context, assignmentID, userID, path string) ([]GoGitFileInfo, error) {
	prefix := s.basePath(assignmentID, userID)
	if path != "" {
		prefix = prefix + "/" + path
	}

	var files []GoGitFileInfo

	objCh := s.minio.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
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

		files = append(files, GoGitFileInfo{
			Name:     name,
			Path:    name,
			Size:    obj.Size,
			IsFolder: strings.HasSuffix(obj.Key, "/"),
		})
	}

	return files, nil
}

func (s *GoGitSeaweedStorage) GetFile(ctx context.Context, assignmentID, userID, filePath string) (string, error) {
	objectName := s.basePath(assignmentID, userID) + "/" + filePath

	obj, err := s.minio.GetObject(ctx, s.bucketName, objectName, minio.GetObjectOptions{})
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

func (s *GoGitSeaweedStorage) SaveFile(ctx context.Context, assignmentID, userID, filePath, content string) (string, error) {
	objectName := s.basePath(assignmentID, userID) + "/" + filePath

	blobHash := s.computeHash(content)
	blobContent := fmt.Sprintf("blob %d\x00%s", len(content), content)
	blobPath := s.objectPath(assignmentID, userID, blobHash[:2], blobHash[2:])
	blobReader := bytes.NewReader([]byte(blobContent))
	s.minio.PutObject(ctx, s.bucketName, blobPath, blobReader, int64(len(blobContent)), minio.PutObjectOptions{})

	reader := bytes.NewReader([]byte(content))

	info, err := s.minio.PutObject(ctx, s.bucketName, objectName, reader, int64(len(content)), minio.PutObjectOptions{
		ContentType: "text/plain; charset=utf-8",
	})
	if err != nil {
		return "", fmt.Errorf("saving file: %w", err)
	}

	s.logger.Info("file saved via go-git storage",
		zap.String("path", objectName),
		zap.Int64("size", info.Size),
		zap.String("sha", blobHash),
	)

	return blobHash, nil
}

func (s *GoGitSeaweedStorage) Commit(ctx context.Context, assignmentID, userID, message, author string, filePaths []string) (string, error) {
	treeContent := ""
	for _, path := range filePaths {
		treeContent += path + "\n"
	}

	treeHash := s.computeHash(treeContent)
	treePath := s.objectPath(assignmentID, userID, treeHash[:2], treeHash[2:])
	treeReader := bytes.NewReader([]byte(treeContent))
	s.minio.PutObject(ctx, s.bucketName, treePath, treeReader, int64(len(treeContent)), minio.PutObjectOptions{})

	commitContent := fmt.Sprintf("tree %s\nauthor %s <%s> %d\ncommitter %s <%s> %d\n\n%s\n",
		treeHash,
		author, "user@gradeloop.com", time.Now().Unix(),
		author, "user@gradeloop.com", time.Now().Unix(),
		message,
	)

	commitHash := s.computeHash(commitContent)
	commitPath := s.objectPath(assignmentID, userID, commitHash[:2], commitHash[2:])
	commitReader := bytes.NewReader([]byte(commitContent))
	s.minio.PutObject(ctx, s.bucketName, commitPath, commitReader, int64(len(commitContent)), minio.PutObjectOptions{})

	err := s.UpdateHead(ctx, assignmentID, userID, commitHash)
	if err != nil {
		return "", err
	}

	s.logger.Info("commit created",
		zap.String("hash", commitHash),
		zap.String("assignment", assignmentID),
		zap.String("message", message),
	)

	return commitHash, nil
}

func (s *GoGitSeaweedStorage) GetCommits(ctx context.Context, assignmentID, userID string) ([]GoGitCommitInfo, error) {
	prefix := s.gitPath(assignmentID, userID, "objects/")

	var commits []GoGitCommitInfo

	objCh := s.minio.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for obj := range objCh {
		if obj.Err != nil {
			break
		}

		key := obj.Key
		if strings.Contains(key, "objects/") && !strings.Contains(key, "/refs/") {
			if strings.HasSuffix(key, "/") {
				continue
			}

			objPart := strings.TrimPrefix(key, s.gitPath(assignmentID, userID, ""))
			if strings.HasPrefix(objPart, "objects/") {
				parts := strings.Split(objPart, "/")
				if len(parts) >= 3 && parts[2] != "" {
					hash := parts[1] + parts[2]
					commits = append(commits, GoGitCommitInfo{
						SHA: hash,
					})
				}
			}
		}
	}

	return commits, nil
}

func (s *GoGitSeaweedStorage) GetLatestCommitSHA(ctx context.Context, assignmentID, userID string) (string, error) {
	headRef := s.gitPath(assignmentID, userID, "HEAD")

	obj, err := s.minio.GetObject(ctx, s.bucketName, headRef, minio.GetObjectOptions{})
	if err != nil {
		return "", nil
	}
	defer obj.Close()

	content, err := io.ReadAll(obj)
	if err != nil {
		return "", nil
	}

	ref := string(bytes.TrimSpace(content))
	if strings.HasPrefix(ref, "ref: ") {
		refPath := s.gitPath(assignmentID, userID, strings.TrimPrefix(ref, "ref: "))
		obj2, err := s.minio.GetObject(ctx, s.bucketName, refPath, minio.GetObjectOptions{})
		if err != nil {
			return "", nil
		}
		defer obj2.Close()

		content2, err := io.ReadAll(obj2)
		if err != nil {
			return "", nil
		}
		return string(bytes.TrimSpace(content2)), nil
	}

	return ref, nil
}

func (s *GoGitSeaweedStorage) UpdateHead(ctx context.Context, assignmentID, userID, sha string) error {
	headPath := s.gitPath(assignmentID, userID, "HEAD")

	reader := bytes.NewReader([]byte(sha))
	_, err := s.minio.PutObject(ctx, s.bucketName, headPath, reader, int64(len(sha)), minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("updating HEAD: %w", err)
	}

	return nil
}

func (s *GoGitSeaweedStorage) SaveVersion(ctx context.Context, assignmentID, userID, version, message string, files []string) error {
	sha, err := s.Commit(ctx, assignmentID, userID, message, "system", files)
	if err != nil {
		return err
	}

	err = s.UpdateHead(ctx, assignmentID, userID, sha)
	if err != nil {
		return err
	}

	versionPath := s.gitPath(assignmentID, userID, "refs/tags/"+version)
	tagContent := fmt.Sprintf("%s\n%s", sha, message)
	reader := bytes.NewReader([]byte(tagContent))
	_, err = s.minio.PutObject(ctx, s.bucketName, versionPath, reader, int64(len(tagContent)), minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("saving version tag: %w", err)
	}

	return nil
}

func (s *GoGitSeaweedStorage) GetVersions(ctx context.Context, assignmentID, userID string) ([]GoGitVersionInfo, error) {
	prefix := s.gitPath(assignmentID, userID, "refs/tags/")

	var versions []GoGitVersionInfo

	objCh := s.minio.ListObjects(ctx, s.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false,
	})

	for obj := range objCh {
		if obj.Err != nil {
			break
		}

		name := obj.Key
		if len(name) > len(prefix) {
			tagName := name[len(prefix):]
			versions = append(versions, GoGitVersionInfo{
				ID:      tagName,
				Version: len(versions) + 1,
			})
		}
	}

	return versions, nil
}

type GoGitFileInfo struct {
	Name     string
	Path    string
	Size    int64
	IsFolder bool
}

type GoGitCommitInfo struct {
	SHA     string
	Message string
	Author  string
	Date    time.Time
	Files   []string
}

type GoGitVersionInfo struct {
	ID          string
	Version     int
	CommitSHA   string
	Message    string
	SubmittedAt time.Time
}