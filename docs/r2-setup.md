# R2 Setup Guide (Photo Storage)

This guide explains how to create a Cloudflare R2 bucket and make images publicly accessible.

## 1. Create an R2 bucket
1. Log in to the Cloudflare dashboard.
2. Click **R2** in the left navigation.
3. Select **Create bucket**.
4. Name it something like `family-tree-photos`.
5. Click **Create bucket** to finish.

**Screenshot description:** The Create bucket button is in the top-right corner of the R2 page.

## 2. Enable public access
1. Open the bucket you just created.
2. Go to **Settings**.
3. Find **Public access** and enable it.
4. Confirm the warning dialog.

**Screenshot description:** The public access toggle is inside the bucket Settings panel.

## 3. Get your public URL pattern
1. Stay inside the bucket settings.
2. Look for the **Public bucket URL** field.
3. Copy the base URL (it usually ends with `.r2.dev`).
4. Save it as `R2_PUBLIC_URL` for your Workers and `VITE_R2_PUBLIC_URL` for the frontend.

**Screenshot description:** The public URL appears near the public access section.

## 4. Bind the bucket to Workers
1. Open your Worker project in Cloudflare.
2. Go to **Settings** → **Variables**.
3. Under **R2 Bucket Bindings**, add a binding named `BUCKET`.
4. Select your R2 bucket.
5. Add a plain text variable named `R2_PUBLIC_URL` with the URL from step 3.

**Screenshot description:** The R2 bucket binding table lists the binding name and bucket.

## 5. Test uploads manually
1. Use the login endpoint to get a JWT token.
2. Send a POST request to `/upload` with a JPEG/PNG/WebP file.
3. Confirm the response returns a public URL.
4. Open the URL in a browser to confirm the image loads.

**Troubleshooting tips:**
- If uploads fail, double-check the `BUCKET` binding.
- If URLs 404, confirm public access is enabled.
- If images look too large, confirm client-side compression is active.
