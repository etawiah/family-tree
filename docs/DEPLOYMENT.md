# Deployment troubleshooting

The GitHub Action **Deploy to Cloudflare** builds the frontend, deploys the Worker, then deploys Pages. If a run fails, open the run and check the **first failed step** and its log.

## Same-origin API and Cloudflare Access

Production is **same origin**: Pages serves https://family-tree.tawiah.net and the Worker handles `family-tree.tawiah.net/api/*`. That route is managed in the Cloudflare dashboard (Workers & Pages → family-tree-app → Triggers), not in `wrangler.toml`, because the CI token cannot edit Workers Routes. Cloudflare Access sits in front of that host. The `workers.dev` URL is off (`workers_dev = false`, `preview_urls = false`) so CI `wrangler deploy` does not re-enable it.

The frontend is built with an empty `VITE_API_URL` and calls relative `/api/...` with cookies, so the Access `CF_Authorization` cookie is sent. An expired Access session shows up as a 302 / opaque redirect or HTML login page; the client reloads to re-auth instead of treating that as JSON.

**pages.dev preview deployments cannot reach the API.** There is no Worker route or Access session on `*.pages.dev`. Use https://family-tree.tawiah.net after signing in.

**R2:** the bucket name `family-tree-photos` is private. Do not treat `family-tree-photos.family-tree.tawiah.net` as a live public host; the client only rewrites leftover stored URLs to `/api/photo/:file`.

## Required secrets

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Where to get it |
|--------|------------------|
| `CLOUDFLARE_API_TOKEN` | See [Create the API token](#create-the-api-token) below. **Must be an API Token, not the old Global API Key.** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any product → right sidebar **Account ID** (32-character hex). |

### Create the API token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**.
2. Use **Edit Cloudflare Workers** template, then click **Customize** (or create a **Custom token**).
3. Set permissions:
   - **Account** → **Cloudflare Workers Scripts** → **Edit**
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **Account Settings** → **Read** (optional, for account ID)
4. Under **Account Resources**, set to **Include** → **Your account** (or the specific account).
5. Create the token and **copy it once** (it is not shown again).
6. In GitHub: **Settings → Secrets and variables → Actions** → **New repository secret** → name `CLOUDFLARE_API_TOKEN`, value = the token.

---

## Common errors and fixes

### "Unable to authenticate request" (code 10001) / "Failed to get Pages project, API returned non-200"

This means the token is rejected by Cloudflare’s API when the Pages action runs.

- **Use an API Token, not the Global API Key.** In [API Tokens](https://dash.cloudflare.com/profile/api-tokens) you create a **Token**; do not use the “Global API Key” from **API Keys** (legacy).
- **Token must have Pages permission.** The token needs **Cloudflare Pages** → **Edit**. Recreate the token with that permission and update the `CLOUDFLARE_API_TOKEN` secret.
- **Token and account must match.** The token must be created for the same account as `CLOUDFLARE_ACCOUNT_ID`. In the token’s “Account Resources”, include the account you use for Workers & Pages.
- **Create a new token.** If the token was created a long time ago or might have been rotated, create a new token with the permissions above and set it as `CLOUDFLARE_API_TOKEN` again.

### "CLOUDFLARE_API_TOKEN is not set" / "CLOUDFLARE_ACCOUNT_ID is not set"
- Add the missing secret under **Settings → Secrets and variables → Actions**.
- Name must be exactly `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (no typos).

### "dist/ missing after build"
- **Build frontend** failed earlier; scroll up in the log to see the real error (e.g. `npm run build` failure).
- Run `npm run build` locally and fix any TypeScript/ESLint errors, then push.

### Worker deploy: "Authentication error" / "Unauthorized"
- Token is wrong or expired. Create a new API token with **Workers Scripts → Edit** and update `CLOUDFLARE_API_TOKEN`.
- Ensure the token is for the same account as `CLOUDFLARE_ACCOUNT_ID`.

### Worker deploy: "No bucket named ..." / R2 error
- The R2 bucket `family-tree-photos` must exist in the same Cloudflare account. Create it in **R2** in the dashboard if needed.

### Worker deploy: routes / "You are missing the workers.routes edit permission"
The CI token can deploy the Worker script but cannot edit Workers Routes. Do **not** put `routes` in `wrangler.toml`; keep `family-tree.tawiah.net/api/*` → **family-tree-app** in the dashboard (**Workers & Pages → family-tree-app → Triggers**). `wrangler.toml` only sets `workers_dev = false` and `preview_urls = false`.

### Worker deploy: other wrangler errors
- Check the full log of the **Deploy Worker** step. If it says "binding" or "config", fix `wrangler.toml` (e.g. bucket name, main file path).

### Pages deploy: "Project not found" / 404
- The Pages project name in Cloudflare must match the workflow. Default is **family-tree** (see `PAGES_PROJECT_NAME` in `.github/workflows/deploy.yml`).
- In Cloudflare: **Workers & Pages → Pages** → create or rename the project to `family-tree`, or change `PAGES_PROJECT_NAME` in the workflow to your project name.

### Pages deploy: "Forbidden" / permission error
- The API token needs **Cloudflare Pages → Edit** permission. Edit the token and add that scope, then update the secret.

### Different errors on different runs (flaky)
- Ensure both secrets are set and valid.
- Use the same Cloudflare account for token and Account ID.
- If npm or network errors appear, re-run the workflow (Actions → Re-run all jobs).

### Tree shows only sample data (single “Eugene Tawiah” entry)

**Data is not wiped.** The tree is stored in D1 and the Worker returns it. The app falls back to sample data when `/api/tree` is not JSON (network error, 404, or HTML).

Common causes after the Access lockdown:

- You are on a **pages.dev** preview. Those builds cannot reach the Access-protected API. Open https://family-tree.tawiah.net after signing in.
- Access session expired. Reload so Cloudflare Access can re-authenticate (`CF_Authorization` cookie).
- The Worker route `family-tree.tawiah.net/api/*` is missing. It is dashboard-managed (the CI token cannot edit routes). Confirm **Workers & Pages → family-tree-app → Triggers**.
- The frontend was built with a stale `VITE_API_URL` pointing at `*.workers.dev` (that hostname is off). The deploy workflow now defaults `VITE_API_URL` to empty so requests stay on `/api/...`. Re-run **Deploy to Cloudflare** and hard-refresh.

**Optional: Check D1**

- **Workers & Pages** → **D1** → **family-tree-db** → **Query**: `SELECT key, length(value) AS value_len, updated_at FROM tree;`
- If you see a row with `key = 'data'` and a large `value_len`, the data is in D1 and the issue is the request path or Access, not a wipe.

**If D1 really has no tree row** (e.g. after running `npm run d1:setup`, which drops the table), restore from a backup against the Access-protected route (the `workers.dev` URL is disabled):

```bash
# Requires a valid Access service token or a CF_Authorization cookie from a signed-in session.
curl -X PUT "https://family-tree.tawiah.net/api/tree" \
  -H "Content-Type: application/json" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -d @your-tree-backup.json
```

Cloudflare D1 also supports [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) (restore to a point in the last 7–30 days) if the table was dropped by mistake.

---

## Deploying without GitHub

**Worker only:**
```bash
npm run worker:deploy
```
(Uses `wrangler`; run `npx wrangler login` once if needed.)

**Pages:** In Cloudflare **Pages → family-tree** → **Create deployment** → upload the `dist` folder (after running `npm run build` locally).

---

## Password gate (optional)

To put the app behind a password and Cloudflare Turnstile (30-day session, access logging):

### 1. Where to set the password

Set the password and other auth values in **Cloudflare Dashboard**:

1. Go to **Workers & Pages** → open the **family-tree-app** Worker.
2. Open **Settings** → **Variables and Secrets**.
3. Under **Encrypted variables (secrets)** add:
   - **`PASSWORD`** – The shared password visitors must enter (e.g. a long random string).
   - **`AUTH_SECRET`** – A random string used to sign the session cookie (e.g. 32+ characters; generate with `openssl rand -hex 32` or similar).
   - **`TURNSTILE_SECRET_KEY`** – From Cloudflare Turnstile (see below).
4. Under **Environment variables** (vars) set:
   - **`PAGES_ORIGIN`** – Your Pages app URL, e.g. `https://family-tree.pages.dev` (no trailing slash).
   - **`TURNSTILE_SITE_KEY`** – Your Turnstile widget **site key** (public).

You can also set secrets from the terminal (after `npx wrangler login`):

```bash
npx wrangler secret put PASSWORD      # paste password when prompted
npx wrangler secret put AUTH_SECRET   # paste a long random string
npx wrangler secret put TURNSTILE_SECRET_KEY
```

### 2. Turnstile

1. In Cloudflare Dashboard go to **Turnstile** (or **Website** → **Turnstile**).
2. Create a widget; choose **Managed** or **Non-interactive**.
3. Copy the **Site key** → set as `TURNSTILE_SITE_KEY` (var).
4. Copy the **Secret key** → set as `TURNSTILE_SECRET_KEY` (secret).

### 3. Access log table

On an existing D1 database, create the `access_log` table once:

```bash
npm run d1:migrate
```

New setups get it automatically from `npm run d1:setup`.

### 4. Route traffic through the Worker

So that the login page and app are served from the same place:

- In **Workers & Pages** → **family-tree-app** → **Settings** → **Triggers** → **Custom Domains**, add your app domain (e.g. `family-tree.tawiah.net`), **or**
- In **Workers & Pages** → **Workers Routes**, add a route: `family-tree.tawiah.net/*` → **family-tree-app**.

Then open the app via that domain (not the raw Pages URL). Visitors see the password page first; after signing in they get a 30-day cookie and can use the app.

### 5. Build for same-origin (required in production)

The frontend must call the API on the same origin so Access cookies are sent. Leave **`VITE_API_URL`** empty (the deploy workflow already defaults to `''`).

- **GitHub Actions:** do not set repo variable `VITE_API_URL` unless you need an override. An empty var is treated as unset by `||`, and the fallback is `''`.
- Local override: `VITE_API_URL=http://localhost:8787 npm run dev` while `npm run worker:dev` is running.
