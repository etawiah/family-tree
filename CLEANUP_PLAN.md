# Family-Chart Integration Cleanup Plan

## Overview
Remove all legacy code related to tree_side separation (maternal/paternal filtering).
Family-chart handles relationships natively - we don't need to retrofit old logic.

## Files to Modify

### 1. PersonForm.jsx - Remove tree_side field
**Current:** Form has tree_side dropdown (maternal/paternal)
**Why remove:** Family-chart doesn't use tree_side - people are nodes with relationships
**Changes:**
- Remove tree_side from formState initialization
- Remove tree_side field from JSX
- Remove tree_side validation
- Remove tree_side from error checking
- Update description text (currently says tree_side is required)

**Expected result:** Form only has:
- first_name, middle_name, last_name
- gender
- birth_date, death_date, is_alive
- location, profession, notes
- photos

### 2. AdminDashboard.jsx - Unified people list
**Current:** Two separate tabs - maternal people and paternal people
**Why remove:** Unified tree means all people in one list
**Changes:**
- Remove maternal/paternal separate fetches
- Single /api/admin/people query (no tree_side filter)
- Remove tabbed interface
- Show all people in one list

### 3. PersonDetail.jsx - Remove tree_side display
**Current:** Shows "Tree Side: maternal" etc
**Why remove:** Not relevant in unified tree
**Changes:**
- Remove tree_side display
- Keep: name, dates, location, profession, notes, relationships

### 4. RelationshipForm.jsx - Remove tree_side handling
**Current:** Adds tree_side when creating relationships
**Why remove:** Family-chart handles relationship types (spouse, child, parent)
**Changes:**
- Remove tree_side parameter from relationship creation
- Keep: relationship_type selection (spouse, child, parent)
- Keep: person selection

### 5. FamilyTreeView.jsx - Simplify initialization
**Current:** Complex color coding, ancestry calculation, view mode toggle
**Why simplify:** Family-chart provides the tree visualization
**Changes:**
- Remove ancestry calculation logic (O(n²) function)
- Remove color coding for now (keep simple)
- Keep: Basic tree rendering with family-chart
- Keep: Click to view person details
- Keep: Add/Edit/Delete person navigation
- Optional later: Add color coding based on live data if needed

### 6. functions/api.js - Remove tree_side filtering
**Current:** getTreeDataForFamilyChart applies tree_side filtering
**Why remove:** Unified tree returns all people with all relationships
**Changes:**
- Remove tree_side filtering logic
- Remove ancestry calculation from backend
- Simple transformation: people → family-chart format
- Let family-chart do layout, we just provide the data

### 7. AddPersonPage.jsx - Update description
**Current:** "Required fields: first name, last name, gender, and tree side"
**Why remove:** tree_side no longer exists
**Changes:**
- Update text to: "Required fields: first name, last name, gender"

## What We're NOT Removing

✅ Keep: Basic CRUD (Create, Read, Update, Delete people)
✅ Keep: Relationship management (add/remove relationships)
✅ Keep: Photo upload
✅ Keep: Person details view
✅ Keep: Authentication and access levels
✅ Keep: Family-chart tree visualization

## Timeline

1. **Phase 1: Form cleanup (PersonForm, AddPersonPage)**
   - Remove tree_side field and validation
   - Update descriptions
   - Test: Can create person without tree_side

2. **Phase 2: Admin cleanup (AdminDashboard)**
   - Merge maternal/paternal into single list
   - Single API query
   - Test: Admin shows all people

3. **Phase 3: Detail cleanup (PersonDetail, RelationshipForm)**
   - Remove tree_side display
   - Simplify relationship form
   - Test: Can view person and add relationships

4. **Phase 4: Backend cleanup (functions/api.js)**
   - Remove tree_side filtering
   - Simple data transformation
   - Test: API returns all people with relationships

5. **Phase 5: Frontend simplification (FamilyTreeView.jsx)**
   - Remove color coding logic
   - Remove ancestry calculation
   - Keep simple tree rendering
   - Test: Tree displays and user can interact

## Expected Result

**Before (Overcomplicated):**
- Maternal and paternal trees
- tree_side field in every form
- Complex color coding and ancestry logic
- Multiple API queries
- Relationship form tree_side handling

**After (Clean):**
- One unified tree (family-chart renders it)
- People form: just basic info
- Simple API: /api/tree/family-chart returns everyone
- One admin list with all people
- Relationships managed by family-chart relationship types

## Testing After Cleanup

```
1. Create a new person (no tree_side field visible)
2. View Admin page (see all people in one list)
3. Click Edit person → see details (no tree_side)
4. Add relationship (no tree_side parameter)
5. Go to Tree → See unified family-chart visualization
6. Click person card → See details
7. Navigate to Add Person → Add another person
```

If all above work without errors, cleanup is successful.

## Rollback If Needed

All changes are in version control:
```bash
git log --oneline  # Find cleanup commits
git reset --hard <commit-before-cleanup>
```

But we should NOT need to rollback - this is just removing code, not changing functionality.
