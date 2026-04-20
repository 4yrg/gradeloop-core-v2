package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"
)

// MinIOStorage wraps the MinIO SDK client and provides domain-specific helpers
// for storing and retrieving student code submissions.
type MinIOStorage struct {
	client     *minio.Client
	bucketName string
	logger     *zap.Logger
}

// NewMinIOStorage creates and validates a MinIOStorage instance.
// It connects to the given endpoint, creates the target bucket if it does not
// already exist, and returns a ready-to-use storage handle.
func NewMinIOStorage(
	endpoint, accessKey, secretKey, bucketName string,
	useSSL bool,
	logger *zap.Logger,
) (*MinIOStorage, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("creating minio client: %w", err)
	}

	s := &MinIOStorage{
		client:     client,
		bucketName: bucketName,
		logger:     logger,
	}

	// Ensure the submissions bucket exists on startup so that the first upload
	// does not fail with a "NoSuchBucket" error.
	ctx := context.Background()
	if err := s.ensureBucket(ctx); err != nil {
		return nil, err
	}

	return s, nil
}

// ensureBucket creates the configured bucket when it does not already exist.
func (s *MinIOStorage) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucketName)
	if err != nil {
		return fmt.Errorf("checking bucket existence for %q: %w", s.bucketName, err)
	}

	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucketName, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("creating bucket %q: %w", s.bucketName, err)
		}
		s.logger.Info("minio bucket created",
			zap.String("bucket", s.bucketName),
		)
	} else {
		s.logger.Info("minio bucket ready",
			zap.String("bucket", s.bucketName),
		)
	}

	return nil
}

// UploadSubmission stores the student's source code in MinIO under the path:
//
//	submissions/{assignment_id}/{submission_id}/code.txt
//
// It returns the object key (storage path) that should be persisted in the
// submissions table so the code can later be retrieved or streamed.
func (s *MinIOStorage) UploadSubmission(
	ctx context.Context,
	submissionID, assignmentID, code string,
) (string, error) {
	objectName := fmt.Sprintf("submissions/%s/%s/code.txt", assignmentID, submissionID)

	content := []byte(code)
	reader := bytes.NewReader(content)

	_, err := s.client.PutObject(
		ctx,
		s.bucketName,
		objectName,
		reader,
		int64(len(content)),
		minio.PutObjectOptions{
			ContentType: "text/plain; charset=utf-8",
		},
	)
	if err != nil {
		return "", fmt.Errorf("uploading submission %s to minio: %w", objectName, err)
	}

	s.logger.Info("submission uploaded to minio",
		zap.String("object", objectName),
		zap.Int("bytes", len(content)),
	)

	return objectName, nil
}

// GetSubmissionCode retrieves the raw source code for a submission from MinIO
// using the storage path that was returned by UploadSubmission.
func (s *MinIOStorage) GetSubmissionCode(ctx context.Context, storagePath string) (string, error) {
	obj, err := s.client.GetObject(ctx, s.bucketName, storagePath, minio.GetObjectOptions{})
	if err != nil {
		return "", fmt.Errorf("getting object %q from minio: %w", storagePath, err)
	}
	defer obj.Close()

	buf, err := io.ReadAll(obj)
	if err != nil {
		return "", fmt.Errorf("reading object content for %q: %w", storagePath, err)
	}

	return string(buf), nil
}
