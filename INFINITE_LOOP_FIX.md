# Infinite Loop Fix - FamilyTreeView Component

## Problem Summary

When you clicked the Tree link after logging in, the app would freeze and fill the browser console with millions of identical error messages, creating a **42MB+ log file** with 1 million+ lines.

**Error Message:**
```
Error initializing family-chart: TypeError: t.getBoundingClientRect is not a function
```

## Root Cause

The infinite loop occurred in `FamilyTreeView.jsx`:

1. Component renders and useEffect tries to initialize family-chart
2. family-chart's initialization code throws an error (getBoundingClientRect)
3. Error is caught in the try/catch block
4. React re-renders the component
5. The useEffect runs again with the same conditions
6. **Same error occurs** → **Infinite loop starts**

The problem: The error was being caught but NOT preventing the effect from running again.

### Code Flow That Creates Loop:

```javascript
useEffect(() => {
  try {
    // This fails with getBoundingClientRect error
    const svg = f3.createSvg(container);  // ERROR!
  } catch (err) {
    // Error is caught but nothing prevents re-render
    showToast(err.message, "error");  // showToast causes re-render
    // No guard to prevent effect from running again
  }
  // Effect runs again → Same error → Loop!
}, [treeData, viewMode, showToast]);
```

## Solution Implemented

### 1. Added Initialization Guards

```javascript
const [initError, setInitError] = useState(null);
const initAttemptedRef = useRef(false);
```

- **initError**: Tracks if initialization failed
- **initAttemptedRef**: Prevents multiple attempts with same data

### 2. Early Return on Previous Errors

```javascript
if (initError) {
  console.log("[FamilyTreeView useEffect] Skipping - previous initialization failed");
  return;  // DON'T try again - breaks the loop!
}
```

### 3. Guard Against Multiple Attempts

```javascript
if (initAttemptedRef.current) {
  console.log("[FamilyTreeView useEffect] Already attempted initialization with this data");
  return;
}
initAttemptedRef.current = true;
```

### 4. Reset on New Data

```javascript
useEffect(() => {
  if (treeData.length > 0 && initError) {
    setInitError(null);
    initAttemptedRef.current = false;
    // Now effect will retry if tree data changes
  }
}, [treeData.length, initError]);
```

### 5. Show Error to User

Instead of a blank screen with infinite errors:

```
Error rendering tree visualization: t.getBoundingClientRect is not a function

This may be a temporary issue. Try refreshing the page or logging out and back in.

[Reload Page] button
```

## What Changed

**Before (Broken):**
1. Error occurs during initialization
2. Caught but component keeps retrying
3. Infinite loop → App freezes → 42MB logs

**After (Fixed):**
1. Error occurs during initialization
2. Caught and **initError state is set**
3. Early return prevents effect from running again
4. **User sees clear error message**
5. User can reload or logout/login to retry

## Testing the Fix

After deploying:

1. **Build and deploy:**
   ```bash
   npm run build
   npm run deploy:app
   npm run worker:deploy
   ```

2. **Test the flow:**
   - Login with valid credentials
   - Click the Tree link
   - **If it works:** Tree renders normally
   - **If error occurs:** You'll see a friendly error message instead of infinite loop
   - **If error:** Click "Reload Page" to retry

3. **Check the console:**
   - Should see logs like:
     ```
     [FamilyTreeView useEffect] treeData length: 5 viewMode: descendant
     [FamilyTreeView useEffect] Initializing chart with 5 people
     ```
   - NOT thousands of identical error messages

## Why This Existed Before family-chart

This issue is actually a **pre-existing bug** in how React effects and error handling work together. The family-chart library just exposed it by failing during initialization.

The same loop would happen with any library that throws an error during initialization without proper guards.

## Next Steps

1. **Deploy the fix** (instructions above)
2. **Test on live site** - does Tree now work or show clear error?
3. **If Tree still errors:** The error message will tell us what's wrong (not an infinite loop)
4. **If Tree works:** Proceed with rest of the migration

The key point: **App no longer freezes.** If there's an error, you'll see it clearly and can take action.
