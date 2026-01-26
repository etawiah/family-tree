# Deployment Guide

This guide walks you through publishing the Family Tree App to GitHub and Cloudflare.

## 1. GitHub setup
1. Create a new public GitHub repository.
2. Commit your project files (do **not** commit `.env`).
3. Push to the `main` branch.

**Include:** source code, `package.json`, `wrangler.toml`, and `/docs`.
**Exclude:** `.env`, `node_modules`, and anything in `.gitignore`.

## 2. Cloudflare setup
1. Create a Cloudflare account (free tier is fine).
2. Create a D1 database named `family-tree-db`.
3. Create an R2 bucket named `family-tree-photos`.
4. Create a Cloudflare Pages project connected to your GitHub repo.
5. Create a Cloudflare API token with Pages + Workers permissions.

## 3. Connect GitHub to Cloudflare
1. In Cloudflare Pages, select your repository.
2. Use these build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Set the environment variables for Pages:
   - `VITE_API_URL`
   - `VITE_R2_PUBLIC_URL`

## 4. Set secrets
You must add secrets in Cloudflare (never in GitHub or code files):

**Required secrets:**
- `JWT_SECRET`

**Non-secret variables:**
- `R2_PUBLIC_URL` (Worker)
- `VITE_API_URL` (frontend)
- `VITE_R2_PUBLIC_URL` (frontend)

To set Worker secrets locally:
```bash
wrangler secret put JWT_SECRET
```

## 5. First deployment checklist
1. Push to GitHub and confirm the Actions workflow runs.
2. Confirm Cloudflare Pages is deployed successfully.
3. Deploy the Worker with `wrangler deploy`.
4. Apply your database schema:
   ```bash
   npx wrangler d1 execute family-tree-db --file=./schema/init.sql
   ```
5. Run the one-time auth setup endpoint to create initial users.
6. Log in and confirm the tree view loads.

## 6. Ongoing updates
1. Make changes locally and test.
2. Commit and push to `main`.
3. GitHub Actions will build and deploy automatically.

## Troubleshooting
- **Pages build fails:** Verify Node 18 and `npm run build` locally.
- **Worker fails to deploy:** Confirm `wrangler.toml` bindings and API token scope.
- **Images 404:** Ensure R2 public access is enabled and `R2_PUBLIC_URL` is correct.
- **Auth errors:** Confirm `JWT_SECRET` is set for the Worker.
