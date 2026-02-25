export type FileLanguage = 
  | 'javascript' 
  | 'typescript' 
  | 'python' 
  | 'java' 
  | 'cpp' 
  | 'c' 
  | 'go' 
  | 'rust' 
  | 'html' 
  | 'css' 
  | 'json' 
  | 'markdown';

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: FileLanguage;
  isModified: boolean;
  minioKey?: string; // S3/MinIO object key
}

export interface CodeProject {
  id: string;
  name: string;
  description?: string;
  files: CodeFile[];
  assignmentId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionPayload {
  assignmentId: string;
  userId: string;
  projectId: string;
  files: Array<{
    name: string;
    path: string;
    minioKey: string;
    language: FileLanguage;
  }>;
  submittedAt: string;
}

export interface MinIOUploadResponse {
  key: string;
  url: string;
  bucket: string;
}

export type EditorTheme = 'vs-dark' | 'hc-black' | 'vs-light';

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  theme: EditorTheme;
}

export type UserRole = 'student' | 'lecturer' | 'admin';

export interface IDEPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canGrade: boolean;
  canCreateTemplates: boolean;
}


export interface CodeProject {
  id: string;
  name: string;
  description?: string;
  assignmentId?: string;
  userId: string;
  files: CodeFile[];
  rootPath: string;
  language: SupportedLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface CodeSubmission {
  id: string;
  projectId: string;
  assignmentId: string;
  userId: string;
  files: CodeFile[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  submittedAt: string;
  result?: {
    compiled: boolean;
    output?: string;
    error?: string;
    grade?: number;
    feedback?: string;
  };
}

export interface EditorSettings {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface MinIOUploadRequest {
  projectId: string;
  filePath: string;
  content: string;
  userId: string;
}

export interface MinIOUploadResponse {
  success: boolean;
  fileUrl: string;
  objectName: string;
}

export interface SubmissionQueueRequest {
  submissionId: string;
  projectId: string;
  assignmentId: string;
  userId: string;
  files: CodeFile[];
}

export interface SubmissionQueueResponse {
  success: boolean;
  queueId: string;
  position?: number;
  estimatedTime?: number;
}
