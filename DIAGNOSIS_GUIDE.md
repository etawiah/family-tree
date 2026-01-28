# Diagnostic Guide: Three Broken Flows

**Goal:** Identify why Add Person, Admin link, and Tree are not working correctly.

## Step 1: Rebuild and Deploy

The debugging logging has been added. You need to rebuild and redeploy:

```bash
npm run build
npm run deploy:app    # Deploy frontend
npm run worker:deploy # Deploy worker
```

## Step 2: Access Your App

1. Go to your live site (e.g., https://your-app.pages.dev)
2. Open **DevTools** (F12 or Ctrl+Shift+I)
3. Go to the **Console** tab

## Step 3: Check Initial State

1. **Login** with your test credentials
2. Look at console output - you should see logs like:
   ```
   [auth.js] getAccessLevel() returning: edit (or admin or view)
   [AppHeader] Rendering - isLoggedIn: true accessLevel: edit
   [AppHeader] Can edit? true
   [AppHeader] Can admin? false
   ```

**CRITICAL INFO:** What does your console show for "accessLevel"?
- Should be: `view`, `edit`, or `admin`
- If `null` or `undefined`: **This is the problem** - access level not being stored

## Step 4: Check Navigation Links in Header

After login, look at the page header:
- Do you see "Add Person" link? (requires edit level)
- Do you see "Admin" link? (requires admin level)
- What does it say in the Role indicator?

**If links don't appear:**
- Your access level is too low
- Check console for: `[AppHeader] Can edit? false` or `[AppHeader] Can admin? false`

**If links appear but clicking does nothing:**
- Check console for `[ProtectedRoute]` logs
- Should show: `[ProtectedRoute] Checking access for requiredLevel: edit` (or admin)

## Step 5: Check Tree Data Loading

1. Click on "Tree" link
2. Look at console for logs like:
   ```
   [FamilyTreeView] Fetching tree from: http://your-api/api/tree/family-chart
   [FamilyTreeView] Token present: true
   [FamilyTreeView] API response status: 200
   [FamilyTreeView] Tree data received: {tree: Array(1)}
   [FamilyTreeView] Tree length: 1
   ```

**If you see status 200 but tree is blank:**
- API is returning data but chart isn't rendering
- Check: `[FamilyTreeView useEffect] treeData length: 0` = data not being received properly

**If you see status 401 or 403:**
- Token is invalid or expired
- Try logout and login again

**If you see network error:**
- API endpoint not responding
- Check worker deployment

## Step 6: Check Add Person Form

1. Click "Add Person" link (if visible)
2. Fill out form
3. Click "Save" button
4. Look at console for:
   ```
   [AddPersonPage] Form submitted with values: {first_name: "...", ...}
   ```

**If form submits:**
- You'll see the log above
- Check for any errors after

**If form doesn't submit:**
- Check if form is actually loaded (should see AddPersonPage component)
- Check browser console for JavaScript errors

## Step 7: Key Diagnostic Questions

Answer these based on what you see in console:

1. **What is your access level?** (show me the console output showing accessLevel value)

2. **What links appear in header?**
   - [ ] Add Person
   - [ ] Admin
   - [ ] Both
   - [ ] Neither

3. **When you click "Add Person", what happens?**
   - [ ] Nothing (no console logs)
   - [ ] Goes to /people/new page (logs show access check)
   - [ ] Redirects to login (logs show `[ProtectedRoute] ... redirecting to /login`)

4. **When tree loads, do you see API logs?**
   - [ ] Yes - what status code? (200, 401, 403, or network error?)
   - [ ] No - tree never tries to fetch

5. **How many people in tree data?**
   - Show me the console log: `[FamilyTreeView] Tree data received: ...`
   - Count the people array length

## Step 8: Most Likely Issues

Based on your answers above, here's what's probably wrong:

### Issue A: Access Level Not Set
**Symptom:** Logs show `accessLevel: null` or `undefined`
**Cause:** Login API not returning access level
**Check:** Look at login response in Network tab
**Fix:** May need to check backend login endpoint response format

### Issue B: Access Level Too Low
**Symptom:** Links don't appear in header, logs show `Can edit? false`
**Cause:** Your user account is set to "view" level only
**Fix:** Need to check Admin page or database to upgrade your access level to "edit" or "admin"

### Issue C: ProtectedRoute Silently Redirecting
**Symptom:** Logs show `[ProtectedRoute] Insufficient access` and redirects to /login
**Cause:** Same as Issue B - access level mismatch
**Fix:** Upgrade user access level

### Issue D: API Not Returning Tree Data
**Symptom:** Logs show status 200 but `Tree length: 0`
**Cause:** Backend /api/tree/family-chart returning empty or wrong format
**Check:** Look at worker logs or test API directly
**Fix:** Debug backend endpoint

### Issue E: Tree Renders But Father Not Visible
**Symptom:** Logs show tree data received with multiple people, but only some appear
**Cause:** Father relationship not set up correctly in database
**Check:** Verify father person exists and relationship is linked
**Fix:** May need to re-add relationships from Admin page

## Step 9: Share Diagnostic Output

Once you've run through steps 1-8, share with me:

1. **Console output** from after login:
   - Copy everything from "auth.js" and "AppHeader" logs

2. **Console output** from after clicking Tree:
   - Copy "FamilyTreeView" logs showing tree data

3. **Console output** from trying Add Person:
   - Show if any logs appear or if nothing happens

4. **Screenshot** of:
   - Header showing role indicator and visible links
   - Console panel with the above logs

This will let me pinpoint exactly what's broken and provide the fix.

## Quick Reference: Expected Console Logs

### After Login (Successful)
```
[auth.js] getAccessLevel() returning: edit
[AppHeader] Rendering - isLoggedIn: true accessLevel: edit
[AppHeader] Can edit? true
[AppHeader] Can admin? false
```

### After Clicking Tree (Successful)
```
[FamilyTreeView] Fetching tree from: http://...
[FamilyTreeView] Token present: true
[FamilyTreeView] API response status: 200
[FamilyTreeView] Tree data received: {tree: Array(5)}
[FamilyTreeView] Tree length: 5
[FamilyTreeView useEffect] treeData length: 5 viewMode: descendant
[FamilyTreeView useEffect] Initializing chart with 5 people
```

### After Clicking Add Person → Save (Successful)
```
[AddPersonPage] Form submitted with values: {first_name: "John", ...}
```

If you don't see these logs (or see different ones), share what you see and I can diagnose the exact issue.
