import axios from 'axios';
import { MinIOUploadResponse } from '@/types/code-editor.types';

const MINIO_API_BASE = process.env.NEXT_PUBLIC_MINIO_API_URL || 'http://localhost:9000';
const STORAGE_SERVICE_BASE = process.env.NEXT_PUBLIC_STORAGE_SERVICE_URL || 'http://localhost:8080/api/v1';

interface UploadFileParams {
  projectId: string;
  filePath: string;
  content: string;
  userId: string;
  assignmentId?: string;
}

interface DownloadFileParams {
  minioKey: string;
  userId: string;
}

interface ListFilesParams {
  projectId: string;
  userId: string;
}

interface DeleteFileParams {
  minioKey: string;
  userId: string;
}

export const minioService = {
  /**
   * Upload a code file to MinIO
   */
  async uploadFile(params: UploadFileParams): Promise<MinIOUploadResponse> {
    const { projectId, filePath, content, userId, assignmentId } = params;
    
    // Generate MinIO key: assignments/{assignmentId}/{userId}/{projectId}/{filePath}
    const key = assignmentId 
      ? `assignments/${assignmentId}/${userId}/${projectId}/${filePath}`
      : `projects/${userId}/${projectId}/${filePath}`;

    try {
      const response = await axios.post<MinIOUploadResponse>(
        `${STORAGE_SERVICE_BASE}/storage/upload`,
        {
          key,
          content,
          contentType: 'text/plain',
          metadata: {
            userId,
            projectId,
            assignmentId: assignmentId || '',
            filePath,
          },
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('MinIO upload failed:', error);
      throw new Error('Failed to upload file to storage');
    }
  },

  /**
   * Download a code file from MinIO
   */
  async downloadFile(params: DownloadFileParams): Promise<string> {
    const { minioKey, userId } = params;

    try {
      const response = await axios.get<{ content: string }>(
        `${STORAGE_SERVICE_BASE}/storage/download`,
        {
          params: { key: minioKey },
          withCredentials: true,
          headers: {
            'X-User-ID': userId,
          },
        }
      );

      return response.data.content;
    } catch (error) {
      console.error('MinIO download failed:', error);
      throw new Error('Failed to download file from storage');
    }
  },

  /**
   * List all files for a project
   */
  async listFiles(params: ListFilesParams): Promise<string[]> {
    const { projectId, userId } = params;

    try {
      const response = await axios.get<{ keys: string[] }>(
        `${STORAGE_SERVICE_BASE}/storage/list`,
        {
          params: {
            prefix: `projects/${userId}/${projectId}/`,
          },
          withCredentials: true,
        }
      );

      return response.data.keys;
    } catch (error) {
      console.error('MinIO list failed:', error);
      throw new Error('Failed to list files from storage');
    }
  },

  /**
   * Delete a file from MinIO
   */
  async deleteFile(params: DeleteFileParams): Promise<void> {
    const { minioKey, userId } = params;

    try {
      await axios.delete(
        `${STORAGE_SERVICE_BASE}/storage/delete`,
        {
          params: { key: minioKey },
          withCredentials: true,
          headers: {
            'X-User-ID': userId,
          },
        }
      );
    } catch (error) {
      console.error('MinIO delete failed:', error);
      throw new Error('Failed to delete file from storage');
    }
  },

  /**
   * Get a presigned URL for direct download
   */
  async getPresignedUrl(minioKey: string): Promise<string> {
    try {
      const response = await axios.get<{ url: string }>(
        `${STORAGE_SERVICE_BASE}/storage/presigned-url`,
        {
          params: { key: minioKey },
          withCredentials: true,
        }
      );

      return response.data.url;
    } catch (error) {
      console.error('Failed to get presigned URL:', error);
      throw new Error('Failed to generate download URL');
    }
  },

  /**
   * Batch upload multiple files
   */
  async uploadBatch(files: UploadFileParams[]): Promise<MinIOUploadResponse[]> {
    try {
      const uploadPromises = files.map((file) => this.uploadFile(file));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Batch upload failed:', error);
      throw new Error('Failed to upload files');
    }
  },
};
