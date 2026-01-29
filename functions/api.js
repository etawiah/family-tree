import {
  generateToken,
  hashPassword,
  requireAuth,
  verifyPassword,
  verifyToken,
} from "./auth.js";
import { createSnapshot, listSnapshots, restoreSnapshot } from "./snapshots.js";
import { logAction } from "./utils/logger.js";

/**
 * Cloudflare Worker entry point.
 *
 * A Worker is a lightweight, serverless function that runs at Cloudflare's edge.
 * It receives HTTP requests and returns HTTP responses without a traditional server.
 *
 * The `env` parameter contains bindings configured in Cloudflare (like D1, KV,
 * or secrets). We will use `env.DB` as the D1 database binding.
 */
export default {
  /**
   * Handle all incoming HTTP requests.
   *
   * @param {Request} request - Standard Fetch API Request object.
   * @param {Record<string, unknown>} env - Environment bindings injected by Cloudflare.
   * @param {ExecutionContext} ctx - Worker execution context for background tasks.
   * @returns {Promise<Response>} A Fetch API Response.
   */
  async fetch(request, env, ctx) {
    const db = env.DB;
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;
    const origin = request.headers.get("Origin");
    const corsHeaders = buildCorsHeaders(env, origin);

    // Validate that the D1 database binding is available.
    if (!db) {
      return jsonResponse(
        { error: "Database binding not configured. Expected env.DB." },
        500,
        corsHeaders
      );
    }

    // Handle CORS preflight for all API routes.
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Basic health endpoint to confirm the Worker is live.
    if (method === "GET" && path === "/api/health") {
      return jsonResponse(
        {
          message: "Family Tree API is running.",
          timestamp: new Date().toISOString(),
        },
        200,
        corsHeaders
      );
    }

    try {
      // Route matching for endpoints with path parameters.
      const peopleIdMatch = path.match(/^\/api\/people\/(\d+)$/);
      const peopleRestoreMatch = path.match(/^\/api\/people\/(\d+)\/restore$/);
      const snapshotRestoreMatch = path.match(/^\/api\/snapshots\/(\d+)\/restore$/);
      const adminPasswordMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/password$/);

      if (path === "/api/auth/login" && method === "POST") {
        return loginUser(db, request, env);
      }

      if (path === "/api/auth/setup" && method === "POST") {
        return setupInitialUsers(db, request);
      }

      if (path === "/api/auth/verify" && method === "GET") {
        return verifyAuthToken(db, request, env);
      }

      if (path === "/api/snapshots" && method === "GET") {
        const user = await requireAuth("admin")(request, env);
        return getSnapshots(db, user);
      }

      if (path === "/api/snapshots" && method === "POST") {
        const user = await requireAuth("admin")(request, env);
        return createManualSnapshot(db, request, user);
      }

      if (snapshotRestoreMatch && method === "POST") {
        const user = await requireAuth("admin")(request, env);
        const snapshotId = Number(snapshotRestoreMatch[1]);
        return restoreSnapshotEndpoint(db, snapshotId, user);
      }

      if (path === "/api/admin/users" && method === "GET") {
        const user = await requireAuth("admin")(request, env);
        return listUsers(db, user);
      }

      if (adminPasswordMatch && method === "PUT") {
        const user = await requireAuth("admin")(request, env);
        const username = decodeURIComponent(adminPasswordMatch[1]);
        return updateUserPassword(db, request, user, username);
      }

      if (path === "/api/admin/stats" && method === "GET") {
        const user = await requireAuth("admin")(request, env);
        return getAdminStats(db, user);
      }

      if (path === "/api/admin/activity" && method === "GET") {
        const user = await requireAuth("admin")(request, env);
        return getActivityLog(db, user);
      }

      if (path === "/api/admin/people" && method === "GET") {
        const user = await requireAuth("admin")(request, env);
        return getAdminPeople(db, user);
      }

      if (path === "/api/admin/people/bulk-delete" && method === "POST") {
        const user = await requireAuth("admin")(request, env);
        return bulkDeletePeople(db, request, user);
      }

      if (peopleRestoreMatch && method === "POST") {
        const user = await requireAuth("admin")(request, env);
        const personId = Number(peopleRestoreMatch[1]);
        return restorePerson(db, personId, user);
      }

      if (peopleIdMatch && method === "DELETE") {
        const user = await requireAuth("admin")(request, env);
        const personId = Number(peopleIdMatch[1]);
        const hardDelete = url.searchParams.get("hard") === "true";
        if (hardDelete) {
          return hardDeletePerson(db, personId, user);
        }
        return softDeletePerson(db, personId, user);
      }

      if (path === "/api/tree/family-chart" && method === "GET") {
        const user = await requireAuth("view")(request, env);
        return getTreeDataForFamilyChart(db, user);
      }

      if (path === "/api/tree/family-chart" && method === "POST") {
        const user = await requireAuth("edit")(request, env);
        return saveFamilyChartTree(db, request, user);
      }

      if (path === "/upload" && method === "POST") {
        const user = await requireAuth("edit")(request, env);
        return handleUpload(request, env, user, db);
      }

      return jsonResponse({ error: "Route not found." }, 404);
    } catch (error) {
      // Log errors for debugging without exposing sensitive data.
      console.error("API error:", error);
      if (error?.name === "AuthError") {
        await logAction(db, "unknown", "auth.failed", {
          path,
          reason: error.message,
        });
        return jsonResponse(
          { error: error.message },
          error.status || 401,
          corsHeaders
        );
      }
      return jsonResponse(
        { error: "Unexpected server error. Please try again later." },
        500,
        corsHeaders
      );
    }
  },

  /**
   * Cron handler for scheduled snapshots.
   *
   * Cron syntax: "0 2 * * *" means daily at 2:00 AM UTC.
   */
  async scheduled(event, env, ctx) {
    if (!env.DB) {
      return;
    }
    ctx.waitUntil(createSnapshot(env.DB, "auto"));
  },
};

const loginAttemptsByIp = new Map();

/**
 * Clean up old login attempts to keep memory usage in check.
 *
 * @param {number[]} attempts
 * @param {number} windowMs
 * @returns {number[]}
 */
function pruneAttempts(attempts, windowMs) {
  const now = Date.now();
  return attempts.filter((timestamp) => now - timestamp < windowMs);
}

/**
 * Basic in-memory rate limiter (5 attempts / minute / IP).
 * This resets when a Worker instance is recycled, but still deters brute-force attempts.
 *
 * @param {string} ip
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
function rateLimitLogin(ip) {
  const windowMs = 60 * 1000;
  const maxAttempts = 5;
  const attempts = pruneAttempts(loginAttemptsByIp.get(ip) || [], windowMs);
  attempts.push(Date.now());
  loginAttemptsByIp.set(ip, attempts);

  if (attempts.length > maxAttempts) {
    const retryAfter = Math.ceil((windowMs - (Date.now() - attempts[0])) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "unknown"
  );
}

/**
 * POST /api/auth/login
 * Accepts username and password, returns a JWT.
 */
async function loginUser(db, request, env) {
  const ip = getClientIp(request);
  const rateLimit = rateLimitLogin(ip);
  if (!rateLimit.allowed) {
    await logAction(db, "unknown", "auth.login.rate_limit", { ip });
    return jsonResponse(
      { error: "Too many login attempts. Please wait and try again." },
      429
    );
  }

  const body = await parseJson(request);
  if (!body?.username || !body?.password) {
    return jsonResponse({ error: "Username and password are required." }, 400);
  }

  const userStmt = db.prepare(
    `
    SELECT username, password_hash, access_level
    FROM users
    WHERE username = ?
  `
  );
  const user = await userStmt.bind(body.username).first();
  if (!user) {
    await logAction(db, body.username || "unknown", "auth.login.failed", {
      ip,
      reason: "user_not_found",
    });
    return jsonResponse({ error: "Invalid credentials." }, 401);
  }

  const isValid = await verifyPassword(body.password, user.password_hash);
  if (!isValid) {
    await logAction(db, user.username, "auth.login.failed", {
      ip,
      reason: "invalid_password",
    });
    return jsonResponse({ error: "Invalid credentials." }, 401);
  }

  if (!env.JWT_SECRET) {
    return jsonResponse({ error: "JWT_SECRET is not configured." }, 500);
  }

  const token = await generateToken(
    user.username,
    user.access_level,
    env.JWT_SECRET
  );
  console.log("[api.js] User logged in:", { username: user.username, accessLevel: user.access_level });
  console.log("[api.js] Login response will return:", { token: token.substring(0, 20) + "...", accessLevel: user.access_level });
  await logAction(db, user.username, "auth.login.success", {
    accessLevel: user.access_level,
  });

  return jsonResponse({ token, accessLevel: user.access_level });
}

/**
 * POST /api/auth/setup
 * Creates initial users (view/edit/admin) once, then should be disabled.
 */
async function setupInitialUsers(db, request) {
  const body = await parseJson(request);

  // Expect exactly three user entries for view/edit/admin roles.
  const users = body?.users;
  if (!Array.isArray(users) || users.length !== 3) {
    return jsonResponse(
      { error: "Expected an array of three users (view/edit/admin)." },
      400
    );
  }

  const countStmt = db.prepare("SELECT COUNT(*) AS count FROM users");
  const countResult = await countStmt.first();
  if (countResult?.count > 0) {
    return jsonResponse(
      { error: "Setup already completed. Remove this endpoint afterward." },
      409
    );
  }

  const insertStmt = db.prepare(
    `
    INSERT INTO users (username, password_hash, access_level, created_at)
    VALUES (?, ?, ?, ?)
  `
  );

  for (const user of users) {
    if (!user?.username || !user?.password || !user?.access_level) {
      return jsonResponse(
        { error: "Each user must include username, password, access_level." },
        400
      );
    }
    const passwordHash = await hashPassword(user.password);
    await insertStmt
      .bind(
        user.username,
        passwordHash,
        user.access_level,
        new Date().toISOString()
      )
      .run();
  }

  console.log("Initial users created.");
  await logAction(db, "system", "auth.setup", { count: users.length });
  return jsonResponse({ message: "Initial users created successfully." }, 201);
}

/**
 * POST /upload
 * Accepts multipart/form-data with an image file and metadata.
 * Stores the file in R2 and returns a public URL.
 */
async function handleUpload(request, env, user, db) {
  if (!env.BUCKET) {
    await logAction(db, user.username, "upload.failed", {
      reason: "R2_bucket_not_configured",
    });
    return jsonResponse(
      { error: "Photo upload not configured. R2 bucket is missing." },
      503
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const personId = sanitizeSegment(formData.get("personId") || "unknown");
  const imageType = sanitizeSegment(formData.get("type") || "image");

  if (!file || typeof file === "string") {
    await logAction(db, user.username, "upload.failed", {
      reason: "missing_file",
    });
    return jsonResponse({ error: "No file provided." }, 400);
  }

  // Enforce a reasonable file size limit for safety (1MB max)
  const maxBytes = 1 * 1024 * 1024;
  if (file.size > maxBytes) {
    await logAction(db, user.username, "upload.failed", {
      reason: "file_too_large",
      size: file.size,
    });
    return jsonResponse(
      { error: "File too large. Max 1MB allowed." },
      413
    );
  }

  // Read file into memory and validate by magic bytes
  const buffer = await file.arrayBuffer();
  const fileType = detectImageType(buffer);
  if (!fileType) {
    await logAction(db, user.username, "upload.failed", {
      reason: "invalid_file_type",
    });
    return jsonResponse(
      { error: "Invalid file type. JPEG, PNG, WebP only." },
      415
    );
  }

  // Generate filename: username-personId-timestamp-type.ext
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${user.username}-${personId}-${timestamp}-${imageType}.${fileType}`;

  try {
    await env.BUCKET.put(filename, buffer, {
      httpMetadata: { contentType: `image/${fileType}` },
    });
  } catch (error) {
    console.error("R2 upload failed:", error);
    await logAction(db, user.username, "upload.failed", {
      reason: "r2_error",
      error: error.message,
    });
    return jsonResponse(
      { error: "Upload failed. Please try again." },
      502
    );
  }

  // Return public URL
  const R2_PUBLIC_URL = env.R2_PUBLIC_URL || "";
  const publicUrl = R2_PUBLIC_URL
    ? new URL(filename, ensureTrailingSlash(R2_PUBLIC_URL)).toString()
    : filename;

  await logAction(db, user.username, "upload.success", {
    filename,
    personId,
    imageType,
  });

  return jsonResponse({ url: publicUrl, filename }, 200);
}

/**
 * Detect image file type by magic bytes (not just extension).
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

/**
 * GET /api/auth/verify
 * Returns token info without sensitive data.
 */
async function verifyAuthToken(db, request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    await logAction(db, "unknown", "auth.verify.failed", { reason: "missing_token" });
    return jsonResponse({ error: "Missing Authorization header." }, 401);
  }

  if (!env.JWT_SECRET) {
    return jsonResponse({ error: "JWT_SECRET is not configured." }, 500);
  }

  try {
    const user = await verifyToken(token, env.JWT_SECRET);
    await logAction(db, user.username, "auth.verify.success", {});
    return jsonResponse({ username: user.username, accessLevel: user.accessLevel });
  } catch (error) {
    await logAction(db, "unknown", "auth.verify.failed", { reason: "invalid_token" });
    return jsonResponse({ error: "Invalid or expired token." }, 401);
  }
}

/**
 * Parse JSON body safely with a friendly error message.
 *
 * @param {Request} request
 * @returns {Promise<any>}
 */
async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

/**
 * Standard JSON response helper.
 *
 * @param {Record<string, unknown>} body
 * @param {number} status
 * @returns {Response}
 */
function jsonResponse(body, status = 200, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    // Default to wildcard CORS so all API responses are accessible.
    // Specific origins can still override via extraHeaders.
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

/**
 * Build CORS headers for the current request origin.
 *
 * Configure allowed origins via env.CORS_ORIGINS (comma-separated).
 * If unset, default to allowing the main Pages domains.
 */
function buildCorsHeaders(env, origin) {
  const configured =
    env.CORS_ORIGINS?.split(",").map((value) => value.trim()) || [];
  const defaultOrigins = [
    "https://family-tree.tawiah.net",
    "https://family-tree-a6g.pages.dev",
    "https://family-tree-app.pages.dev",
    "http://localhost:5173",
    "http://localhost:5174",
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

/**
 * GET /api/admin/people
 * Admin-only endpoint that returns ALL people including soft-deleted.
 */
async function getAdminPeople(db, user) {
  const stmt = db.prepare(
    `
    SELECT *
    FROM people
    ORDER BY is_deleted ASC, last_name, first_name
  `
  );
  const result = await stmt.all();
  console.log("Fetched admin people list (including soft-deleted):", {
    count: result.results.length,
  });
  await logAction(db, user.username, "admin.people.list", {
    count: result.results.length,
  });
  return jsonResponse({ people: result.results });
}

/**
 * DELETE /api/people/:id
 * Soft delete keeps historical data while hiding records from the UI.
 */
async function softDeletePerson(db, personId, user) {
  if (!Number.isInteger(personId)) {
    return jsonResponse({ error: "Invalid person id." }, 400);
  }

  const stmt = db.prepare(
    `
    UPDATE people
    SET is_deleted = 1, updated_at = ?
    WHERE id = ? AND is_deleted = 0
  `
  );
  const result = await stmt.bind(new Date().toISOString(), personId).run();
  if (result.changes === 0) {
    return jsonResponse({ error: "Person not found." }, 404);
  }

  console.log("Soft deleted person:", { personId });
  await logAction(db, user.username, "people.delete", { personId });
  return jsonResponse({ id: personId });
}

/**
 * DELETE /api/people/:id?hard=true
 * Hard delete permanently removes the person and their relationships.
 * Admin only.
 */
async function hardDeletePerson(db, personId, user) {
  if (!Number.isInteger(personId)) {
    return jsonResponse({ error: "Invalid person id." }, 400);
  }

  // Delete relationships first (both directions)
  const deleteRelationships = db.prepare(
    `DELETE FROM relationships WHERE person_id = ? OR related_person_id = ?`
  );
  await deleteRelationships.bind(personId, personId).run();

  // Then delete the person
  const stmt = db.prepare(`DELETE FROM people WHERE id = ?`);
  const result = await stmt.bind(personId).run();
  if (result.changes === 0) {
    return jsonResponse({ error: "Person not found." }, 404);
  }

  console.log("Hard deleted person:", { personId });
  await logAction(db, user.username, "people.hard_delete", { personId });
  return jsonResponse({ id: personId, hardDeleted: true });
}

/**
 * POST /api/people/:id/restore
 * Restores a soft-deleted person (sets is_deleted = 0).
 * Admin only.
 */
async function restorePerson(db, personId, user) {
  if (!Number.isInteger(personId)) {
    return jsonResponse({ error: "Invalid person id." }, 400);
  }

  const stmt = db.prepare(
    `
    UPDATE people
    SET is_deleted = 0, updated_at = ?
    WHERE id = ?
  `
  );
  const result = await stmt.bind(new Date().toISOString(), personId).run();
  if (result.changes === 0) {
    return jsonResponse({ error: "Person not found or already active." }, 404);
  }

  // Fetch the restored person to return full object
  const restored = await db
    .prepare("SELECT * FROM people WHERE id = ?")
    .bind(personId)
    .first();

  console.log("Restored person:", { personId });
  await logAction(db, user.username, "people.restore", { personId });
  return jsonResponse({ person: restored });
}

/**
 * POST /api/admin/people/bulk-delete
 * Bulk delete multiple people (soft or hard delete).
 * Admin only.
 */
async function bulkDeletePeople(db, request, user) {
  const body = await parseJson(request);
  const { person_ids, hard = false } = body;

  if (!Array.isArray(person_ids) || person_ids.length === 0) {
    return jsonResponse(
      { error: "person_ids must be a non-empty array." },
      400
    );
  }

  // Validate all IDs are integers
  const validIds = person_ids.filter((id) => Number.isInteger(Number(id)));
  if (validIds.length !== person_ids.length) {
    return jsonResponse({ error: "All person_ids must be valid integers." }, 400);
  }

  const deleted = [];
  const failed = [];

  if (hard) {
    // Hard delete: Remove from database permanently
    for (const personId of validIds) {
      try {
        // Delete relationships first
        const deleteRelationships = db.prepare(
          `DELETE FROM relationships WHERE person_id = ? OR related_person_id = ?`
        );
        await deleteRelationships.bind(personId, personId).run();

        // Delete the person
        const stmt = db.prepare(`DELETE FROM people WHERE id = ?`);
        const result = await stmt.bind(personId).run();
        if (result.changes > 0) {
          deleted.push(personId);
          await logAction(db, user.username, "people.hard_delete", { personId });
        } else {
          failed.push({ personId, error: "Person not found." });
        }
      } catch (err) {
        failed.push({ personId, error: err.message || "Delete failed." });
      }
    }
  } else {
    // Soft delete: Set is_deleted = 1
    const timestamp = new Date().toISOString();
    for (const personId of validIds) {
      try {
        const stmt = db.prepare(
          `
          UPDATE people
          SET is_deleted = 1, updated_at = ?
          WHERE id = ? AND is_deleted = 0
        `
        );
        const result = await stmt.bind(timestamp, personId).run();
        if (result.changes > 0) {
          deleted.push(personId);
          await logAction(db, user.username, "people.delete", { personId });
        } else {
          failed.push({ personId, error: "Person not found or already deleted." });
        }
      } catch (err) {
        failed.push({ personId, error: err.message || "Delete failed." });
      }
    }
  }

  console.log("Bulk delete completed:", {
    hard,
    deleted: deleted.length,
    failed: failed.length,
  });

  return jsonResponse({
    deleted,
    failed,
    summary: {
      total: validIds.length,
      deleted: deleted.length,
      failed: failed.length,
    },
  });
}

/**
 * GET /api/relationships?tree_side=maternal|paternal
 */
/**
 * GET /api/tree/family-chart
 * Returns tree data in family-chart library format
 *
 * Format:
 * [
 *   {
 *     id: "1",
 *     data: {first_name, last_name, gender, birthday, ..., ancestry: "maternal|paternal|both|unknown"},
 *     rels: {spouses: ["2"], children: ["3","4"], parents: ["5"]}
 *   },
 *   ...
 * ]
 */
async function getTreeDataForFamilyChart(db, user) {
  try {
    // Fetch all people (no tree_side filtering)
    const peopleStmt = db.prepare(`
      SELECT
        id, first_name, middle_name, last_name, gender,
        birth_date, death_date, is_alive,
        current_location, profession, personal_notes,
        headshot_url, additional_photo_url,
        tree_side, created_at
      FROM people
      WHERE is_deleted = 0
      ORDER BY created_at ASC
    `);
    const peopleResult = await peopleStmt.all();
    const people = peopleResult.results || [];

    // Fetch all relationships (no tree_side filtering)
    const relationshipsStmt = db.prepare(`
      SELECT
        id, person_id, related_person_id, relationship_type,
        is_blood_relation, marriage_date, divorce_date, relationship_order
      FROM relationships
      ORDER BY person_id, relationship_type
    `);
    const relationshipsResult = await relationshipsStmt.all();
    const relationships = relationshipsResult.results || [];

    // Build relationship index
    const relIndex = {};
    for (const rel of relationships) {
      if (!relIndex[rel.person_id]) {
        relIndex[rel.person_id] = { spouses: [], children: [], parents: [] };
      }

      // Map relationship types to family-chart categories
      if (rel.relationship_type === 'spouse' || rel.relationship_type === 'ex-spouse') {
        relIndex[rel.person_id].spouses.push({
          id: String(rel.related_person_id),
          marriage_date: rel.marriage_date,
          divorce_date: rel.divorce_date,
          order: rel.relationship_order,
        });
      } else if (rel.relationship_type === 'child') {
        relIndex[rel.person_id].children.push(String(rel.related_person_id));
      } else if (rel.relationship_type === 'parent') {
        relIndex[rel.person_id].parents.push(String(rel.related_person_id));
      }
    }

    const normalizeGender = (value) => {
      if (!value) return "M";
      const normalized = String(value).trim().toLowerCase();
      if (normalized === "m" || normalized === "male") return "M";
      if (normalized === "f" || normalized === "female") return "F";
      return "M";
    };

    const treeData = people.map((person) => {
      const rels = relIndex[person.id] || { spouses: [], children: [], parents: [] };
      const spouses = [...new Set(rels.spouses.map((s) => s.id))];
      const children = [...new Set(rels.children)];
      const parents = [...new Set(rels.parents)];

      return {
        id: String(person.id),
        data: {
          "first name": person.first_name || "",
          "middle name": person.middle_name || "",
          "last name": person.last_name || "",
          "gender": normalizeGender(person.gender),
          "gender_label": person.gender || "",
          "birthday": person.birth_date || "",
          "deathday": person.death_date || "",
          "is_alive": person.is_alive ? 1 : 0,
          "location": person.current_location || "",
          "profession": person.profession || "",
          "notes": person.personal_notes || "",
          "photo": person.headshot_url || "",
          "additional_photo": person.additional_photo_url || "",
        },
        rels: {
          spouses,
          children,
          parents,
        },
      };
    });

    console.log('Built family-chart tree data:', {
      people: treeData.length,
    });
    await logAction(db, user.username, 'tree.family-chart', {
      people: treeData.length,
    });

    return jsonResponse({ tree: treeData });
  } catch (error) {
    console.error('Error fetching family-chart tree:', error);
    return jsonResponse({ error: 'Failed to fetch tree data' }, 500);
  }
}

/**
 * POST /api/tree/family-chart
 * Persists family-chart data by replacing people + relationships.
 */
async function saveFamilyChartTree(db, request, user) {
  const body = await parseJson(request);
  const tree = Array.isArray(body) ? body : body?.tree;

  if (!Array.isArray(tree)) {
    return jsonResponse({ error: "Invalid payload. Expected { tree: [...] }." }, 400);
  }

  const normalizeGender = (value) => {
    if (!value) return "M";
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "m" || normalized === "male") return "M";
    if (normalized === "f" || normalized === "female") return "F";
    return "M";
  };

  const numericIdRegex = /^\d+$/;
  const idMap = new Map();
  const usedIds = new Set();
  let nextId = 1;

  const ensureId = (rawId) => {
    if (rawId === undefined || rawId === null || rawId === "") {
      return null;
    }
    const key = String(rawId);
    if (idMap.has(key)) {
      return idMap.get(key);
    }
    if (numericIdRegex.test(key)) {
      const numeric = Number(key);
      usedIds.add(numeric);
      idMap.set(key, numeric);
      return numeric;
    }
    while (usedIds.has(nextId)) {
      nextId += 1;
    }
    const assigned = nextId;
    nextId += 1;
    usedIds.add(assigned);
    idMap.set(key, assigned);
    return assigned;
  };

  const normalizedPeople = tree
    .map((person) => {
      const personId = ensureId(person?.id);
      if (!personId) return null;
      return {
        id: personId,
        data: person?.data || {},
        rels: person?.rels || {},
      };
    })
    .filter(Boolean);

  const relationshipKeys = new Set();
  const relationships = [];
  const addRelationship = (personId, relatedId, relationship_type, is_blood_relation) => {
    if (!personId || !relatedId || personId === relatedId) return;
    const key = `${personId}:${relatedId}:${relationship_type}`;
    if (relationshipKeys.has(key)) return;
    relationshipKeys.add(key);
    relationships.push({
      personId,
      relatedId,
      relationship_type,
      is_blood_relation,
    });
  };

  const addBidirectional = (personId, relatedId, type, reciprocalType, isBlood) => {
    addRelationship(personId, relatedId, type, isBlood);
    addRelationship(relatedId, personId, reciprocalType, isBlood);
  };

  normalizedPeople.forEach((person) => {
    const rels = person.rels || {};
    const parents = (rels.parents || []).map(ensureId).filter(Boolean);
    const spouses = (rels.spouses || []).map(ensureId).filter(Boolean);
    const children = (rels.children || []).map(ensureId).filter(Boolean);

    parents.forEach((parentId) =>
      addBidirectional(person.id, parentId, "parent", "child", true)
    );
    children.forEach((childId) =>
      addBidirectional(person.id, childId, "child", "parent", true)
    );
    spouses.forEach((spouseId) =>
      addBidirectional(person.id, spouseId, "spouse", "spouse", false)
    );
  });

  await createSnapshot(db, user.username, "family-chart save");

  const now = new Date().toISOString();
  const batch = [
    db.prepare("DELETE FROM relationships"),
    db.prepare("DELETE FROM people"),
  ];

  const insertPerson = `
    INSERT INTO people (
      id,
      tree_side,
      first_name,
      middle_name,
      last_name,
      birth_date,
      death_date,
      is_alive,
      current_location,
      profession,
      personal_notes,
      headshot_url,
      additional_photo_url,
      gender,
      is_deleted,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const person of normalizedPeople) {
    const data = person.data || {};
    const firstName = data["first name"] || "";
    const lastName = data["last name"] || "";

    if (!firstName || !lastName) {
      return jsonResponse(
        { error: "Each person requires a first name and last name." },
        400
      );
    }

    const birthday = data["birthday"] || "";
    const deathday = data["deathday"] || "";
    const isAliveValue =
      data["is_alive"] === 0 || data["is_alive"] === false || deathday ? 0 : 1;

    batch.push(
      db
        .prepare(insertPerson)
        .bind(
          person.id,
          "both",
          firstName,
          data["middle name"] || "",
          lastName,
          birthday || null,
          deathday || null,
          isAliveValue,
          data["location"] || null,
          data["profession"] || null,
          data["notes"] || null,
          data["photo"] || null,
          data["additional_photo"] || null,
          normalizeGender(data["gender"]),
          0,
          now,
          now
        )
    );
  }

  const insertRelationship = `
    INSERT INTO relationships (
      tree_side,
      person_id,
      related_person_id,
      relationship_type,
      is_blood_relation,
      marriage_date,
      divorce_date,
      relationship_order,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  relationships.forEach((rel) => {
    batch.push(
      db
        .prepare(insertRelationship)
        .bind(
          "both",
          rel.personId,
          rel.relatedId,
          rel.relationship_type,
          rel.is_blood_relation ? 1 : 0,
          null,
          null,
          null,
          now
        )
    );
  });

  await db.batch(batch);
  await logAction(db, user.username, "tree.family-chart.save", {
    people: normalizedPeople.length,
    relationships: relationships.length,
  });

  return jsonResponse({
    people: normalizedPeople.length,
    relationships: relationships.length,
  });
}

/**
 * GET /api/snapshots
 * Lists snapshot metadata.
 */
async function getSnapshots(db, user) {
  const snapshots = await listSnapshots(db);
  await logAction(db, user.username, "snapshot.list", {});
  return jsonResponse({ snapshots });
}

/**
 * POST /api/snapshots
 * Creates a manual snapshot with description.
 */
async function createManualSnapshot(db, request, user) {
  const body = await parseJson(request);
  const description = body?.description || "Manual snapshot";
  const snapshotId = await createSnapshot(db, user.username, description);
  return jsonResponse({ id: snapshotId }, 201);
}

/**
 * POST /api/snapshots/:id/restore
 * Restores a snapshot (admin-only).
 */
async function restoreSnapshotEndpoint(db, snapshotId, user) {
  if (!Number.isInteger(snapshotId)) {
    return jsonResponse({ error: "Invalid snapshot id." }, 400);
  }

  await restoreSnapshot(db, snapshotId, user.username);
  return jsonResponse({ message: "Snapshot restored." });
}

/**
 * GET /api/admin/users
 * Returns user list for admin management.
 */
async function listUsers(db, user) {
  const stmt = db.prepare(
    `
    SELECT id, username, access_level, created_at
    FROM users
    ORDER BY created_at DESC
  `
  );
  const result = await stmt.all();
  await logAction(db, user.username, "admin.users.list", {});
  return jsonResponse({ users: result.results });
}

/**
 * PUT /api/admin/users/:username/password
 * Updates user passwords with hashing.
 */
async function updateUserPassword(db, request, user, username) {
  const body = await parseJson(request);
  if (!body?.password) {
    return jsonResponse({ error: "Password is required." }, 400);
  }

  const passwordHash = await hashPassword(body.password);
  const stmt = db.prepare(
    `
    UPDATE users
    SET password_hash = ?
    WHERE username = ?
  `
  );
  const result = await stmt.bind(passwordHash, username).run();
  if (result.changes === 0) {
    return jsonResponse({ error: "User not found." }, 404);
  }

  await logAction(db, user.username, "admin.users.password_reset", {
    targetUser: username,
  });
  return jsonResponse({ message: "Password updated." });
}

/**
 * GET /api/admin/stats
 * Returns basic database statistics.
 */
async function getAdminStats(db, user) {
  const [peopleActive, peopleTotal, peopleDeleted, relationships, relationshipsActive, activity] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM people WHERE is_deleted = 0").first(),
    db.prepare("SELECT COUNT(*) AS count FROM people").first(),
    db.prepare("SELECT COUNT(*) AS count FROM people WHERE is_deleted != 0").first(),
    db.prepare("SELECT COUNT(*) AS count FROM relationships").first(),
    // Count relationships where both people are active (not soft-deleted)
    db.prepare(`
      SELECT COUNT(*) AS count 
      FROM relationships r
      INNER JOIN people p1 ON r.person_id = p1.id AND p1.is_deleted = 0
      INNER JOIN people p2 ON r.related_person_id = p2.id AND p2.is_deleted = 0
    `).first(),
    db.prepare("SELECT COUNT(*) AS count FROM activity_log").first(),
  ]);

  await logAction(db, user.username, "admin.stats.view", {});

  return jsonResponse({
    people: {
      active: peopleActive?.count || 0,
      total: peopleTotal?.count || 0,
      deleted: peopleDeleted?.count || 0,
    },
    relationships: relationships?.count || 0,
    relationshipsActive: relationshipsActive?.count || 0,
    activityEntries: activity?.count || 0,
  });
}

/**
 * GET /api/admin/activity
 * Returns recent activity entries for auditing.
 */
async function getActivityLog(db, user) {
  const stmt = db.prepare(
    `
    SELECT id, user_id, action, details, created_at
    FROM activity_log
    ORDER BY created_at DESC
    LIMIT 100
  `
  );
  const result = await stmt.all();
  await logAction(db, user.username, "admin.activity.view", {});
  return jsonResponse({ activity: result.results });
}

/**
 * Helper: Sanitize filename segment to prevent path traversal.
 * Removes all non-alphanumeric characters except hyphens and underscores.
 */
function sanitizeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Helper: Ensure a URL has a trailing slash.
 */
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
