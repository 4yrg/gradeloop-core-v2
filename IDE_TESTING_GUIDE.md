# Code Editor IDE - Testing Guide

## 🚀 Quick Start

### 1. Start the Development Server

```bash
cd /home/hasintha/my_projects/gradeloop-core-v2/apps/web
bun run dev
```

### 2. Navigate to Student Assignment Pages

The implementation includes two main pages:

#### Assignments List
```
http://localhost:3000/student/assignments
```
Shows all available assignments with status badges and quick actions.

#### Assignment IDE (Code Editor)
```
http://localhost:3000/student/assignments/[assignment-id]
```
Replace `[assignment-id]` with an actual assignment UUID from your database.

---

## 🧪 Testing Checklist

### ✅ Assignment List Page Tests

- [ ] Page loads successfully
- [ ] Assignment cards display correctly
- [ ] Status badges show correct colors (Active, Due Soon, Overdue)
- [ ] Quick stats cards show counts
- [ ] "Open Assignment" button navigates to IDE
- [ ] Click on "Pending Assignments" card from dashboard navigates here

### ✅ Assignment IDE Page Tests

#### Load & Display
- [ ] Assignment details load correctly
- [ ] Code editor renders with Monaco
- [ ] Previous submission loads automatically (if exists)
- [ ] Default template loads for new assignment
- [ ] Time limit indicator shows (if applicable)

#### Code Editor
- [ ] Can type in the editor
- [ ] Syntax highlighting works
- [ ] Line numbers display
- [ ] Minimap appears on right side
- [ ] Can scroll through code
- [ ] Dark theme applied

#### Language Selector
- [ ] Dropdown shows all 12 languages
- [ ] Can switch between languages
- [ ] Code template updates when switching (if empty)
- [ ] Selected language persists

#### Actions
- [ ] "Run Code" button shows alert (placeholder)
- [ ] "Save" button creates submission
- [ ] Success message appears after save
- [ ] "Submit" button shows confirmation dialog
- [ ] Submit creates new version
- [ ] Redirects after successful submission

#### Timer (for time-limited assignments)
- [ ] "Start Timer" button appears
- [ ] Timer starts countdown
- [ ] Timer displays remaining time
- [ ] Warning when time is running out
- [ ] Auto-submit when time expires

#### Error Handling
- [ ] Error message shows for failed saves
- [ ] Error message shows for failed submissions
- [ ] Network errors handled gracefully

---

## 🔌 Backend Integration Tests

### Prerequisites
Ensure these services are running:

1. **Assessment Service** (Go)
   ```bash
   cd apps/services/assessment-service
   go run cmd/api/main.go
   ```

2. **MinIO** (Object Storage)
   ```bash
   docker ps | grep minio
   ```

3. **IAM Service** (Authentication)
   ```bash
   cd apps/services/iam-service
   go run cmd/api/main.go
   ```

### Test API Integration

#### 1. Create Test Assignment (using Bruno)
```
Bruno > Assessment Service > Assignments > Create Assignment
```

Save the returned `assignment_id` for testing.

#### 2. Test Assignment Load
- Navigate to: `http://localhost:3000/student/assignments/[assignment_id]`
- Verify assignment details display
- Check that editor loads

#### 3. Test Code Submission
1. Write some code in the editor
2. Select a language
3. Click "Save"
4. Verify success message
5. Check Bruno or database for new submission record

#### 4. Test Code Retrieval
1. Refresh the page
2. Verify previously saved code loads
3. Verify language selection persists

#### 5. Test Versioning
1. Save code (version 1)
2. Modify code
3. Save again (version 2)
4. Verify both versions in database
5. Latest version should load by default

---

## 🐛 Common Issues & Solutions

### Issue: TypeScript Error on alert.tsx
**Error**: `Cannot find module '@/components/ui/alert'`

**Solution**: This is a TypeScript server caching issue.
```bash
# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Or rebuild the project
cd apps/web
bun run build
```

### Issue: Monaco Editor Not Loading
**Solution**: Check if `@monaco-editor/react` is installed
```bash
cd apps/web
bun install
```

### Issue: API Calls Failing
**Solution**: Verify environment variables
```bash
# Check .env.local in apps/web/
echo $NEXT_PUBLIC_API_URL  # Should be http://localhost:8000/api/v1
```

### Issue: Authentication Errors
**Solution**: Login first through the IAM service
1. Navigate to `/login`
2. Login with test credentials
3. Token should be stored automatically

### Issue: Assignment Not Found
**Solution**: Make sure assignment exists and is active
```sql
-- Check PostgreSQL
SELECT id, title, is_active FROM assignments WHERE is_active = true;
```

---

## 📊 Data Flow Diagram

```
┌──────────────┐
│   Student    │
│  Dashboard   │
└──────┬───────┘
       │
       │ Clicks "View Assignments"
       ↓
┌──────────────────┐
│  Assignment List │ ← GET /assignments/course-instance/:id
└──────┬───────────┘
       │
       │ Clicks "Open Assignment"
       ↓
┌──────────────────────────┐
│   Assignment IDE Page    │
└──────┬───────────────────┘
       │
       ├─→ GET /assignments/:id (details)
       ├─→ GET /assignments/:id/latest (previous submission)
       └─→ GET /submissions/:id/code (code content)
       
       ↓ Student writes code
       │
       ├─→ POST /submissions (Save)
       └─→ POST /submissions (Submit)
              │
              └─→ Stores in MinIO: submissions/{assignment_id}/{submission_id}/code.txt
```

---

## 🎯 Feature Testing Scenarios

### Scenario 1: First-Time User
1. Student logs in
2. Navigates to assignments
3. Opens first assignment
4. Sees Python template
5. Writes "Hello, World!"
6. Clicks Save
7. Sees success message

### Scenario 2: Continuing Work
1. Student returns to assignment
2. Previous code loads automatically
3. Student modifies code
4. Student saves again (creates v2)
5. Student submits final version
6. Redirects to assignment list

### Scenario 3: Timed Assignment
1. Opens time-limited assignment
2. Sees timer warning
3. Clicks "Start Timer"
4. Timer counts down
5. Student writes code
6. Submits before time expires
7. Success!

### Scenario 4: Language Switching
1. Opens assignment with Python default
2. Switches to Java
3. Java template appears
4. Writes Java code
5. Saves successfully
6. Language persists on reload

---

## 📝 API Test Checklist

Using Bruno API client:

### Authentication
- [ ] Login via IAM Service
- [ ] Access token saved to environment

### Assignments
- [ ] Create assignment
- [ ] Get assignment by ID
- [ ] List assignments by course instance

### Submissions
- [ ] Create individual submission
- [ ] Get latest submission
- [ ] Get submission code from MinIO
- [ ] List submission versions

---

## 🔍 Database Verification

After testing, verify data in PostgreSQL:

```sql
-- Check assignments
SELECT id, title, code, due_at, is_active 
FROM assignments 
WHERE is_active = true;

-- Check submissions
SELECT id, assignment_id, user_id, version, is_latest, language, submitted_at
FROM submissions
ORDER BY created_at DESC
LIMIT 10;

-- Check latest submissions only
SELECT * FROM submissions 
WHERE is_latest = true;
```

And in MinIO:
```
Bucket: gradeloop
Path: submissions/{assignment_id}/{submission_id}/code.txt
```

---

## ✨ Success Criteria

The implementation is successful if:

1. ✅ Students can view all assignments
2. ✅ Students can open the code editor
3. ✅ Students can write and edit code
4. ✅ Students can switch programming languages
5. ✅ Students can save drafts
6. ✅ Students can submit final versions
7. ✅ Previous work loads automatically
8. ✅ Submission creates new versions
9. ✅ Code stores in MinIO correctly
10. ✅ Timer works for time-limited assignments

---

## 🚦 Next Steps After Testing

Once testing confirms everything works:

1. **Add Real Data Integration**
   - Connect to actual enrollment data
   - Fetch real course instances
   - Display actual assignments

2. **Implement Code Execution**
   - Set up sandboxed execution environment
   - Add output display panel
   - Support test cases

3. **Add Group Features**
   - Group formation UI
   - Group submission flow
   - Member management

4. **Enhance UI**
   - Add version comparison view
   - Show submission history
   - Display grading feedback

5. **Add Student Navigation**
   - Update sidebar for student role
   - Add assignments link to main navigation
   - Create breadcrumbs

---

**Happy Testing! 🎉**

For issues or questions, check:
- `IDE_IMPLEMENTATION.md` - Full feature documentation
- Bruno API docs - API reference
- Backend service READMEs - Service-specific docs
