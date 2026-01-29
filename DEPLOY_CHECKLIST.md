# Deployment Readiness Checklist

## Pre-Deployment Verification

### Code Quality ✅
- [x] Removed all legacy maternal/paternal code
- [x] Removed tree_side from forms, validation, API
- [x] Simplified FamilyTreeView to 270 lines
- [x] Cleaned up backend API (removed calculateAncestry)
- [x] Fixed infinite loop bug with initialization guards
- [x] No commented-out code or debug statements

### Git Status
```bash
git status
# Should show clean working tree
```

### Build Check
```bash
npm run build
# Should complete without errors or warnings
```

---

## Deployment Steps

### Step 1: Build
```bash
npm run build
```
Verify:
- No compilation errors
- No warnings about missing dependencies
- `dist/` folder created with production build

### Step 2: Deploy Frontend to Cloudflare Pages
```bash
npm run deploy:app
```
Verify:
- Deployment completes successfully
- Check Cloudflare Pages dashboard for deployment status
- Wait for green checkmark

### Step 3: Deploy Worker API to Cloudflare Workers
```bash
npm run worker:deploy
```
Verify:
- Worker deploys successfully
- Check Cloudflare Workers dashboard
- No errors in deployment log

---

## Post-Deployment Testing

### Phase 1: Load Tree (5 minutes)
1. **Go to live site URL**
   - Example: `https://family-tree.yourdomain.com/`

2. **Login with test credentials**
   - Watch console (F12) for any errors
   - Should see logs like:
     ```
     [FamilyTreeView] Initializing with treeData length: X
     [FamilyTreeView] Creating family-chart store
     ```

3. **Navigate to /tree**
   - Tree should load in ~2 seconds
   - Should see family-chart visualization with all people
   - No blank/empty state

4. **Verify tree renders**
   - Can see all family members as cards
   - Can see relationships (lines connecting people)
   - Can interact (hover shows shadows, cursor changes)

**Expected Result:** ✅ Family-chart renders with all people visible

---

### Phase 2: Interact with Tree (5 minutes)

1. **Click on a person card**
   - PersonDetail sidebar should open on right
   - Shows name, dates, location, profession, photos, relationships
   - No errors in console

2. **Click "Edit Person"**
   - Navigate to `/people/{id}/edit`
   - Form loads with person data
   - NO tree_side field visible (verify!)
   - Can see form fields: name, gender, dates, location, profession, notes

3. **Click "Close" on PersonDetail**
   - Sidebar closes
   - Tree remains visible and interactive

4. **Try zoom**
   - Scroll wheel should zoom tree
   - Drag should pan tree
   - Tree should be responsive

**Expected Result:** ✅ All interactions work smoothly

---

### Phase 3: Create & Edit (10 minutes)

1. **Add a new person**
   - Click "Add Person" in header
   - Go to `/people/new`
   - Form should show: name, gender, dates, location, profession, notes, photos
   - NO tree_side field!
   - Fill in: First Name="Test", Last Name="Person", Gender="Other"
   - Click Save

2. **Verify person created**
   - Should redirect to `/tree`
   - Toast says "Person added successfully"
   - New person appears in family-chart tree
   - Can click and view details

3. **Edit the person**
   - Click on new person card
   - Click "Edit Person"
   - Go to edit page
   - Form pre-populated with data
   - Change profession to "Test Engineer"
   - Click Save
   - Verify update succeeds

**Expected Result:** ✅ Full CRUD works end-to-end

---

### Phase 4: Relationships (10 minutes)

1. **Add relationship**
   - Go to existing person's edit page
   - Scroll to "Relationships" section
   - Click "Add Relationship"
   - Modal opens (RelationshipForm)
   - Select relationship type (e.g., "Child")
   - Search for and select another person
   - Click Save

2. **Verify relationship created**
   - Modal closes
   - Relationship appears in list
   - Go back to tree
   - Verify new relationship shows in tree visualization

3. **Test with multiple people**
   - Try adding spouse, child, parent relationships
   - Verify all types work
   - Check console for errors

**Expected Result:** ✅ Relationships work across all types

---

## Verification Checklist

After all tests, verify:

### Console Logs
```
✅ No error messages
✅ No "tree_side" references
✅ No infinite loops or repeated errors
✅ Logs show successful initialization
```

### UI/UX
```
✅ Tree renders with all people
✅ No maternal/paternal split views
✅ PersonForm has NO tree_side field
✅ RelationshipForm works without tree_side
✅ PersonDetail shows clean info (no tree_side)
✅ Can add, edit, delete people
✅ Can add, edit, delete relationships
```

### Performance
```
✅ Tree loads in < 3 seconds
✅ Tree zoom/pan is smooth
✅ Add person is instant
✅ No lag when clicking cards
```

### Data
```
✅ All family members visible
✅ All relationships display correctly
✅ Photos load properly
✅ No data corruption or missing fields
```

---

## Rollback Instructions

If something fails:

```bash
# See recent commits
git log --oneline | head -10

# Rollback to commit before cleanup
git reset --hard <commit-hash>
git push origin main --force

# Redeploy
npm run build
npm run deploy:app
npm run worker:deploy
```

---

## Success Indicators

You'll know it's working when:

1. ✅ Tree loads with all family members visible
2. ✅ No "maternal" / "paternal" tabs or fields anywhere
3. ✅ PersonForm is simpler (no tree_side selector)
4. ✅ You can create/edit/delete people normally
5. ✅ You can add relationships between any people
6. ✅ Console shows no errors
7. ✅ Performance is snappy (< 3 sec load, smooth interactions)

---

## Support

If issues occur:

1. **Check Console (F12)**
   - Look for error messages
   - Note exact error text

2. **Check Network Tab**
   - Is API responding?
   - Are responses successful (200 status)?
   - What's the response payload?

3. **Check Cloudflare Dashboard**
   - Are workers running?
   - Are there error logs?
   - Is D1 database responding?

4. **Restart Session**
   - Logout and login again
   - Clear browser cache
   - Try in private/incognito window

---

## Final Sign-Off

Before considering deployment complete:

- [ ] Tree renders with all people
- [ ] Can add person
- [ ] Can edit person
- [ ] Can delete person (if admin)
- [ ] Can add relationships
- [ ] Can remove relationships
- [ ] No errors in console
- [ ] No tree_side references anywhere
- [ ] Performance acceptable

🎉 **Ready for production!**
