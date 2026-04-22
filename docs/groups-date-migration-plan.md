# Groups Date Migration Plan

## Overview
Migrate Groups (Batches) from `start_year` and `end_year` (integers) to `start_date` and `end_date` (dates) for more precise academic scheduling.

## Backend Changes Required (Academic Service)

### 1. Database Migration

**Schema Changes:**
```sql
-- Add new date columns
ALTER TABLE batches ADD COLUMN start_date DATE;
ALTER TABLE batches ADD COLUMN end_date DATE;

-- Migrate existing data (example: convert year to academic year start)
UPDATE batches
SET start_date = MAKE_DATE(start_year, 7, 1),  -- July 1st of start year
    end_date = MAKE_DATE(end_year, 6, 30);     -- June 30th of end year

-- Drop old columns (after verification)
ALTER TABLE batches DROP COLUMN start_year;
ALTER TABLE batches DROP COLUMN end_year;
```

**Note:** Adjust the date conversion logic based on your institution's academic calendar.

### 2. Go Model Updates

**File:** `apps/services/academic-service/models/batch.go`

```go
type Batch struct {
    ID                string    `json:"id"`
    ParentID          *string   `json:"parent_id"`
    DegreeID          string    `json:"degree_id"`
    SpecializationID  *string   `json:"specialization_id"`
    Name              string    `json:"name"`
    Code              string    `json:"code"`
    StartDate         time.Time `json:"start_date"`  // Changed from int
    EndDate           time.Time `json:"end_date"`    // Changed from int
    IsActive          bool      `json:"is_active"`
    CreatedAt         time.Time `json:"created_at"`
    UpdatedAt         time.Time `json:"updated_at"`
}

type CreateBatchRequest struct {
    ParentID         *string `json:"parent_id"`
    DegreeID         string  `json:"degree_id" binding:"required"`
    SpecializationID *string `json:"specialization_id"`
    Name             string  `json:"name" binding:"required"`
    Code             string  `json:"code" binding:"required"`
    StartDate        string  `json:"start_date" binding:"required"` // ISO 8601 format
    EndDate          string  `json:"end_date" binding:"required"`   // ISO 8601 format
}

type UpdateBatchRequest struct {
    Name             *string `json:"name"`
    StartDate        *string `json:"start_date"` // ISO 8601 format
    EndDate          *string `json:"end_date"`   // ISO 8601 format
    SpecializationID *string `json:"specialization_id"`
}
```

### 3. API Validation

Add date validation in request handlers:
- Ensure `start_date` is before `end_date`
- Parse ISO 8601 date strings (YYYY-MM-DD)
- Handle timezone considerations (store in UTC, display in institution timezone)

### 4. API Documentation

Update Bruno API collection:
- `bruno/Academic Service/Groups/Create Batch.bru`
- `bruno/Academic Service/Groups/Update Batch.bru`
- `bruno/Academic Service/Groups/Get Batch by ID.bru`

Update request examples to use dates instead of years.

## Frontend Changes (After Backend Deployment)

### 1. Type Definitions

**File:** `apps/web/types/academics.types.ts`

```typescript
export interface Batch {
  id: string;
  parent_id: string | null;
  degree_id: string;
  specialization_id: string | null;
  name: string;
  code: string;
  start_date: string;  // Changed from start_year: number
  end_date: string;    // Changed from end_year: number
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchRequest {
  parent_id?: string | null;
  degree_id: string;
  specialization_id?: string | null;
  name: string;
  code: string;
  start_date: string;  // ISO 8601 date string
  end_date: string;    // ISO 8601 date string
}

export interface UpdateBatchRequest {
  name?: string;
  start_date?: string;
  end_date?: string;
  specialization_id?: string | null;
}
```

### 2. Group Dialog Components

**File:** `apps/web/components/admin/academics/group-dialogs.tsx`

Replace the year input fields with date pickers:

```tsx
// Import DatePickerField (see semester-dialogs.tsx for reference)
import { DatePickerField } from '@/components/ui/date-picker';

// In CreateGroupDialog - replace:
<Input
  type="number"
  value={values.start_year}
  onChange={(e) => set('start_year', parseInt(e.target.value))}
/>

// With:
<DatePickerField
  value={values.start_date ? new Date(values.start_date) : undefined}
  onChange={(date) => set('start_date', date?.toISOString().split('T')[0] || '')}
  placeholder="Select start date"
/>

// Similar changes for end_date fields
```

**Validation Updates:**

```typescript
function validateCreate(v: CreateBatchRequest): AcademicFormErrors {
  const e: AcademicFormErrors = {};
  if (!v.name.trim()) e.name = 'Name is required';
  if (!v.code.trim()) e.code = 'Code is required';
  if (!v.degree_id) e.degree_id = 'Degree is required';
  if (!v.start_date) e.start_date = 'Start date is required';
  if (!v.end_date) e.end_date = 'End date is required';

  // Date validation
  if (v.start_date && v.end_date) {
    const start = new Date(v.start_date);
    const end = new Date(v.end_date);
    if (end <= start) {
      e.end_date = 'End date must be after start date';
    }
  }

  return e;
}
```

### 3. Display Updates

**Files to Update:**
- `apps/web/app/(dashboard)/admin/academics/groups/page.tsx` - List view date display
- `apps/web/app/(dashboard)/admin/academics/groups/[id]/page.tsx` - Detail view date display

Replace year display logic with formatted dates:

```typescript
// Before:
<p>{batch.start_year} - {batch.end_year}</p>

// After:
<p>
  {new Date(batch.start_date).toLocaleDateString()} -
  {new Date(batch.end_date).toLocaleDateString()}
</p>
```

## Testing Checklist

### Backend Testing
- [ ] Database migration runs successfully on dev/staging
- [ ] All existing batches have valid date conversions
- [ ] API endpoints accept and return date strings
- [ ] Date validation prevents invalid date ranges
- [ ] Bruno API tests updated and passing

### Frontend Testing
- [ ] Create new batch with date pickers
- [ ] Edit existing batch start/end dates
- [ ] Date validation shows appropriate error messages
- [ ] Dates display correctly in lists and detail views
- [ ] Date pickers respect institution's academic calendar
- [ ] Timezone handling is correct

## Deployment Strategy

1. **Backend First:** Deploy academic service with database migration
2. **Verify:** Check all existing batches have valid dates
3. **Frontend:** Deploy web app with updated types and UI
4. **Monitor:** Check for any date formatting issues
5. **Rollback Plan:** Keep backup of original data before migration

## Timeline Estimate

- Backend changes: 2-3 hours
- Testing: 1-2 hours
- Frontend changes: 1 hour
- End-to-end testing: 1 hour
- **Total:** ~5-7 hours

## Notes

- Consider institution's academic calendar conventions (e.g., July-June vs September-August)
- Ensure date formatting is consistent across all views
- Test with different timezones if system is used internationally
- Consider adding academic year helper functions for common operations
