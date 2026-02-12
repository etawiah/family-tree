# Family Chart Configuration

Use this document to configure the family-tree-app baseline before starting fresh. Fill in your choices under each question, then use the **Build Prompt** section with your answers.

---

## 1. Person Fields

**Required by family-chart:** `id`, `data.gender` (M/F)

**List the fields you want (edit/add/remove as needed):**

| Field | Include? | Notes |
|-------|----------|-------|
| first name | ☐ Yes  | |
| last name | ☐ Yes  | |
| gender | ☐ Yes  | Required by library |
| birthday | ☐ Yes  | |
| deathday | ☐ Yes  | |
| location | ☐ Yes  | |
| profession | ☐ Yes  | |
| notes | ☐ Yes  | |
| photo | ☐ Yes  | Alternative to avatar |


**Your final field list:** `_________________________________________________________`

---

## 2. Orientation

| Option | Select |
|--------|--------|
| Vertical (ancestors up, descendants down) | ☐ |


**Your choice:** `_________________________________________________________`

---

## 3. Card Display

Each inner array = one row on the card. Example: `[["first name","last name"],["birthday"]]`

**Fields for row 1:** `____________first name, last name____________________________________`  
**Fields for row 2:** `__location______________________________________________________`  
**Fields for row 3:** `_______birthday - deathday____________________________________________` (optional)

**Show avatar/photo on card?** ☐ Yes  
**If yes, which field?** `_________photo field formerly avatar________________________________________________`

**Your setCardDisplay value:** `______________________I dont understand this prompt___________________________________`

---

## 4. Click Behavior

| Option | Select |
|--------|--------|

| Info only (click card → info view; edit via pencil) | ☐ |


**Your choice:** `_________info only, click for info, edit via pencil________________________________________________`

---

## 5. Permissions

| Option | Select |
|--------|--------|
| Same for everyone (all can edit) | ☐ |


**Your choice:** `_________________________________________________________`  
**If role-based, how is role determined?** `________________everyone can edit_________________________________________`

---

## 6. Persistence

| Option | Select |
|--------|--------|
| On every change (save immediately) | ☐ |


**Your choice:** `_________________________________________________________`  
**If API, endpoint:** `_________________________________________________________`  
**If debounced, delay (ms):** `_________________________________________________________`

---

## Your Answers Summary

*(Fill this in after completing the questions above)*

| # | Question | Your Answer |
|---|----------|-------------|
| 1 | Person fields | |
| 2 | Orientation | |
| 3 | Card display | |
| 4 | Click behavior | |
| 5 | Permissions | |
| 6 | Persistence | |

---

## Build Prompt

Copy the prompt below into Agent mode. Replace the placeholders with your answers from above.

**When the prompt is done executing, you should be able to open the public web URL and see the finished product.**

```
Fresh family-tree-app: family-chart baseline, end-to-end (archive → build → deploy → live)

=== PHASE 1: ARCHIVE (preserve local contents before destructive changes) ===

1. Stage and commit ALL local changes (including modified, new, deleted files). If nothing to commit, ensure working tree is clean.

2. Create branch archive/pre-family-chart-reset from current HEAD.

3. Push archive/pre-family-chart-reset to origin. This preserves the current codebase remotely.

4. Switch back to main. Confirm you are on main before proceeding.

=== PHASE 2: RESET & BUILD ===

5. Delete everything except .git (and optionally .gitignore). Do NOT delete .git.

6. Create a minimal Vite + React app with family-chart: npm create vite@latest . -- --template react (or equivalent), then npm install family-chart.

7. Implement the tree per configuration below. Ensure package.json has: "build": "vite build" and outputs to dist/.

8. Container: div with class "f3", display flex, explicit height (100% or 900px). Do NOT use overflow:hidden on the f3 container (it clips the EditTree form panel).

9. Chart configuration:
   - Orientation: [YOUR ANSWER FROM Q2]
   - setCardXSpacing(250), setCardYSpacing(150)
   - setTransitionTime(1000)

10. Cards: setCardHtml(), setCardDisplay([YOUR ANSWER FROM Q3])
    [If avatar: setCardImageField("YOUR_FIELD")]

11. EditTree (if not view-only):
    - setFields([YOUR ANSWER FROM Q1 - field list])
    - setEditFirst([true if Edit form, false if Info only])
    - setCardClickOpen(f3Card)
    - setCanEdit, setCanAdd, setCanDelete: pass functions, e.g. () => canEdit
    [If role-based: wire to auth/role check]

12. Persistence: setOnChange([YOUR ANSWER FROM Q6 - describe: API call, localStorage, debounced, or omit for no persistence])

13. Include family-chart CSS. Single tree view page. Minimal UI (header + tree).

14. Data: Start with static sample JSON in family-chart format. Structure ready for API swap later.

15. Follow the configuration in docs/FAMILY_CHART_CONFIG.md (this document).

=== PHASE 3: DEPLOY TO CLOUDFLARE ===

16. Create or update .github/workflows/deploy.yml to deploy ONLY Cloudflare Pages (no Worker for baseline). Use cloudflare/pages-action: build frontend (npm run build), deploy dist/ to Pages project "family-tree" (or your Pages project name), with apiToken and accountId from GitHub Secrets.

17. Verify the workflow deploys on push to main. Add public/_redirects or configure SPA routing if needed (e.g. /* /index.html 200).

18. Commit all changes and push to main. The GitHub Actions workflow will deploy to Cloudflare Pages.

19. Confirm the public URL works: https://family-tree.pages.dev (or your custom domain, e.g. https://family-tree.tawiah.net). The user must be able to open the URL and see the family tree.

=== SUCCESS CRITERIA ===

- Archive branch exists on origin with pre-reset code
- Main has minimal Vite + React + family-chart app
- npm run build produces dist/ successfully
- Push to main triggers deploy
- Public web URL loads the family tree
```

---

## Filled Example

*(Example of a completed configuration for reference)*

| # | Question | Example Answer |
|---|----------|----------------|
| 1 | Person fields | first name, last name, gender, birthday, deathday, location, profession, notes, avatar |
| 2 | Orientation | Vertical |
| 3 | Card display | [["first name","last name"],["birthday"]], avatar field |
| 4 | Click behavior | Edit form |
| 5 | Permissions | Role-based (canEdit from auth) |
| 6 | Persistence | API (POST /api/tree/family-chart), debounced 500ms |
