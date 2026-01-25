# Family Tree App

## Project overview
The Family Tree App helps you record family members, visualize connections, and keep photos and notes in one place. It is designed to be simple to use and easy to grow over time.

## Local setup (first time)
1. Install Node.js (version 18 or higher).
2. Open a terminal in this folder.
3. Install dependencies:
   ```bash
   npm install
   ```

## Environment variables
This app uses a small set of configuration values stored in a local `.env` file.

1. Copy the example file:
   ```bash
   copy .env.example .env
   ```
2. Open `.env` and replace the placeholder values:
   - `VITE_API_URL`: The URL of your Cloudflare Worker API.
   - `VITE_R2_PUBLIC_URL`: The public URL for your image storage.

## Run locally
Start the development server:
```bash
npm run dev
```
Open the URL shown in the terminal (usually `http://localhost:5173/`).

## Deployment (to be completed later)
Deployment steps will be added after the backend and hosting are configured. The goal is to deploy:
- The frontend to Cloudflare Pages.
- The API to Cloudflare Workers.

## Architecture overview
```
Browser (React UI)
        |
        v
Cloudflare Worker API
        |
        v
Database (D1) + File Storage (R2)
```
