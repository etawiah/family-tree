# Peer Review: Family-Chart Reset Plan Execution

## Status: ✅ Plan Executed Correctly | ⚠️ Massive Usability Gaps

Cursor **correctly executed** the technical reset plan, but created **critical usability problems** that make the app nearly unusable.

---

## What Cursor Did Right ✅

### Backend Implementation
- ✅ API correctly outputs `parents` array format (family-chart native)
- ✅ `/api/tree/family-chart` GET endpoint returns proper data structure
- ✅ `/api/tree/family-chart` POST bulk save endpoint handles incoming edits
- ✅ Removed legacy tree_side filtering and endpoints

### Frontend Reset
- ✅ FamilyTreeView rebuilt using native family-chart APIs
- ✅ `createChart()`, `editTree()`, `updateTree()` used correctly
- ✅ Deleted legacy files (FamilyTreeView.old, TreeSelector, PersonNode)
- ✅ Removed conflicting custom forms (PersonForm, AddPersonPage, EditPersonPage)
- ✅ Access control (`canEdit` prop) properly integrated

### Git Hygiene
- ✅ Clean commit with all changes together
- ✅ Massive code deletion (4,195 lines removed) executed without errors

---

## Critical Usability Gaps ⚠️

### 1. **Photo Upload Completely Broken**
**Problem:** ImageUpload.jsx was deleted. Now photos are managed via a text field in the editTree modal:
```javascript
{ type: "text", label: "Photo", id: "photo" }
```

**Result:** Users can ONLY:
- Manually type a URL
- No file picker
- No image compression
- No R2 integration
- No preview
- No validation

**Impact:** ❌ Photo upload is **non-functional** for normal users

**Fix Needed:** Rebuild ImageUpload or create a custom photo upload modal that integrates with family-chart

---

### 2. **No Person Detail View**
**Problem:** PersonDetail.jsx was deleted. There's no sidebar to view person information before editing.

**Result:** Users can only see:
- Card display in tree: `["first name", "last name"], ["birthday"]`
- Have to click "edit" to see full details
- No preview of relationships
- No photo display in detail view

**Impact:** ⚠️ Poor UX - have to edit to see details

**Fix Needed:** Keep a simple PersonDetail sidebar OR enhance card display

---

### 3. **Relationship Management is Primitive**
**Problem:** RelationshipForm.jsx was deleted. Relationships are now managed only via family-chart's basic editTree modal.

**Result:** Users see basic add/edit/remove of links, but:
- No search for people to link
- No photo preview when selecting who to link to
- No validation (can you link to yourself? Create circular relationships?)
- Hard to identify the right person if there are duplicates
- No relationship metadata (marriage date, divorce date, order)

**Impact:** ⚠️ Hard to manage relationships correctly

**Fix Needed:** Create a custom relationship manager that wraps family-chart's functionality

---

### 4. **Missing Search Functionality**
**Problem:** No way to search for people in the tree.

**Result:** If you have 100 family members, good luck finding someone to link to.

**Impact:** ⚠️ Tree becomes unusable at scale

**Fix Needed:** Add search integration with family-chart

---

### 5. **No Admin People Management**
**Problem:** AdminDashboard still exists but it's a list view. There's no way to:
- Edit people from admin panel
- Bulk import
- Fix bad relationships
- View relationship graph

**Impact:** ⚠️ Admin can't properly manage data

**Fix Needed:** Add admin edit functionality or direct users to tree editor

---

### 6. **Family-Chart EditTree Modal is Too Basic**
**Problem:** Family-chart's `editTree()` provides basic text fields and relationship linking, but:
- No photo upload
- No relationship metadata (marriage date, etc.)
- No notes in the UI
- No location field visible (it's in the form but not displayed on card)
- No profession field visible

**Result:** Users fill in fields but can't see them on the card display until they edit again

**Impact:** ⚠️ Confusing UX - data appears to vanish

---

## How to Interact with the App Now (Best Guess)

1. **View Tree**: Click "Tree" → See family-chart with names and birthdays
2. **Add Person**: Click "+" button in tree (if family-chart has it) OR click the add icon in editTree modal
3. **Edit Person**: Click on a card → editTree modal opens
4. **Set Photo**: In modal, find the "Photo" text field and paste a URL (or leave blank)
5. **Add Relationship**: In modal, use family-chart's relationship picker to select parent/spouse/child
6. **Delete Person**: In modal, click delete button

**Usability Score: 3/10** 📉

---

## What's Missing (Deleted Components That Need Rebuilding)

| Component | Purpose | Status |
|-----------|---------|--------|
| **ImageUpload** | Photo upload with compression | ❌ Deleted - CRITICAL |
| **PersonDetail** | Sidebar detail view | ❌ Deleted - Nice-to-have |
| **PersonForm** | Form validation + rendering | ❌ Deleted - Handled by editTree |
| **AddPersonPage** | Dedicated add flow | ❌ Deleted - Handled by editTree |
| **EditPersonPage** | Dedicated edit flow | ❌ Deleted - Handled by editTree |
| **RelationshipForm** | Relationship management | ❌ Deleted - Handled by editTree |
| **TreeControls** | Search, zoom, filters | ❌ Deleted - Need to rebuild |

---

## Recommendation

### Option A: Augment Family-Chart (Recommended)
Keep family-chart as the core, but wrap it with custom UI for:
1. Photo upload modal (integrate with ImageUpload)
2. Relationship search and preview
3. Person detail sidebar
4. Search functionality

**Timeline:** 4-6 hours
**Result:** Family-chart handles structure, custom UI handles UX

### Option B: Go Back to My Plan
Use family-chart as **data provider**, keep custom forms for **UX**:
- Family-chart renders tree
- Custom EditPersonPage for editing (with photo upload, relationships, etc.)
- Family-chart focuses on visualization, not editing

**Timeline:** 6-8 hours
**Result:** Best of both worlds

### Option C: Continue with Pure Family-Chart
Completely rewrite all missing UX within family-chart's limitations:
- Build custom photo upload modal
- Build custom relationship picker modal
- Accept basic card display
- Accept no search

**Timeline:** 8-10 hours
**Result:** Clean, but basic UX

---

## Verdict

**Cursor executed the plan perfectly, but the plan itself had a flaw:**

The plan assumed family-chart's `editTree()` modal would be sufficient, but it:
- Has no photo upload
- Has no search
- Has very limited field display
- Doesn't show photos on cards
- Doesn't show metadata

**The app is now technically correct but practically unusable.**

We need to add custom UX layers on top of family-chart, not replace the entire UI with it.

---

## Next Steps (My Recommendation)

1. **Rebuild ImageUpload as a Modal** (2 hours)
   - Reuse the deleted code
   - Trigger from editTree fields or custom modal
   - Integrate with family-chart data

2. **Add Relationship Picker Modal** (2 hours)
   - Search for people to link to
   - Show photos and preview
   - Better UX than raw editTree

3. **Add PersonDetail Sidebar** (1 hour)
   - Show full person info with photos
   - Trigger from card click
   - Read-only or link to edit modal

4. **Test End-to-End** (2 hours)
   - Try full workflow: add → edit → relationships → view
   - Verify photos upload and display
   - Check relationship linking works

**Total: 7 hours**

**Better approach: Use family-chart for visualization + rendering, but keep custom forms for UX.**

