# Family Tree App

Minimal family tree visualization built with [family-chart](https://github.com/donatso/family-chart), React, and Vite.

## Features

- Interactive family tree (vertical layout)
- Click cards for info view; edit via pencil icon
- Add relatives (Father, Mother, Spouse, Son, Daughter)
- Remove relatives
- Link to existing person

## Architecture

The frontend (Cloudflare Pages) and API (Cloudflare Worker `family-tree-app`) share the same origin:

- **App:** https://family-tree.tawiah.net
- **API:** https://family-tree.tawiah.net/api/* (Worker route)

The Worker is behind **Cloudflare Access** on that host. The `workers.dev` URL (`family-tree-app.eugene-tawiah.workers.dev`) is **disabled**. The frontend calls relative `/api/...` and sends cookies (`credentials: 'same-origin'`) so the `CF_Authorization` Access cookie is included. If Access redirects or returns its login HTML (expired session), the app reloads to re-authenticate.

Visitors who are not on the Access allow list request access at the public path https://family-tree.tawiah.net/request-access (that path must bypass Access). The separate Worker `family-tree-access-requests` pages Eugene on Telegram and, on approve, adds the email to an Access group. See [docs/ACCESS-REQUESTS.md](docs/ACCESS-REQUESTS.md). The existing deploy workflow does not deploy that Worker.

**pages.dev preview builds cannot reach the API.** A `*.pages.dev` origin has no Access session and no Worker route, so `/api/*` will not return tree data. Use the custom domain after signing in through Access.

Photos live in the private R2 bucket `family-tree-photos` and are served at `/api/photo/:filename`. Older rows may still store the retired public hostname `family-tree-photos.family-tree.tawiah.net`; the client rewrites those to the Worker photo URL.

## Run locally

```bash
npm install
npm run dev
```

To hit a local Worker instead of same-origin `/api`:

```bash
cp .env.example .env
# set VITE_API_URL=http://localhost:8787
npm run worker:dev   # separate terminal
npm run dev
```

## Build

```bash
npm run build
```

Output: `dist/` (for Cloudflare Pages). Leave `VITE_API_URL` empty so the build uses relative `/api/...`.

## Deploy

Push to `main` to trigger deployment to Cloudflare Pages and the Worker via GitHub Actions.

Public URL: https://family-tree.tawiah.net

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for secrets, Access, and troubleshooting.
