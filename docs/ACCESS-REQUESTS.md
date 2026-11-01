# Access-request Worker deploy checklist

This is a **new, separate Worker** (`family-tree-access-requests` in `access-requests/`). It is **not** deployed by the existing `Deploy to Cloudflare` GitHub Action, and this document does not deploy or set production secrets. Do that by hand after merge.

Visitors request access on a **public** path. Eugene approves or denies from Telegram. Approved emails are added to a Cloudflare Access group so the visitor can sign in at https://family-tree.tawiah.net with Cloudflare’s email one-time PIN. There is no edit-permission step: anyone who can sign in gets the same access the app already gives signed-in users.

## Why `/request-access*` must bypass Access

The Access login page is what a blocked visitor sees. That page is hosted by Cloudflare and cannot link to an in-app route. The request form must live on a path that **does not require Access**:

- Public (Bypass): `https://family-tree.tawiah.net/request-access*`
- Still behind the main Access app: `https://family-tree.tawiah.net/access-admin*`
- Existing API Worker is unchanged: `https://family-tree.tawiah.net/api/*` → `family-tree-app`

Send people the public URL: https://family-tree.tawiah.net/request-access

## Storage and bindings

### D1 (`DB`)

Stores **only**: `id`, `name`, `email`, `status` (`pending` | `approved`), `created_at`.

- Denied requests are deleted immediately.
- Approved rows are deleted after 30 days (daily cron `0 3 * * *`). The Access group membership is left as-is.
- **No IP addresses** (or other requester metadata) are written.

```bash
cd access-requests
npx wrangler d1 create family-tree-access-requests
# paste the returned database_id into wrangler.toml (replace the placeholder UUID)
npx wrangler d1 execute family-tree-access-requests --remote --file=./schema.sql
```

### Rate limiting (`SUBMIT_RATE_LIMITER`)

Workers Rate Limiting binding in `wrangler.toml`:

| Field | Value |
| --- | --- |
| Binding name | `SUBMIT_RATE_LIMITER` |
| `namespace_id` | `271101` (unique on the account; change if it collides) |
| Limit | 5 calls per 60 seconds, per Cloudflare location |
| Key | `CF-Connecting-IP` passed only to `limit({ key })` |

The IP is **not** stored in D1, logs, Telegram, or the Access group. Requires Wrangler **≥ 4.36**.

## Secrets and vars

Set secrets from `access-requests/` with `npx wrangler secret put <NAME>` (or Workers → **family-tree-access-requests** → Settings → Variables and Secrets). Never commit values.

### Secrets

| Secret | Purpose |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile siteverify |
| `TELEGRAM_BOT_TOKEN` | Bot API token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Chat (or group) that receives Approve/Deny messages |
| `ACTION_SIGNING_KEY` | HMAC key for approve/deny URL signatures (`openssl rand -hex 32`) |
| `CF_API_TOKEN` | Scoped token that can **edit Access groups** (see below) |

### Vars (non-secret)

| Var | Purpose |
| --- | --- |
| `TURNSTILE_SITE_KEY` | Public Turnstile widget site key |
| `ACCESS_TEAM_DOMAIN` | Team domain, e.g. `https://<team>.cloudflareaccess.com` |
| `ACCESS_AUD` | Application Audience (AUD) tag of the **main** family-tree Access app |
| `ADMIN_EMAILS` | Comma-separated admin emails and/or `@domain` entries. `@eugenetawiah.com` matches any address at that exact domain (case-insensitive), not subdomains. Example: `eugene@gmail.com,@eugenetawiah.com` |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `ACCESS_GROUP_ID` | UUID of the Access group that approved visitors are added to |
| `PUBLIC_ORIGIN` | `https://family-tree.tawiah.net` (used to build Telegram URL buttons) |

`wrangler.toml` already lists the vars as empty placeholders. After the first deploy, either fill them in the dashboard or use `wrangler deploy --keep-vars` so later deploys do not blank them.

## Create the scoped Access Groups API token

This token is used **by the Worker at runtime** (not by GitHub Actions).

1. Open [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Create Custom Token**.
2. Permissions:
   - **Account** → **Access: Organizations, Identity Providers, and Groups** → **Edit**
3. Account Resources: **Include** → this account only.
4. No zone or Workers permissions are required for this token.
5. Create the token, copy it once, and store it as Worker secret `CF_API_TOKEN`.

Do **not** reuse the GitHub `CLOUDFLARE_API_TOKEN` unless you are sure you want deploy rights and Access-group edit on the same token.

## Cloudflare Access apps and policies

### 1. Access group for approved visitors

Zero Trust → **Access** → **Access groups** → create a group (for example `family-tree-approved`). Copy its Group ID into `ACCESS_GROUP_ID`.

The Worker updates this group with GET then PUT of the `include` list. It adds `{ "email": { "email": "<address>" } }` rules and dedupes. Other include/exclude/require rules are preserved.

### 2. Main app (keep `/access-admin*` here)

The existing Access application on `family-tree.tawiah.net` stays in place. `/access-admin*` is **not** given a Bypass policy.

Update the main app’s Allow policy so signed-in visitors can use the tree:

- Include Eugene’s emails **or**
- Include the Access group from step 1

`/access-admin*` is therefore reachable by anyone who can sign in. The Worker still verifies `Cf-Access-Jwt-Assertion` against the team certs (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`) and requires the JWT email to be in `ADMIN_EMAILS`. That is the admin-only control.

Optional extra lock: a path-specific Access app on `/access-admin*` that Allows only Eugene. Not required.

### 3. Bypass app for `/request-access*`

Create a **separate** Access application whose path is more specific than the hostname-wide app:

| Field | Value |
| --- | --- |
| Application | `family-tree.tawiah.net` |
| Path | `/request-access` (covers `/request-access` and `/request-access/submit`) |
| Policy | **Bypass** → Include → **Everyone** |

Until this Bypass app exists, visitors never see the form: Access shows the email OTP login instead.

Identity: **One-time PIN** (email) is already the account’s only IdP. No IdP change is needed. Approved users get a code at the address Eugene approved.

## Turnstile widget

An existing Turnstile widget named **family-tree** may be reused (same site key and secret). To create a new one instead:

1. Cloudflare dashboard → **Turnstile** → Add widget.
2. Hostname: `family-tree.tawiah.net` (add `localhost` only if you local-dev the form).
3. Mode: Managed or Non-interactive.
4. Site key → var `TURNSTILE_SITE_KEY`.
5. Secret key → secret `TURNSTILE_SECRET_KEY`.

The public page embeds the widget. `POST /request-access/submit` calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Invalid tokens, validation failures, duplicates, and rate limits all return the same generic thank-you page.

## Telegram bot

1. Create a bot with [@BotFather](https://t.me/BotFather); store the token as `TELEGRAM_BOT_TOKEN`.
2. Send the bot a message from Eugene’s account (or add it to a private group).
3. Call `getUpdates` and copy `chat.id` into `TELEGRAM_CHAT_ID`.
4. Approve/Deny are **URL buttons** (not callback buttons). No Telegram webhook is used.
5. Each URL is `https://family-tree.tawiah.net/access-admin/{approve|deny}?id=...&exp=...&sig=...` (HMAC + 7-day expiry).
6. GET shows a confirm page; POST performs the action so link-preview prefetch cannot approve or deny. Messages are sent with `disable_web_page_preview=true`.

## Worker routes (dashboard)

Do **not** put `routes` in `access-requests/wrangler.toml` (`workers_dev = false`, `preview_urls = false`).

Workers & Pages → **family-tree-access-requests** → Triggers, add:

| Route | Worker |
| --- | --- |
| `family-tree.tawiah.net/request-access*` | `family-tree-access-requests` |
| `family-tree.tawiah.net/access-admin*` | `family-tree-access-requests` |

Leave `family-tree.tawiah.net/api*` on `family-tree-app`.

## Deploy the Worker (manual, after secrets exist)

```bash
cd access-requests
npm install
npm test
npx wrangler deploy
# then wrangler secret put … for each secret if not already set
```

First deploy may fail until `database_id` is a real D1 UUID. Create D1 first.

This repo’s GitHub Action still deploys only `family-tree-app` and Pages. It does **not** deploy this Worker.

## Endpoints

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/request-access` | Public (Bypass) | Name, email, Turnstile |
| POST | `/request-access/submit` | Public (Bypass) | Verify Turnstile, validate, rate-limit, store, Telegram |
| GET | `/access-admin/approve` | Main Access app + JWT/admin/HMAC | Confirm page |
| POST | `/access-admin/approve` | Same | Add email to the Access group (idempotent) |
| GET | `/access-admin/deny` | Same | Confirm page |
| POST | `/access-admin/deny` | Same | Delete the pending row (idempotent) |
| GET | `/access-admin/` | Main Access app + JWT/admin | Pending requests and approved emails |
| POST | `/access-admin/revoke` | Same | Remove email from the group |

## Privacy

- D1 columns are only id, name, email, status, created_at.
- Logs record event names and request ids, not names or emails.
- Requester data is sent only to Telegram and (on approve) the Access group.
- No LLMs. No IP persistence.

## Local tests

```bash
cd access-requests
npm install
npm test
```

Covers HMAC, expiry, email/name validation, Access-group merge/dedupe, and Access JWT checks (generated RS256 keys).
