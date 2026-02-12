# Family Tree App

Minimal family tree visualization built with [family-chart](https://github.com/donatso/family-chart), React, and Vite.

## Features

- Interactive family tree (vertical layout)
- Click cards for info view; edit via pencil icon
- Add relatives (Father, Mother, Spouse, Son, Daughter)
- Remove relatives
- Link to existing person
- Persistence via localStorage (no backend)

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: `dist/` (for Cloudflare Pages)

## Deploy

Push to `main` to trigger deployment to Cloudflare Pages via GitHub Actions.

Public URL: https://family-tree.pages.dev (or custom domain if configured)
