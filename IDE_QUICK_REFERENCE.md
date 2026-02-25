# IDE Implementation - Quick Reference

## 📁 Files Created

### Core Components
```
apps/web/components/dashboard/
├── code-editor.tsx           # Monaco Editor wrapper component
└── assignment-card.tsx       # Reusable assignment display card
```

### UI Components (New)
```
apps/web/components/ui/
└── alert.tsx                 # Alert notification component
```

### Pages
```
apps/web/app/(dashboard)/student/
├── page.tsx                                    # Updated with assignments link
└── assignments/
    ├── page.tsx                                # List all assignments
    └── [id]/page.tsx                           # Assignment IDE (code editor)
```

### API & Types
```
apps/web/lib/
├── api/
│   └── assessments.ts        # Assessment service API client
└── constants/
    └── languages.ts          # Programming language configurations

apps/web/types/
└── assessment.types.ts       # TypeScript type definitions
```

### Documentation
```
/home/hasintha/my_projects/gradeloop-core-v2/
├── IDE_IMPLEMENTATION.md     # Full feature documentation
└── IDE_TESTING_GUIDE.md      # Testing procedures
```

---

## 🔑 Key Features

### 1. Monaco Code Editor
- **File**: `components/dashboard/code-editor.tsx`
- **Features**: Syntax highlighting, line numbers, minimap, dark theme
- **Languages**: 12 programming languages supported

### 2. Assignment Management
- **List Page**: `/student/assignments`
- **IDE Page**: `/student/assignments/[id]`
- **Features**: View, code, save, submit, version control

### 3. API Integration
- **Client**: `lib/api/assessments.ts`
- **Endpoints**:
  - GET `/assignments/:id` - Fetch assignment
  - POST `/submissions` - Submit code
  - GET `/assignments/:id/latest` - Get latest submission
  - GET `/submissions/:id/code` - Retrieve code from MinIO

### 4. Multi-Language Support
- **Config**: `lib/constants/languages.ts`
- **Languages**: Python, JavaScript, TypeScript, Java, C++, C, Go, Rust, PHP, Ruby, Kotlin, Swift
- **Each includes**: Name, Monaco ID, default template, file extension

---

## 🎯 Main User Flows

### View Assignments
```
Student Dashboard → Click "Pending Assignments" 
→ Assignment List Page → View all assignments with status
```

### Code & Submit
```
Assignment List → Click "Open Assignment" 
→ IDE Page → Write Code → Save/Submit 
→ Success Message → Redirect to List
```

### Resume Work
```
Open Assignment → System loads previous submission 
→ Continue coding → Save new version
```

---

## 🔧 Configuration

### Environment Variables
```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Dependencies (Already Installed)
```json
{
  "@monaco-editor/react": "^4.7.0",
  "monaco-editor": "^0.55.1",
  "axios": "^1.13.5",
  "date-fns": "^4.1.0",
  "zustand": "^5.0.11"
}
```

---

## 🚀 Running the Application

### Start Development Server
```bash
cd apps/web
bun run dev
```

### Access Pages## Student Routes
- **Dashboard**: http://localhost:3000/student
- **Assignments**: http://localhost:3000/student/assignments
- **IDE**: http://localhost:3000/student/assignments/[id]

---

## 🔌 Backend Services Required

### 1. Assessment Service (Port 8000)
```bash
cd apps/services/assessment-service
go run cmd/api/main.go
```

### 2. IAM Service (Port 8000)
```bash
cd apps/services/iam-service
go run cmd/api/main.go
```

### 3. MinIO (Object Storage)
```bash
docker-compose up minio
```

### 4. PostgreSQL
```bash
docker-compose up postgres
```

---

## 🧪 Quick Test

### 1. Create Assignment (Bruno)
```
Assessment Service > Assignments > Create Assignment
→ Copy assignment_id from response
```

### 2. Open in Browser
```
http://localhost:3000/student/assignments/[assignment_id]
```

### 3. Test Features
- ✅ Editor loads
- ✅ Can type code
- ✅ Can switch language
- ✅ Can save
- ✅ Can submit

---

## 📊 Component Hierarchy

```
AssignmentIDEPage (page.tsx)
├── CodeEditor (code-editor.tsx)
│   └── Monaco Editor (@monaco-editor/react)
├── Select (language selector)
│   └── Programming Languages (languages.ts)
├── Alert (success/error messages)
├── Badge (status indicators)
└── Buttons (Run, Save, Submit)
```

---

## 🗄️ Data Storage

### PostgreSQL Tables
- **assignments**: Assignment metadata
- **submissions**: Submission records with version tracking

### MinIO Buckets
- **Path**: `submissions/{assignment_id}/{submission_id}/code.txt`
- **Content**: Actual source code files

---

## 🎨 UI Component Library

All UI components use the existing shadcn/Radix UI setup:
- Card, CardHeader, CardTitle, CardDescription, CardContent
- Button
- Select, SelectTrigger, SelectValue, SelectContent, SelectItem
- Badge (with variants)
- Alert, AlertTitle, AlertDescription
- Separator
- ScrollArea

---

## 📡 API Methods

```typescript
// Import
import { assessmentApi } from "@/lib/api/assessments";

// Usage
const assignment = await assessmentApi.getAssignment(id);
const submission = await assessmentApi.createSubmission({ ... });
const code = await assessmentApi.getSubmissionCode(submissionId);
const latest = await assessmentApi.getLatestSubmission(assignmentId, userId);
```

---

## 🔐 Authentication

Uses existing auth system:
```typescript
import { useAuthStore } from "@/lib/stores/authStore";

const { user, accessToken } = useAuthStore();
```

- Access token automatically attached to API requests
- Refresh token handling included
- Role-based routing supported

---

## 🎯 TypeScript Types

All types in `types/assessment.types.ts`:

```typescript
- Assignment              // Assignment structure
- Submission              // Submission record
- CreateSubmissionRequest // API request
- SubmissionCodeResponse  // Code from MinIO
- ProgrammingLanguage     // Language enum
- LanguageConfig          // Language metadata
```

---

## 🚦 Status Indicators

### Assignment Status Colors
- 🟢 **Active** (green): Assignment open, not due yet
- 🟠 **Due Soon** (orange): Less than 24 hours remaining
- 🟠 **Late Period** (orange): Past due date, late submissions allowed
- 🔴 **Overdue** (red): Past all deadlines

### Feature Badges
- **Group Allowed**: Assignment supports group submissions
- **Late Submissions OK**: Late work accepted
- **AI Assistant**: AI help enabled
- **Time Limit**: Shows duration in minutes

---

## 💡 Key Implementation Details

### Auto-Save on Submit
- Every save/submit creates a new version
- `is_latest` flag marks current version
- Old versions preserved for history

### Language Switching
- Loads default template when switching
- Preserves code if user has written something
- Language persists with submission

### Timer Feature
- Only shown for time-limited assignments
- Countdown in MM:SS format
- Auto-submit when timer expires
- Can't start twice

### Error Handling
- Network errors caught and displayed
- User-friendly error messages
- Loading states on all async operations

---

## 📖 Documentation Links

### Implementation Details
- See: `IDE_IMPLEMENTATION.md`

### Testing Procedures
- See: `IDE_TESTING_GUIDE.md`

### API Documentation
- Bruno Collection: `bruno/Assessment Service/`
- Assignments: `bruno/Assessment Service/Assignments/`
- Submissions: `bruno/Assessment Service/Submissions/`

---

## ✅ Checklist for Production

Before deploying to production:

- [ ] Test with real assignment data
- [ ] Verify MinIO connection and storage
- [ ] Test code execution (when implemented)
- [ ] Add error boundary components
- [ ] Implement loading skeletons
- [ ] Add analytics tracking
- [ ] Test on mobile devices
- [ ] Verify accessibility
- [ ] Add rate limiting
- [ ] Set up monitoring/alerts

---

## 🎓 Student Experience

### Simple Workflow
1. Login → Dashboard
2. Click "Pending Assignments"
3. See all assignments
4. Click "Open Assignment"
5. Write code in editor
6. Select language
7. Save often
8. Submit when ready
9. Done!

### Smart Features
- Previous work loads automatically
- No manual file management
- Real-time syntax highlighting
- Clear status indicators
- One-click actions
- Immediate feedback

---

**Everything you need is now implemented and ready to test! 🚀**

For questions, refer to:
- `IDE_IMPLEMENTATION.md` - Complete feature list
- `IDE_TESTING_GUIDE.md` - Step-by-step testing
- This file - Quick lookup reference
