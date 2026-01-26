import { verifyToken } from "./auth.js";
import { logAction } from "./utils/logger.js";

/**
 * Separate Worker for file uploads.
 *
 * Uploads involve larger request bodies and binary processing, so a dedicated
 * Worker keeps the main API focused and lets you apply tighter limits.
 */
export default {
  /**
   * POST /upload
   *
   * Accepts multipart/form-data with an image file and metadata.
   * Stores the file in R2 and returns a public URL.
   */
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const corsHeaders = buildCorsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    }

    if (request.method !== "POST" && request.method !== "DELETE") {
      return jsonResponse({ error: "Method not allowed." }, 405, corsHeaders);
    }

    // Verify authentication before allowing uploads or deletes.
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      await logAction(env.DB, "unknown", "upload.auth.failed", {
        reason: "missing_token",
      });
      return jsonResponse(
        { error: "Missing Authorization header." },
        401,
        corsHeaders
      );
    }

    if (!env.JWT_SECRET) {
      return jsonResponse({ error: "JWT_SECRET is not configured." }, 500);
    }

    let user;
    try {
      user = await verifyToken(token, env.JWT_SECRET);
    } catch {
      await logAction(env.DB, "unknown", "upload.auth.failed", {
        reason: "invalid_token",
      });
      return jsonResponse(
        { error: "Invalid or expired token." },
        401,
        corsHeaders
      );
    }

    if (!hasRequiredAccess(user.accessLevel, "edit")) {
      await logAction(env.DB, user.username, "upload.auth.denied", {
        accessLevel: user.accessLevel,
      });
      return jsonResponse(
        { error: "Insufficient access level." },
        403,
        corsHeaders
      );
    }

    if (!env.BUCKET) {
      return jsonResponse(
        { error: "R2 bucket binding is missing (env.BUCKET)." },
        500,
        corsHeaders
      );
    }

    if (request.method === "DELETE") {
      if (!hasRequiredAccess(user.accessLevel, "admin")) {
        await logAction(env.DB, user.username, "upload.delete.denied", {
          accessLevel: user.accessLevel,
        });
        return jsonResponse(
          { error: "Admin access required to delete photos." },
          403,
          corsHeaders
        );
      }

      const url = new URL(request.url);
      const filename = url.searchParams.get("filename");
      const fileUrl = url.searchParams.get("url");
      const resolved = filename || extractFilename(fileUrl);
      if (!resolved) {
        return jsonResponse(
          { error: "Missing filename to delete." },
          400,
          corsHeaders
        );
      }

      await env.BUCKET.delete(resolved);
      await logAction(env.DB, user.username, "upload.delete", {
        filename: resolved,
      });
      return jsonResponse({ deleted: resolved }, 200, corsHeaders);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const personId = sanitizeSegment(formData.get("personId") || "unknown");
    const imageType = sanitizeSegment(formData.get("type") || "image");

    if (!file || typeof file === "string") {
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "missing_file",
      });
      return jsonResponse({ error: "No file provided." }, 400, corsHeaders);
    }

    // Enforce a reasonable file size limit for safety.
    const maxBytes = 1 * 1024 * 1024;
    if (file.size > maxBytes) {
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "file_too_large",
        size: file.size,
      });
      return jsonResponse(
        { error: "File too large. Max 1MB allowed." },
        413,
        corsHeaders
      );
    }

    // Read file into memory once for validation and upload.
    const buffer = await file.arrayBuffer();
    const fileType = detectImageType(buffer);
    if (!fileType) {
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "invalid_file_type",
      });
      return jsonResponse(
        { error: "Invalid file type. JPEG, PNG, WebP only." },
        415,
        corsHeaders
      );
    }

    // Filename: userId-personId-timestamp-type.jpg
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${user.username}-${personId}-${timestamp}-${imageType}.${fileType}`;

    try {
      await env.BUCKET.put(filename, buffer, {
        httpMetadata: { contentType: `image/${fileType}` },
      });
    } catch (error) {
      console.error("R2 upload failed:", error);
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "r2_error",
      });
      return jsonResponse(
        { error: "R2 upload failed. Try again." },
        502,
        corsHeaders
      );
    }

    const publicBase = env.R2_PUBLIC_URL || "";
    const publicUrl = publicBase ? new URL(filename, ensureTrailingSlash(publicBase)).toString() : filename;

    await logAction(env.DB, user.username, "upload.success", {
      filename,
      personId,
      imageType,
    });
    return jsonResponse({ url: publicUrl, filename }, 200, corsHeaders);
  },
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    // Default to wildcard CORS so uploads can be called from the frontend.
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  };

  if (
    headers["Access-Control-Allow-Origin"] !== "*" &&
    !headers.Vary
  ) {
    headers.Vary = "Origin";
  }

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers,
  });
}

function buildCorsHeaders(env, origin) {
  const configured =
    env.CORS_ORIGINS?.split(",").map((value) => value.trim()) || [];
  const defaultOrigins = [
    "https://family-tree.tawiah.net",
    "https://family-tree-a6g.pages.dev",
    "https://family-tree-app.pages.dev",
  ];
  const allowedOrigins = configured.length ? configured : defaultOrigins;

  if (allowedOrigins.includes("*")) {
    return {
      "Access-Control-Allow-Origin": "*",
    };
  }

  if (origin && allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    };
  }

  return {};
}

function hasRequiredAccess(userLevel, requiredLevel) {
  const order = { view: 0, edit: 1, admin: 2 };
  return order[userLevel] >= order[requiredLevel];
}

/**
 * Detect file type by checking magic bytes (not just extension).
 */
function detectImageType(buffer) {
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }

  // WebP: "RIFF"...."WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

function sanitizeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

function extractFilename(value) {
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value);
    const path = parsed.pathname || "";
    return path.split("/").pop() || "";
  } catch {
    return value.split("/").pop() || "";
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
