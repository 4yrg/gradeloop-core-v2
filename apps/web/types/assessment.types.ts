// Assessment Service Types

export interface Assignment {
  id: string;
  course_instance_id: string;
  title: string;
  description?: string;
  code?: string;
  release_at?: string;
  due_at?: string;
  late_due_at?: string;
  allow_late_submissions: boolean;
  enforce_time_limit?: number;
  allow_group_submission: boolean;
  max_group_size?: number;
  enable_ai_assistant: boolean;
  enable_socratic_feedback: boolean;
  allow_regenerate: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssignmentListResponse {
  assignments: Assignment[];
  count: number;
}

export interface Submission {
  id: string;
  assignment_id: string;
  user_id?: string;
  group_id?: string;
  version: number;
  is_latest: boolean;
  status: string;
  language?: string;
  storage_path: string;
  submitted_at: string;
  created_at: string;
}

export interface CreateSubmissionRequest {
  assignment_id: string;
  group_id?: string;
  language?: string;
  code: string;
}

export interface SubmissionCodeResponse {
  submission_id: string;
  assignment_id: string;
  language?: string;
  version: number;
  code: string;
}

export interface SubmissionVersion {
  id: string;
  version: number;
  submitted_at: string;
  status: string;
}

export interface SubmissionVersionsResponse {
  submissions: SubmissionVersion[];
  count: number;
}

export type ProgrammingLanguage = 
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'cpp'
  | 'c'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'kotlin'
  | 'swift';

export interface LanguageConfig {
  id: ProgrammingLanguage;
  name: string;
  monacoId: string;
  defaultCode: string;
  extension: string;
}
