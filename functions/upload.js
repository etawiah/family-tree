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
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    // Verify authentication before allowing uploads.
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      await logAction(env.DB, "unknown", "upload.auth.failed", {
        reason: "missing_token",
      });
      return jsonResponse({ error: "Missing Authorization header." }, 401);
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
      return jsonResponse({ error: "Invalid or expired token." }, 401);
    }

    if (!hasRequiredAccess(user.accessLevel, "edit")) {
      await logAction(env.DB, user.username, "upload.auth.denied", {
        accessLevel: user.accessLevel,
      });
      return jsonResponse({ error: "Insufficient access level." }, 403);
    }

    if (!env.BUCKET) {
      return jsonResponse({ error: "R2 bucket binding is missing (env.BUCKET)." }, 500);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const personId = sanitizeSegment(formData.get("personId") || "unknown");
    const imageType = sanitizeSegment(formData.get("type") || "image");

    if (!file || typeof file === "string") {
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "missing_file",
      });
      return jsonResponse({ error: "No file provided." }, 400);
    }

    // Enforce a reasonable file size limit for safety.
    const maxBytes = 1 * 1024 * 1024;
    if (file.size > maxBytes) {
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "file_too_large",
        size: file.size,
      });
      return jsonResponse({ error: "File too large. Max 1MB allowed." }, 413);
    }

    // Read file into memory once for validation and upload.
    const buffer = await file.arrayBuffer();
    const fileType = detectImageType(buffer);
    if (!fileType) {
      await logAction(env.DB, user.username, "upload.failed", {
        reason: "invalid_file_type",
      });
      return jsonResponse({ error: "Invalid file type. JPEG, PNG, WebP only." }, 415);
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
      return jsonResponse({ error: "R2 upload failed. Try again." }, 502);
    }

    const publicBase = env.R2_PUBLIC_URL || "";
    const publicUrl = publicBase ? new URL(filename, ensureTrailingSlash(publicBase)).toString() : filename;

    await logAction(env.DB, user.username, "upload.success", {
      filename,
      personId,
      imageType,
    });
    return jsonResponse({ url: publicUrl, filename });
  },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
