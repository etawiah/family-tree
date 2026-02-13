/**
 * Family Tree App Worker
 * - POST /api/upload: upload image to R2, return public URL
 * - CORS for family-tree.tawiah.net and localhost
 *
 * Secrets (set in Cloudflare Dashboard): R2_PUBLIC_URL
 */

const MAX_FILE_BYTES = 1024 * 1024; // 1MB
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
