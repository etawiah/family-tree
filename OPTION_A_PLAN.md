# Option A Implementation Plan: Hybrid Approach

## Overview
Keep family-chart for **tree visualization and layout**, rebuild custom forms for **user input and editing**.

**Timeline:** ~7 hours | **Approach:** Restore deleted components with proper integration

---

## Architecture

```
FamilyTreeView (family-chart)
  ├─ Renders tree visualization
  ├─ Handles zoom/pan natively
  └─ Click → Opens custom modals

AddPersonModal
  ├─ PersonForm (form fields)
  └─ ImageUpload (photo with compression)

EditPersonModal
  ├─ PersonForm (pre-populated)
  ├─ ImageUpload
  └─ RelationshipForm

RelationshipModal
  └─ RelationshipForm (search + link)
```

---

## Implementation Tasks

### 1. Rebuild ImageUpload Component (2 hours)
**File:** `src/components/person/ImageUpload.jsx`

**Features:**
- Photo file picker
- Image compression using `browser-image-compression`
- Progress indicator
- Preview with clear button
- Error handling with user-friendly messages
- Returns { url, filename } after upload to `/api/upload`

**Dependencies:** Already in package.json - `browser-image-compression: ^2.0.2`

**Key Methods:**
- `selectFile()` - File picker
- `compressImage()` - Compress to <500KB
- `uploadFile()` - POST to `/api/upload`
- `clearImage()` - Reset state

### 2. Rebuild PersonForm Component (2 hours)
**File:** `src/components/person/PersonForm.jsx`

**Features:**
- Form fields: first name, last name, gender, birthday, deathday, location, profession, notes
- Photo upload (via ImageUpload)
- Form validation (first name required)
- Submit/Cancel buttons
- Props: `initialData`, `onSubmit`, `onCancel`, `isLoading`

**Removed Fields:**
- ❌ tree_side (maternal/paternal)
- ❌ warnOnTreeSideChange
- ❌ hasRelationships validation

**Integration with family-chart:**
- Form takes `data` object from family-chart person
- Returns updated `data` object
- Persisted via bulk save endpoint

### 3. Rebuild RelationshipForm Component (2 hours)
**File:** `src/components/relationships/RelationshipForm.jsx`

**Features:**
- Relationship type selector (spouse, child, parent, sibling)
- Person search field (search by name)
- Candidate list with photos and info
- Create new person option
- Submit/Cancel buttons
- Props: `person`, `onSubmit`, `onCancel`, `isLoading`

**Removed Fields:**
- ❌ tree_side from relationships
- ❌ formatTreeSide() helper
- ❌ treeSide from POST body

**Data Structure:**
```javascript
{
  person_id: 1,
  related_person_id: 2,
  relationship_type: "spouse" | "child" | "parent" | "sibling",
  is_blood_relation: true | false
}
```

### 4. Integrate Modals into FamilyTreeView (1 hour)
**File:** `src/components/tree/FamilyTreeView.jsx`

**Changes:**
- Add state for edit/add/relationship modals
- Handle card click → open EditPersonModal
- Handle "Add Person" button → open AddPersonModal
- Handle "Add Relationship" in EditModal → open RelationshipModal
- Update handlers to use new form components
- Invalidate React Query cache after saves

**Modal Flows:**
```
Card Click
  → EditPersonModal
    ├─ PersonForm (edit data)
    ├─ ImageUpload (change photo)
    └─ Relationships List
      └─ Add Relationship → RelationshipModal
        └─ RelationshipForm (add/link)

Add Person Button (in header or empty state)
  → AddPersonModal
    ├─ PersonForm (new)
    └─ ImageUpload
```

### 5. API Verification & Fixes (1 hour)
**Backend endpoints needed:**

- ✅ `GET /api/tree/family-chart` - Fetch tree (already exists)
- ✅ `POST /api/tree/family-chart` - Bulk save tree (already exists)
- ❓ `POST /api/upload` - Photo upload (need to verify)
- ❓ `GET /api/people` - List people for search (may need to add)
- ✅ Other people endpoints (check api.js)

**Actions:**
1. Verify `/api/upload` endpoint exists and works
2. Check if we need `/api/people?search=...` for relationship search
3. Verify bulk save handles all updates correctly

---

## Implementation Order

1. **Start with ImageUpload** - Independent component, can test separately
2. **Build PersonForm** - Uses ImageUpload, required for add/edit
3. **Build RelationshipForm** - Uses person list, independent
4. **Integrate all into FamilyTreeView** - Tie everything together
5. **Test end-to-end** - Add → Edit → Relationships → Photos
6. **Deploy** - Build, commit, push

---

## Success Criteria

✅ Can add first person (form + photo upload)
✅ Can edit person (form + photo upload)
✅ Can view relationships
✅ Can add relationships (search + link)
✅ Can remove relationships
✅ Photos upload and display
✅ Tree reflects changes after save
✅ No unhandled errors in console
✅ UX is clear (visible buttons, forms, feedback)

---

## Rollback Plan

If issues arise, revert to commit before this work:
```bash
git reset --hard <commit-before-option-a>
git push origin main --force
```

---

## Timeline Estimate

| Task | Duration | Status |
|------|----------|--------|
| ImageUpload | 2 hours | Pending |
| PersonForm | 2 hours | Pending |
| RelationshipForm | 2 hours | Pending |
| FamilyTreeView Integration | 1 hour | Pending |
| Testing | 1-2 hours | Pending |
| **TOTAL** | **~8-9 hours** | **IN PROGRESS** |

---
