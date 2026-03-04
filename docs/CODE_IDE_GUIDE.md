# GradeLoop Embedded Code IDE

A full-featured, web-based Integrated Development Environment (IDE) built with Monaco Editor, designed for students and lecturers to write, edit, and submit code assignments within the GradeLoop LMS.

## 🎯 Features

### Core Functionality
- **Monaco Editor Integration**: Full VS Code editor experience in the browser
- **Multi-Language Support**: JavaScript, TypeScript, Python, Java, C++, C, Go, Rust, HTML, CSS, and more
- **Multi-File Projects**: Create, edit, and manage multiple files per assignment
- **Cloud Storage**: All files stored securely in MinIO (S3-compatible object storage)
- **Submission Queue**: Code submissions processed via RabbitMQ for scalable evaluation
- **Auto-Save**: Automatic file saving every 30 seconds
- **Real-time Syntax Highlighting**: Language-specific syntax highlighting and IntelliSense
- **Keyboard Shortcuts**: Standard IDE shortcuts (Ctrl+S to save, etc.)

### Role-Based Permissions

#### Students
- ✅ Edit their own code
- ✅ Create and delete files
- ✅ Submit assignments (when assignment is open)
- ✅ Download their code files
- ✅ View submission history

#### Lecturers
- ✅ All student permissions
- ✅ Review student submissions
- ✅ Grade assignments
- ✅ Create code templates
- ✅ View all student projects

## 📁 Project Structure

```
apps/web/
├── components/dashboard/
│   ├── code-ide.tsx              # Main IDE component
│   ├── monaco-editor.tsx          # Monaco Editor wrapper
│   ├── file-explorer.tsx          # File tree sidebar
│   └── code-editor.tsx            # Legacy editor (for backward compatibility)
├── lib/
│   ├── api/
│   │   ├── minio.service.ts       # MinIO storage service
│   │   └── submission.service.ts  # RabbitMQ submission service
│   ├── stores/
│   │   └── editor.store.ts        # Zustand state management
│   └── hooks/
│       └── use-code-editor.ts     # Custom React hooks
├── types/
│   └── code-editor.types.ts       # TypeScript definitions
└── app/(dashboard)/
    └── code-editor-demo/
        └── page.tsx               # Demo page
```

## 🚀 Quick Start

### 1. View the Demo

Navigate to the demo page:
```
http://localhost:3000/code-editor-demo
```

Toggle between Student and Lecturer roles to see different permissions in action.

### 2. Integrate into Your Assignment Page

```tsx
'use client';

import { CodeIDE } from '@/components/dashboard/code-ide';
import { useIDEPermissions } from '@/lib/hooks/use-code-editor';

export default function AssignmentPage({ params }: { params: { id: string } }) {
  const assignmentId = params.id;
  const userId = 'current-user-id'; // Get from auth context
  const userRole = 'student'; // Get from auth context
  
  const permissions = useIDEPermissions(userRole, 'open');
  
  return (
    <div className="h-screen">
      <CodeIDE
        projectId={`assignment-${assignmentId}-${userId}`}
        assignmentId={assignmentId}
        userId={userId}
        permissions={permissions}
        onSubmit={(submissionId) => {
          console.log('Submitted:', submissionId);
          // Navigate to results page or show confirmation
        }}
      />
    </div>
  );
}
```

### 3. Load Existing Project

```tsx
import { useCodeProject } from '@/lib/hooks/use-code-editor';

function MyComponent() {
  const projectId = 'project-123';
  const userId = 'user-456';
  
  const { isLoading, error, reload } = useCodeProject(projectId, userId);
  
  if (isLoading) return <div>Loading project...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <CodeIDE projectId={projectId} userId={userId} permissions={permissions} />;
}
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env.local`:

```bash
# MinIO / Object Storage
NEXT_PUBLIC_MINIO_API_URL=http://localhost:9000
NEXT_PUBLIC_STORAGE_SERVICE_URL=http://localhost:8080/api/v1

# Submission Service (RabbitMQ backend)
NEXT_PUBLIC_SUBMISSION_SERVICE_URL=http://localhost:8081/api/v1
```

### Backend Services Required

#### 1. MinIO (Object Storage)

The IDE stores all code files in MinIO. You'll need to implement a storage service with these endpoints:

**POST** `/api/v1/storage/upload`
```json
{
  "key": "assignments/{assignmentId}/{userId}/{projectId}/{filePath}",
  "content": "file content as string",
  "contentType": "text/plain",
  "metadata": {
    "userId": "string",
    "projectId": "string",
    "assignmentId": "string",
    "filePath": "string"
  }
}
```

**GET** `/api/v1/storage/download?key={key}`
```json
{
  "content": "file content as string"
}
```

**GET** `/api/v1/storage/list?prefix={prefix}`
```json
{
  "keys": ["key1", "key2", ...]
}
```

**DELETE** `/api/v1/storage/delete?key={key}`

#### 2. Submission Service (RabbitMQ)

Handle code submissions and evaluation queue:

**POST** `/api/v1/submissions/submit`
```json
{
  "assignmentId": "string",
  "userId": "string",
  "projectId": "string",
  "files": [
    {
      "name": "index.js",
      "path": "index.js",
      "minioKey": "assignments/...",
      "language": "javascript"
    }
  ],
  "submittedAt": "ISO 8601 timestamp"
}
```

Response:
```json
{
  "submissionId": "sub-123",
  "status": "queued",
  "queuePosition": 5,
  "estimatedTime": 120,
  "message": "Submission queued for evaluation"
}
```

**GET** `/api/v1/submissions/{id}/status`
```json
{
  "submissionId": "sub-123",
  "status": "completed", // or "queued" | "processing" | "failed"
  "result": {
    "compiled": true,
    "exitCode": 0,
    "stdout": "output",
    "stderr": "",
    "executionTime": 1500,
    "testResults": [...]
  },
  "grade": 95,
  "feedback": "Great work!"
}
```

## 🎨 Customization

### Change Editor Theme

```tsx
import { useEditorStore } from '@/lib/stores/editor.store';

function ThemeSelector() {
  const { settings, updateSettings } = useEditorStore();
  
  return (
    <select
      value={settings.theme.name}
      onChange={(e) => updateSettings({
        theme: { name: e.target.value, base: e.target.value as any }
      })}
    >
      <option value="vs-dark">Dark</option>
      <option value="vs-light">Light</option>
      <option value="hc-black">High Contrast Dark</option>
    </select>
  );
}
```

### Add Custom Keyboard Shortcuts

```tsx
import { useEditorShortcuts } from '@/lib/hooks/use-code-editor';

function MyEditor() {
  useEditorShortcuts({
    onSave: () => console.log('Save triggered'),
    onSubmit: () => console.log('Submit triggered'),
    onFormat: () => console.log('Format triggered'),
  });
  
  return <CodeIDE {...props} />;
}
```

### Adjust Auto-Save Interval

```tsx
import { useAutoSave } from '@/lib/hooks/use-code-editor';

function MyComponent() {
  useAutoSave(
    async () => {
      // Your save logic
    },
    60000, // 60 seconds
    true   // enabled
  );
}
```

## 📊 State Management

The IDE uses Zustand for state management. Access the store anywhere:

```tsx
import { useEditorStore } from '@/lib/stores/editor.store';

function MyComponent() {
  const {
    files,              // All files in current project
    activeFileId,       // Currently open file ID
    getActiveFile,      // Get active file object
    updateFile,         // Update file content
    addFile,            // Add new file
    deleteFile,         // Delete file
    hasUnsavedChanges,  // Check for unsaved changes
    settings,           // Editor settings
    updateSettings,     // Update settings
  } = useEditorStore();
  
  const activeFile = getActiveFile();
  
  return <div>Current file: {activeFile?.name}</div>;
}
```

## 🔐 Security Considerations

1. **Authentication**: All API calls use `withCredentials: true` to include auth cookies
2. **Authorization**: User ID is sent with all requests and validated server-side
3. **File Isolation**: Files are stored with user ID and assignment ID in path
4. **Input Validation**: Sanitize file names and content on backend
5. **Rate Limiting**: Implement rate limits on submission endpoints

## 📈 Performance Optimization

1. **Lazy Loading**: Monaco Editor is loaded on-demand
2. **Debounced Saves**: File changes are debounced before triggering saves
3. **Batch Operations**: Multiple files can be uploaded in a single batch
4. **Presigned URLs**: Use presigned URLs for large file downloads

## 🧪 Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeIDE } from '@/components/dashboard/code-ide';

describe('CodeIDE', () => {
  it('renders editor with files', () => {
    render(
      <CodeIDE
        projectId="test-project"
        userId="test-user"
        permissions={{
          canEdit: true,
          canSubmit: true,
          canReview: false,
          canGrade: false,
          canCreateTemplates: false,
        }}
      />
    );
    
    expect(screen.getByText('Code Editor')).toBeInTheDocument();
  });
});
```

## 🐛 Troubleshooting

### Monaco Editor not loading
- Ensure `@monaco-editor/react` is installed: `bun add @monaco-editor/react`
- Check browser console for errors
- Verify CDN access if using CDN mode

### Files not saving to MinIO
- Verify `NEXT_PUBLIC_STORAGE_SERVICE_URL` environment variable
- Check network tab for failed API calls
- Ensure backend storage service is running
- Verify MinIO credentials and bucket permissions

### Submissions not queueing
- Verify `NEXT_PUBLIC_SUBMISSION_SERVICE_URL` environment variable
- Check RabbitMQ connection on backend
- Ensure submission service worker is running
- Check backend logs for queue errors

## 📚 API Reference

### MinIO Service

```typescript
import { minioService } from '@/lib/api/minio.service';

// Upload file
await minioService.uploadFile({
  projectId: 'proj-123',
  filePath: 'index.js',
  content: 'console.log("Hello");',
  userId: 'user-456',
  assignmentId: 'assign-789'
});

// Download file
const content = await minioService.downloadFile({
  minioKey: 'assignments/.../index.js',
  userId: 'user-456'
});

// List files
const keys = await minioService.listFiles({
  projectId: 'proj-123',
  userId: 'user-456'
});

// Delete file
await minioService.deleteFile({
  minioKey: 'assignments/.../index.js',
  userId: 'user-456'
});
```

### Submission Service

```typescript
import { submissionService } from '@/lib/api/submission.service';

// Submit code
const response = await submissionService.submitCode({
  assignmentId: 'assign-789',
  userId: 'user-456',
  projectId: 'proj-123',
  files: [...],
  submittedAt: new Date().toISOString()
});

// Get submission status
const status = await submissionService.getSubmissionStatus('sub-123');

// Poll until complete
const result = await submissionService.pollSubmissionStatus('sub-123');

// Get submission history
const history = await submissionService.getSubmissionHistory('user-456', 'assign-789');
```

## 🎓 Example Use Cases

### 1. Programming Assignment
Students write Python code, submit for auto-grading against test cases.

### 2. Web Development Project
Students create HTML/CSS/JS files, preview in browser, submit for review.

### 3. Algorithm Challenge
Timed coding challenge with automatic submission and ranking.

### 4. Code Review Session
Lecturer opens student's project in read-only mode, adds comments.

### 5. Live Coding Demo
Lecturer shares screen with IDE, students follow along in their own IDE.

## 🤝 Contributing

When extending the IDE:

1. Follow existing TypeScript patterns
2. Add proper type definitions
3. Update tests
4. Document new features in this README

## 📄 License

Part of the GradeLoop LMS project.

---

**Built with:**
- Monaco Editor (VS Code's editor)
- React 19 & Next.js 16
- Zustand (state management)
- MinIO (object storage)
- RabbitMQ (message queue)
- TypeScript
- Tailwind CSS + shadcn/ui
