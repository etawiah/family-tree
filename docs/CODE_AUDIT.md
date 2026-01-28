# Code-Level Integration & Implementation Gap Audit

**Audit Date:** 2026-01-28
**Status:** IN PROGRESS
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 1. BACKEND API ISSUES

### ✅ `/api/tree/family-chart` Endpoint
- **Status:** Properly implemented and wired
- **Authentication:** ✓ Enforced (requireAuth("view"))
- **Response Format:** ✓ Returns {tree: [...]} correctly
- **Error Handling:** ✓ Try/catch in place

### 🟡 calculateAncestry() Function
- **Issue:** O(n²) complexity - searches all people for each person's parents
- **Location:** functions/api.js:1236-1287
- **Impact:** Performance degrades with large families (100+ people)
- **Fix:** Build Map<parentId, person> once, then lookup in O(1)
- **Code:**
  ```javascript
  const personMap = new Map(people.map(p => [p.id, p]));
  // Then use: const parent = personMap.get(rel.related_person_id);
  ```

### 🟡 Parent Assignment Logic
- **Issue:** Only assigns father + mother (2 parents max)
- **Location:** functions/api.js:1377-1384
- **Impact:** If person has 3+ parents, only first male and female are kept
- **Real-world:** Extremely rare, but not technically invalid
- **Consideration:** family-chart schema supports only father/mother anyway

### 🟢 Type Conversion Redundancy
- **Issue:** `parseInt(p)` where `p` is already a string ID
- **Location:** functions/api.js:1378
- **Impact:** None - parseInt("123") works fine, returns 123
- **Fix:** Just use `p` directly since IDs are already strings

---

## 2. FRONTEND COMPONENT ISSUES

### 🔴 MEMORY LEAK: Event Listener Not Cleaned Up
- **Severity:** CRITICAL
- **Location:** src/components/tree/FamilyTreeView.jsx:122-126
- **Issue:** `addEventListener` added inside useEffect, but never removed
- **Code:**
  ```javascript
  containerRef.current.addEventListener("click", (e) => { ... });
  // No removal in cleanup function!
  return () => { containerRef.current.innerHTML = ""; };
  ```
- **Problem:** Each time treeData/viewMode changes, new listener added without removing old
- **Impact:** Memory leak, duplicate event handlers, multiple PersonDetail opens on click
- **Fix:**
  ```javascript
  // Store listener ref and remove it
  useEffect(() => {
    if (!containerRef.current || treeData.length === 0) return;

    const handleClick = (e) => { ... };
    containerRef.current.addEventListener("click", handleClick);

    return () => {
      containerRef.current?.removeEventListener("click", handleClick);
      containerRef.current.innerHTML = "";
    };
  }, [treeData, viewMode]);
  ```

### 🟡 useEffect Dependency Array Missing showToast
- **Location:** src/components/tree/FamilyTreeView.jsx:131, dependency array line 140
- **Issue:** `showToast` is used in effect but not in dependency array
- **Code:**
  ```javascript
  showToast(`Error rendering tree: ${err.message}`, "error"); // line 131
  }, [treeData, viewMode]); // line 140 - missing showToast!
  ```
- **Impact:** Potential stale closure, ESLint warning
- **Likelihood:** Low impact if showToast is stable (context function)
- **Fix:** Add showToast to dependencies or disable lint if intentional

### 🟡 Missing Error Boundary
- **Issue:** If family-chart throws error, entire tree component unmounts
- **Location:** src/components/tree/FamilyTreeView.jsx try/catch (lines 54-131)
- **Impact:** User sees broken page instead of "Error rendering tree"
- **Fix:** Already has try/catch, but should test it

### 🟢 containerRef Could Be Null
- **Location:** src/components/tree/FamilyTreeView.jsx:122
- **Issue:** `containerRef.current.addEventListener` - what if ref is null?
- **Code:** `if (!containerRef.current || treeData.length === 0) return;` guards this
- **Status:** ✓ Already guarded at line 49

---

## 3. DATA FLOW ISSUES

### 🟠 Query Cache Key Mismatch - ALREADY FIXED
- **Location:** Multiple pages
- **Status:** ✓ FIXED in commit 8127cb1
- **Was:** AddPersonPage invalidated ["tree"] but FamilyTreeView used ["family-chart-tree"]
- **Now:** Both pages invalidate ["family-chart-tree"]

### 🟡 RelationshipForm Not Invalidating Queries
- **Location:** src/components/relationships/RelationshipForm.jsx
- **Issue:** When adding relationship, doesn't invalidate ["family-chart-tree"]
- **Result:** Tree doesn't refresh after adding parent/child/spouse
- **Impact:** User adds relationship but tree doesn't update
- **Files to Check:**
  - Does RelationshipForm import queryClient?
  - Does it invalidate cache after POST?

### 🟠 PersonDetail Sidebar Not Using Cached Data
- **Location:** src/components/tree/FamilyTreeView.jsx:213-242
- **Issue:** FamilyTreeView fetches person details with separate API call
- **Why:** FamilyTreeView has treeData with person info, but PersonDetail makes fresh API call
- **Better Approach:** Get person info from treeData, only fetch relationships if needed
- **Current Flow:**
  1. User clicks person card in tree
  2. FamilyTreeView finds person from treeData
  3. Opens PersonDetail sidebar
  4. PersonDetail makes NEW API call to /api/people/{id}
- **Issue:** Redundant API call, stale data if tree was recently updated

### 🟡 Tree Re-renders When viewMode Changes
- **Location:** src/components/tree/FamilyTreeView.jsx:140 dependency array
- **Issue:** useEffect depends on `viewMode`, but pedigree view not implemented
- **Code:** `}, [treeData, viewMode]);`
- **Problem:** viewMode button exists but functionality doesn't (just shows toast)
- **Check:** handleZoomIn/Out/Reset also just show toasts - are these implemented in family-chart?

---

## 4. QUERY CACHE MANAGEMENT

### 🟡 Inconsistent Query Key Naming
- **Used Keys:**
  - ["family-chart-tree"] - Primary tree view
  - ["tree"] - Legacy key (still invalidated for compatibility)
  - ["people"] - Not used, only invalidated
  - ["person", id] - Single person
- **Issue:** ["tree"] and ["people"] aren't used by any useQuery
- **Cleanup:** Can remove these from invalidateQueries to be more efficient

### 🟠 Missing Query Invalidation in AddPersonForm
- **When:** User creates new person from form
- **What invalidates:** AddPersonPage.jsx
- **Missing:** RelationshipForm.jsx when user adds relationship
- **Impact:** Adding relationship doesn't refresh tree

### 🟡 Stale Time Too Long?
- **Location:** FamilyTreeView.jsx:42
- **Config:** `staleTime: 5 * 60 * 1000` (5 minutes)
- **Issue:** After adding person, tree stays "stale" for 5 minutes
- **Impact:** Unlikely to matter since we invalidate on mutations, but worth noting
- **Consider:** 1 minute would be safer

---

## 5. ERROR HANDLING & VALIDATION

### 🟢 API Response Validation
- **Location:** FamilyTreeView.jsx:36-40
- **Status:** ✓ Checks response.ok before parsing JSON
- **Status:** ✓ Gracefully handles failed fetches

### 🟡 PersonForm tree_side Requirement
- **Location:** AddPersonPage.jsx:55-58
- **Issue:** Says "Required fields: first name, last name, gender, and tree side"
- **But:** tree_side should NOT be required for unified tree
- **Impact:** Users see confusing message about tree side
- **Fix:** Update text to make tree_side optional, OR remove requirement from form

### 🟡 Missing Validation: Empty Tree
- **Location:** FamilyTreeView.jsx:45 check for length === 0
- **Shows:** "No people in the tree yet"
- **Issue:** Doesn't distinguish between:
  1. Legitimate empty tree (no people added)
  2. API error (no response data)
  3. User has no permissions to see anyone
- **Current Code:** Shows same message for all 3

### 🟢 Family-chart Data Validation
- **Issue:** What if person has invalid data format?
- **Status:** family-chart likely handles gracefully, but untested

---

## 6. AUTHENTICATION & AUTHORIZATION

### 🟢 `/api/tree/family-chart` Protected
- **Status:** ✓ Requires "view" access level
- **Verified:** Line 198 in functions/api.js

### 🟢 `/api/people/{id}` Protected
- **Status:** ✓ Should require "view" access level
- **Not Verified:** Need to check functions/api.js implementation

### 🟠 Admin Can Create People
- **Issue:** Can admin create people for other users?
- **Check:** PersonForm - does it validate current user?
- **Impact:** Unknown - may be intended feature

---

## 7. MISSING FEATURES & LOOSE ENDS

### 🟠 View Mode Toggle Not Implemented
- **Location:** FamilyTreeView.jsx:163-175
- **UI Shows:** "Descendant View" and "Pedigree View" buttons
- **Implementation:** Just dummy console.log and toast
- **Issue:** Buttons don't actually switch views
- **Fix:** Either implement pedigree view or hide toggle buttons

### 🟠 Search Not Fully Implemented
- **Location:** FamilyTreeView.jsx:184-198
- **Issue:** Search finds person, but doesn't actually center/focus tree on them
- **Code:** `chartRef.current.store.update.mainId(matchingPerson.id);`
- **Problem:** `update.mainId` may not exist in family-chart API
- **Testing:** Did search work when you tested?

### 🟡 Zoom Controls Show Toasts Instead of Working
- **Location:** FamilyTreeView.jsx:142-172
- **Code:** `handleZoomIn`, `handleZoomOut`, `handleFitToScreen` - all just show toasts
- **Issue:** These don't actually zoom/pan/fit
- **Family-chart:** Doesn't seem to expose zoom API in current usage
- **Fix:** Either implement or hide controls

### 🟡 Relationship Display Missing "related_person_name"
- **Location:** EditPersonPage.jsx:240
- **Code:** `const relatedPerson = rel.related_person_name || \`Person #${rel.related_person_id}\`;`
- **Issue:** Backend doesn't populate "related_person_name"
- **Impact:** Shows "Person #5" instead of "John Smith"
- **Check:** Does `/api/people/{id}` endpoint fetch relationship person names?

---

## 8. ACCESSIBILITY & SEMANTICS

### 🟢 Keyboard Navigation
- **Buttons:** Have proper type="button"
- **Forms:** Use proper labels and aria-label

### 🟡 Tree View Accessibility
- **Issue:** family-chart SVG elements may not be accessible
- **Check:** Can screen readers navigate the tree?
- **Cards:** Need proper ARIA labels if not text content

### 🟢 Modal Accessibility
- **Status:** ✓ Has proper structure and close button
- **Check:** Keyboard trapping works?

---

## 9. MOBILE RESPONSIVENESS

### 🟡 FamilyTreeView Height Calculation
- **Location:** FamilyTreeView.jsx:253
- **Code:** `style={{ width: "100%", height: "calc(100vh - 320px)" }}`
- **Issue:** 320px fixed height - doesn't adapt to mobile header sizes
- **On Mobile:** Tree might have wrong height, cutting off content
- **Fix:** Use CSS media queries or JS calculation

### 🟢 Tree Controls Responsive
- **Status:** ✓ Buttons should reflow on small screens

### 🟡 PersonDetail Sidebar
- **Issue:** On mobile, sidebar might overlap tree
- **Check:** Does it work on iPhone/Android?

---

## 10. CODE QUALITY

### 🟡 Unused Imports
- **Check:** Are all imports actually used?
- **Example:** queryClient imported in FamilyTreeView?

### 🟡 Unused Variables
- **Check:** `chartRef.current` - what's stored there?
- **Check:** Is it used in zoom/pan handlers?

### 🟡 Hard-coded Values
- **Card dimensions:** 220x90 (line 78)
- **Node separation:** 250 (line 58)
- **Level separation:** 150 (line 59)
- **Stale time:** 5 minutes (line 42)
- **Should be:** Configurable constants

---

## SUMMARY

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Backend API | 0 | 0 | 2 | 1 |
| Frontend Components | 1 | 1 | 4 | 3 |
| Data Flow | 0 | 1 | 3 | 0 |
| Query Management | 0 | 1 | 2 | 0 |
| Error Handling | 0 | 0 | 2 | 1 |
| Authentication | 0 | 0 | 1 | 0 |
| Missing Features | 0 | 2 | 1 | 0 |
| Accessibility | 0 | 0 | 1 | 1 |
| Mobile | 0 | 0 | 1 | 1 |
| Code Quality | 0 | 0 | 3 | 2 |

**TOTAL:** 1 Critical, 5 High, 20 Medium, 10 Low

---

## PRIORITY FIXES (Recommend Addressing)

### 🔴 Priority 1 - CRITICAL
1. [ ] Remove event listener memory leak in FamilyTreeView useEffect

### 🟠 Priority 2 - HIGH (Should Fix)
2. [ ] Add query invalidation to RelationshipForm
3. [ ] Fetch related_person_name in relationship queries
4. [ ] Implement or hide view mode toggle (descendant/pedigree)
5. [ ] Fix useEffect dependency array (add showToast)

### 🟡 Priority 3 - MEDIUM (Nice to Have)
6. [ ] Optimize calculateAncestry from O(n²) to O(n)
7. [ ] Use cached treeData instead of fetching person details again
8. [ ] Update AddPersonPage text about tree_side requirement
9. [ ] Implement zoom/pan or hide controls
10. [ ] Test search functionality

