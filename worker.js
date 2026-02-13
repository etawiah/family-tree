/**
 * Family Tree App Worker
 * - POST /api/upload: upload image to R2, return public URL
 * - CORS for family-tree.tawiah.net and localhost
 * - Optional auth gate: password + Turnstile, 30-day cookie, access log in D1
 *
 * Secrets: R2_PUBLIC_URL; for auth gate: AUTH_SECRET, PASSWORD, TURNSTILE_SECRET_KEY
 * Vars: PAGES_ORIGIN, TURNSTILE_SITE_KEY (when using auth gate)
 */

const MAX_FILE_BYTES = 1024 * 1024; // 1MB
const AUTH_COOKIE_NAME = "family_tree_sess";
const SESSION_DAYS = 30;

function base64UrlEncode(bytes) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return new Uint8Array(sig);
}

async function signCookie(secret, expirySeconds) {
  const payload = String(expirySeconds);
  const sig = await hmacSha256(secret, payload);
  return base64UrlEncode(new TextEncoder().encode(payload)) + "." + base64UrlEncode(sig);
}

async function verifyCookie(cookieHeader, secret) {
  if (!cookieHeader || !secret) return false;
  const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const raw = match[1].trim();
  const dot = raw.indexOf(".");
  if (dot === -1) return false;
  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);
  let payloadStr;
  try {
    payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));
  } catch {
    return false;
  }
  const expiry = parseInt(payloadStr, 10);
  if (Number.isNaN(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const expectedSig = await hmacSha256(secret, payloadStr);
  const gotSig = base64UrlDecode(sigB64);
  if (gotSig.length !== expectedSig.length) return false;
  return crypto.subtle.timingSafeEqual(gotSig, expectedSig);
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  const len = Math.max(x.length, y.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0 && x.length === y.length;
}

function getLoginHtml(siteKey, error) {
  const errMsg = error ? '<p style="color:#dc2626;margin:0 0 0.5rem 0;">Invalid password or captcha. Try again.</p>' : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Family Tree – Sign in</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>body{font-family:system-ui,sans-serif;max-width:320px;margin:2rem auto;padding:1rem;} input{width:100%;padding:0.5rem;margin:0.5rem 0;} button{width:100%;padding:0.6rem;margin-top:0.5rem;cursor:pointer;}</style></head>
<body><h1>Sign in</h1>${errMsg}
<form method="post" action="/auth/login">
<input type="password" name="password" placeholder="Password" required autocomplete="current-password">
<div class="cf-turnstile" data-sitekey="${(siteKey || "").replace(/"/g, "&quot;")}"></div>
<button type="submit">Sign in</button></form></body></html>`;
}
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Magic bytes for image validation
const SIGNATURES = [
  [0xff, 0xd8, 0xff], // JPEG
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0x52, 0x49, 0x46, 0x42], // WebP (RIFF)
];

function detectImageType(buffer) {
  const arr = new Uint8Array(buffer);
  for (const sig of SIGNATURES) {
    if (sig.every((b, i) => arr[i] === b)) {
      if (sig.length === 3) return "image/jpeg";
      if (sig.length === 8) return "image/png";
      if (arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) return "image/webp";
    }
  }
  return null;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

function corsHeaders(origin, allowOrigin) {
  const o = allowOrigin || origin || "*";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function isOriginAllowed(origin, allowedList) {
  if (!origin) return false;
  const list = (allowedList || "").split(",").map((s) => s.trim());
  return list.some((o) => o === origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const allowed = env.CORS_ORIGINS || "";
    const allowOrigin = isOriginAllowed(origin, allowed) ? origin : null;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(origin, allowOrigin || "*") },
      });
    }

    const url = new URL(request.url);
    const authGate =
      env.AUTH_SECRET && env.PASSWORD && env.TURNSTILE_SECRET_KEY && env.PAGES_ORIGIN;

    // POST /auth/login: verify Turnstile + password, log, set cookie, redirect
    if (authGate && request.method === "POST" && url.pathname === "/auth/login") {
      try {
        const contentType = request.headers.get("Content-Type") || "";
        let password = "";
        let turnstileToken = "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
          const body = await request.clone().text();
          const params = new URLSearchParams(body);
          password = params.get("password") || "";
          turnstileToken = params.get("cf-turnstile-response") || "";
        }
        if (!turnstileToken) {
          const html = getLoginHtml(env.TURNSTILE_SITE_KEY, true);
          return new Response(html, { status: 400, headers: { "Content-Type": "text/html;charset=utf-8" } });
        }
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET_KEY,
            response: turnstileToken,
          }),
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyData.success) {
          const html = getLoginHtml(env.TURNSTILE_SITE_KEY, true);
          return new Response(html, { status: 400, headers: { "Content-Type": "text/html;charset=utf-8" } });
        }
        if (!password || !timingSafeEqual(password, env.PASSWORD)) {
          const html = getLoginHtml(env.TURNSTILE_SITE_KEY, true);
          return new Response(html, { status: 401, headers: { "Content-Type": "text/html;charset=utf-8" } });
        }
        const ip = request.headers.get("CF-Connecting-IP") || "";
        const country = request.headers.get("CF-IPCountry") || "";
        const userAgent = request.headers.get("User-Agent") || "";
        const referer = request.headers.get("Referer") || "";
        try {
          await env.DB.prepare(
            "INSERT INTO access_log (ip, country, user_agent, referer) VALUES (?, ?, ?, ?)"
          )
            .bind(ip, country, userAgent, referer)
            .run();
        } catch (e) {
          console.error("access_log insert error:", e);
        }
        const expirySeconds = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
        const cookieValue = await signCookie(env.AUTH_SECRET, expirySeconds);
        const host = url.host;
        const setCookie = `${AUTH_COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
            "Set-Cookie": setCookie,
          },
        });
      } catch (err) {
        console.error("auth/login error:", err);
        const html = getLoginHtml(env.TURNSTILE_SITE_KEY, true);
        return new Response(html, { status: 500, headers: { "Content-Type": "text/html;charset=utf-8" } });
      }
    }

    // When auth gate is on: require valid cookie for /api/* and for app (proxy)
    if (authGate) {
      const cookieHeader = request.headers.get("Cookie");
      const valid = await verifyCookie(cookieHeader, env.AUTH_SECRET);
      if (url.pathname.startsWith("/api/")) {
        if (!valid) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) },
          });
        }
      } else {
        if (!valid) {
          const html = getLoginHtml(env.TURNSTILE_SITE_KEY, false);
          return new Response(html, {
            status: 200,
            headers: { "Content-Type": "text/html;charset=utf-8" },
          });
        }
        const pagesOrigin = (env.PAGES_ORIGIN || "").replace(/\/$/, "");
        const proxyUrl = pagesOrigin + url.pathname + url.search;
        const proxyReq = new Request(proxyUrl, {
          method: request.method,
          headers: request.headers,
          body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
          redirect: "follow",
        });
        const res = await fetch(proxyReq);
        const newHeaders = new Headers(res.headers);
        if (res.status >= 300 && res.status < 400 && newHeaders.get("Location")) {
          const loc = new URL(newHeaders.get("Location"), proxyUrl);
          if (loc.origin === pagesOrigin) {
            newHeaders.set("Location", loc.pathname + loc.search);
          }
        }
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: newHeaders,
        });
      }
    }

    // Tree API (D1): GET returns tree JSON, PUT stores tree JSON
    if (url.pathname === "/api/tree") {
      if (request.method === "GET") {
        try {
          const stmt = env.DB.prepare("SELECT value FROM tree WHERE key = ?").bind("data");
          const row = await stmt.first();
          const value = row ? row.value : "[]";
          let tree;
          try {
            tree = JSON.parse(value);
          } catch {
            tree = [];
          }
          if (!Array.isArray(tree)) tree = [];
          return new Response(JSON.stringify(tree), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) },
          });
        } catch (err) {
          console.error("GET /api/tree error:", err);
          return new Response(JSON.stringify({ error: "Failed to load tree" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) },
          });
        }
      }
      if (request.method === "PUT") {
        try {
          const body = await request.json();
          if (!Array.isArray(body)) {
            return new Response(JSON.stringify({ error: "Body must be an array" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) },
            });
          }
          const value = JSON.stringify(body);
          await env.DB.prepare(
            "INSERT INTO tree (key, value, updated_at) VALUES ('data', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
          ).bind(value).run();
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) },
          });
        } catch (err) {
          console.error("PUT /api/tree error:", err);
          return new Response(JSON.stringify({ error: "Failed to save tree" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) },
          });
        }
      }
    }

    // Serve photo from R2 (bucket is private; this makes images load without R2 public access)
    const photoMatch = url.pathname.match(/^\/api\/photo\/(.+)$/);
    if (request.method === "GET" && photoMatch) {
      const filename = photoMatch[1].replace(/\.\./g, "").split("/")[0];
      if (!filename) {
        return new Response("Not Found", { status: 404, headers: { ...corsHeaders(origin, allowOrigin) } });
      }
      try {
        const object = await env.BUCKET.get(filename);
        if (!object) {
          return new Response("Not Found", { status: 404, headers: { ...corsHeaders(origin, allowOrigin) } });
        }
        const contentType = object.httpMetadata?.contentType || "image/jpeg";
        return new Response(object.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000",
            ...corsHeaders(origin, allowOrigin),
          },
        });
      } catch (err) {
        console.error("Photo get error:", err);
        return new Response("Error", { status: 500, headers: { ...corsHeaders(origin, allowOrigin) } });
      }
    }

    if (request.method === "POST" && (url.pathname === "/api/upload" || url.pathname === "/upload")) {
      try {
        const contentType = request.headers.get("Content-Type") || "";
        let file = null;
        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          file = formData.get("file") ?? formData.get("photo");
        }
        if (!file || typeof file.arrayBuffer !== "function") {
          return new Response(
            JSON.stringify({ error: "Missing file in form (use field 'file' or 'photo')" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) } }
          );
        }

        const buffer = await file.arrayBuffer();
        if (buffer.byteLength > MAX_FILE_BYTES) {
          return new Response(
            JSON.stringify({ error: "File too large (max 1MB)" }),
            { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) } }
          );
        }

        const detectedType = detectImageType(buffer);
        if (!detectedType || !ALLOWED_TYPES[detectedType]) {
          return new Response(
            JSON.stringify({ error: "Invalid image type (JPEG, PNG, WebP only)" }),
            { status: 415, headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) } }
          );
        }

        const ext = ALLOWED_TYPES[detectedType];
        const baseName = sanitizeFilename(file.name || "photo");
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${baseName.slice(0, 20)}.${ext}`;

        await env.BUCKET.put(filename, buffer, {
          httpMetadata: { contentType: detectedType },
        });

        // Return Worker URL so images load without requiring R2 public access
        const base = new URL(request.url).origin;
        const publicUrl = `${base}/api/photo/${filename}`;

        return new Response(
          JSON.stringify({ url: publicUrl, filename }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) } }
        );
      } catch (err) {
        console.error("Upload error:", err);
        return new Response(
          JSON.stringify({ error: "Upload failed" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowOrigin) } }
        );
      }
    }

    return new Response("Not Found", { status: 404, headers: { ...corsHeaders(origin, allowOrigin) } });
  },
};
