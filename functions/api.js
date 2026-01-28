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
      const relationshipsIdMatch = path.match(/^\/api\/relationships\/(\d+)$/);
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
        return getAdminPeopleByTreeSide(db, url, user);
      }

      if (path === "/api/admin/people/bulk-delete" && method === "POST") {
        const user = await requireAuth("admin")(request, env);
        return bulkDeletePeople(db, request, user);
      }

      if (path === "/api/people" && method === "GET") {
        // Requires VIEW access (auth middleware placeholder).
        const user = await requireAuth("view")(request, env);
        return getPeopleByTreeSide(db, url, user);
      }

      if (peopleIdMatch && method === "GET") {
        const user = await requireAuth("view")(request, env);
        const personId = Number(peopleIdMatch[1]);
        return getPersonById(db, personId, user);
      }

      if (path === "/api/people" && method === "POST") {
        const user = await requireAuth("edit")(request, env);
        return createPerson(db, request, user);
      }

      if (peopleIdMatch && method === "PUT") {
        const user = await requireAuth("edit")(request, env);
        const personId = Number(peopleIdMatch[1]);
        return updatePerson(db, request, personId, user);
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

      if (path === "/api/relationships" && method === "GET") {
        const user = await requireAuth("view")(request, env);
        return getRelationshipsByTreeSide(db, url, user);
      }

      if (path === "/api/relationships" && method === "POST") {
        const user = await requireAuth("edit")(request, env);
        return createRelationship(db, request, user);
      }

      if (relationshipsIdMatch && method === "DELETE") {
        const user = await requireAuth("admin")(request, env);
        const relationshipId = Number(relationshipsIdMatch[1]);
        return deleteRelationship(db, relationshipId, user);
      }

      if (path === "/api/tree" && method === "GET") {
        const user = await requireAuth("view")(request, env);
        return getTreeHierarchy(db, url, user);
      }

      if (path === "/api/tree/family-chart" && method === "GET") {
        const user = await requireAuth("view")(request, env);
        return getTreeDataForFamilyChart(db, user);
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
 * Validate the tree_side query parameter.
 *
 * @param {URL} url
 * @returns {{ ok: boolean, value?: string, error?: string }}
 */
function validateTreeSide(url) {
  const treeSide = url.searchParams.get("tree_side");
  if (!treeSide) {
    return { ok: false, error: "Missing required query param: tree_side." };
  }
  if (treeSide !== "maternal" && treeSide !== "paternal") {
    return {
      ok: false,
      error: "tree_side must be 'maternal' or 'paternal'.",
    };
  }
  return { ok: true, value: treeSide };
}

/**
 * GET /api/people?tree_side=maternal|paternal
 * Returns all people for the specified tree side.
 */
async function getPeopleByTreeSide(db, url, user) {
  const validation = validateTreeSide(url);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  // Query optimized by the tree_side index for fast filtering.
  const stmt = db.prepare(
    `
    SELECT *
    FROM people
    WHERE tree_side = ? AND is_deleted = 0
    ORDER BY last_name, first_name
  `
  );
  const result = await stmt.bind(validation.value).all();
  console.log("Fetched people list:", { treeSide: validation.value });
  await logAction(db, user.username, "people.list", { treeSide: validation.value });
  return jsonResponse({ people: result.results });
}

/**
 * GET /api/admin/people?tree_side=maternal|paternal
 * Admin-only endpoint that returns ALL people including soft-deleted.
 */
async function getAdminPeopleByTreeSide(db, url, user) {
  const validation = validateTreeSide(url);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  // Query returns ALL people (no is_deleted filter) for admin management
  const stmt = db.prepare(
    `
    SELECT *
    FROM people
    WHERE tree_side = ?
    ORDER BY is_deleted ASC, last_name, first_name
  `
  );
  const result = await stmt.bind(validation.value).all();
  console.log("Fetched admin people list (including soft-deleted):", {
    treeSide: validation.value,
    count: result.results.length,
  });
  await logAction(db, user.username, "admin.people.list", {
    treeSide: validation.value,
  });
  return jsonResponse({ people: result.results });
}

/**
 * GET /api/people/:id
 * Returns a single person with their relationships.
 */
async function getPersonById(db, personId, user) {
  if (!Number.isInteger(personId)) {
    return jsonResponse({ error: "Invalid person id." }, 400);
  }

  // Join strategy: grab the person first, then join relationships to related people.
  const personStmt = db.prepare(
    `
    SELECT *
    FROM people
    WHERE id = ? AND is_deleted = 0
  `
  );
  const personResult = await personStmt.bind(personId).first();
  if (!personResult) {
    return jsonResponse({ error: "Person not found." }, 404);
  }

  // JOIN relationships to related people to provide context in one response.
  const relationshipsStmt = db.prepare(
    `
    SELECT
      r.*,
      p.first_name AS related_first_name,
      p.last_name AS related_last_name,
      p.gender AS related_gender
    FROM relationships r
    JOIN people p ON p.id = r.related_person_id
    WHERE r.person_id = ?
  `
  );
  const relationshipsResult = await relationshipsStmt.bind(personId).all();

  console.log("Fetched person detail:", { personId });
  await logAction(db, user.username, "people.view", { personId });
  return jsonResponse({
    person: personResult,
    relationships: relationshipsResult.results,
  });
}

/**
 * POST /api/people
 * Creates a new person record.
 */
async function createPerson(db, request, user) {
  const body = await parseJson(request);

  // Validate required fields before inserting.
  const requiredFields = ["tree_side", "first_name", "last_name", "gender"];
  const missingFields = requiredFields.filter((field) => !body[field]);
  if (missingFields.length) {
    return jsonResponse(
      { error: `Missing required fields: ${missingFields.join(", ")}.` },
      400
    );
  }

  if (body.tree_side !== "maternal" && body.tree_side !== "paternal") {
    return jsonResponse(
      { error: "tree_side must be 'maternal' or 'paternal'." },
      400
    );
  }

  const timestamp = new Date().toISOString();
  const stmt = db.prepare(
    `
    INSERT INTO people (
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
      created_at,
      updated_at,
      is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `
  );

  const result = await stmt
    .bind(
      body.tree_side,
      body.first_name,
      body.middle_name ?? null,
      body.last_name,
      body.birth_date ?? null,
      body.death_date ?? null,
      body.is_alive ?? true,
      body.current_location ?? null,
      body.profession ?? null,
      body.personal_notes ?? null,
      body.headshot_url ?? null,
      body.additional_photo_url ?? null,
      body.gender,
      timestamp,
      timestamp
    )
    .run();

  const personId = result.meta?.last_row_id || result.lastRowId;
  console.log("Created person:", { personId, resultMeta: result.meta });
  await logAction(db, user.username, "people.create", { personId });
  
  // Fetch the created person to return full object
  const created = await db
    .prepare("SELECT * FROM people WHERE id = ?")
    .bind(personId)
    .first();
  
  return jsonResponse({ id: personId, person: created }, 201);
}

/**
 * PUT /api/people/:id
 * Partial update of person data.
 */
async function updatePerson(db, request, personId, user) {
  if (!Number.isInteger(personId)) {
    return jsonResponse({ error: "Invalid person id." }, 400);
  }

  const body = await parseJson(request);
  const allowedFields = [
    "tree_side",
    "first_name",
    "middle_name",
    "last_name",
    "birth_date",
    "death_date",
    "is_alive",
    "current_location",
    "profession",
    "personal_notes",
    "headshot_url",
    "additional_photo_url",
    "gender",
  ];

  // Build a dynamic SQL statement so only provided fields are updated.
  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  const existing = await db
    .prepare(
      `
      SELECT headshot_url, additional_photo_url
      FROM people
      WHERE id = ? AND is_deleted = 0
    `
    )
    .bind(personId)
    .first();

  if (!existing) {
    return jsonResponse({ error: "Person not found." }, 404);
  }

  if (!updates.length) {
    return jsonResponse({ error: "No fields provided for update." }, 400);
  }

  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(personId);

  const stmt = db.prepare(
    `
    UPDATE people
    SET ${updates.join(", ")}
    WHERE id = ? AND is_deleted = 0
  `
  );

  const result = await stmt.bind(...values).run();
  if (result.changes === 0) {
    return jsonResponse({ error: "Person not found." }, 404);
  }

  console.log("Updated person:", { personId });
  await logAction(db, user.username, "people.update", { personId });

  const normalized = (value) => (value ? String(value) : "");
  const removedHeadshot =
    "headshot_url" in body &&
    normalized(existing.headshot_url) &&
    normalized(body.headshot_url) !== normalized(existing.headshot_url);
  const removedAdditional =
    "additional_photo_url" in body &&
    normalized(existing.additional_photo_url) &&
    normalized(body.additional_photo_url) !==
      normalized(existing.additional_photo_url);

  if (removedHeadshot) {
    await logAction(db, user.username, "photos.unlinked", {
      personId,
      type: "headshot",
      url: existing.headshot_url,
      replacement: body.headshot_url || null,
    });
  }

  if (removedAdditional) {
    await logAction(db, user.username, "photos.unlinked", {
      personId,
      type: "additional",
      url: existing.additional_photo_url,
      replacement: body.additional_photo_url || null,
    });
  }

  const updated = await db
    .prepare("SELECT * FROM people WHERE id = ? AND is_deleted = 0")
    .bind(personId)
    .first();

  return jsonResponse({ person: updated });
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
async function getRelationshipsByTreeSide(db, url, user) {
  const validation = validateTreeSide(url);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const stmt = db.prepare(
    `
    SELECT *
    FROM relationships
    WHERE tree_side = ?
  `
  );
  const result = await stmt.bind(validation.value).all();
  console.log("Fetched relationships:", { treeSide: validation.value });
  await logAction(db, user.username, "relationships.list", {
    treeSide: validation.value,
  });
  return jsonResponse({ relationships: result.results });
}

/**
 * POST /api/relationships
 * Creates a relationship and its reciprocal for bidirectional navigation.
 */
async function createRelationship(db, request, user) {
  const body = await parseJson(request);

  const requiredFields = [
    "tree_side",
    "person_id",
    "related_person_id",
    "relationship_type",
  ];
  const missingFields = requiredFields.filter((field) => !body[field]);
  if (missingFields.length) {
    return jsonResponse(
      { error: `Missing required fields: ${missingFields.join(", ")}.` },
      400
    );
  }

  const reciprocalType = getReciprocalRelationshipType(body.relationship_type);
  if (!reciprocalType) {
    return jsonResponse(
      { error: "Unsupported relationship_type provided." },
      400
    );
  }

  // Insert both directions so the tree can be traversed from either person.
  const timestamp = new Date().toISOString();
  const statement = `
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

  const batch = [
    db
      .prepare(statement)
      .bind(
        body.tree_side,
        body.person_id,
        body.related_person_id,
        body.relationship_type,
        body.is_blood_relation ?? false,
        body.marriage_date ?? null,
        body.divorce_date ?? null,
        body.relationship_order ?? null,
        timestamp
      ),
    db
      .prepare(statement)
      .bind(
        body.tree_side,
        body.related_person_id,
        body.person_id,
        reciprocalType,
        body.is_blood_relation ?? false,
        body.marriage_date ?? null,
        body.divorce_date ?? null,
        body.relationship_order ?? null,
        timestamp
      ),
  ];

  // Batch ensures both relationship records are created together.
  const results = await db.batch(batch);
  console.log("Created relationship:", {
    personId: body.person_id,
    relatedPersonId: body.related_person_id,
    type: body.relationship_type,
  });
  await logAction(db, user.username, "relationships.create", {
    personId: body.person_id,
    relatedPersonId: body.related_person_id,
    type: body.relationship_type,
  });

  return jsonResponse(
    { primaryId: results[0]?.meta?.last_row_id },
    201
  );
}

/**
 * DELETE /api/relationships/:id
 * Removes the relationship and its reciprocal record.
 */
async function deleteRelationship(db, relationshipId, user) {
  if (!Number.isInteger(relationshipId)) {
    return jsonResponse({ error: "Invalid relationship id." }, 400);
  }

  const relationshipStmt = db.prepare(
    `
    SELECT *
    FROM relationships
    WHERE id = ?
  `
  );
  const relationship = await relationshipStmt.bind(relationshipId).first();
  if (!relationship) {
    return jsonResponse({ error: "Relationship not found." }, 404);
  }

  const reciprocalType = getReciprocalRelationshipType(
    relationship.relationship_type
  );

  const deleteStmt = `
    DELETE FROM relationships
    WHERE (id = ?)
       OR (
            person_id = ?
        AND related_person_id = ?
        AND relationship_type = ?
       )
  `;
  await db
    .prepare(deleteStmt)
    .bind(
      relationshipId,
      relationship.related_person_id,
      relationship.person_id,
      reciprocalType
    )
    .run();

  console.log("Deleted relationship:", { relationshipId });
  await logAction(db, user.username, "relationships.delete", { relationshipId });
  return jsonResponse({ id: relationshipId });
}

/**
 * GET /api/tree?tree_side=maternal|paternal
 * Builds a hierarchical tree structure from flat data.
 */
async function getTreeHierarchy(db, url, user) {
  const validation = validateTreeSide(url);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  // Fetch people first, then relationships to construct the hierarchy.
  const peopleStmt = db.prepare(
    `
    SELECT *
    FROM people
    WHERE tree_side = ? AND is_deleted = 0
  `
  );
  const relationshipsStmt = db.prepare(
    `
    SELECT *
    FROM relationships
    WHERE tree_side = ?
  `
  );

  const peopleResult = await peopleStmt.bind(validation.value).all();
  const relationshipsResult = await relationshipsStmt.bind(validation.value).all();

  // Tree-building algorithm:
  // 1. Index people by id for quick lookup.
  // 2. Attach children to parents based on parent/child relationships.
  // 3. Return the top-level roots (people without parents in this tree).
  const peopleById = new Map(
    peopleResult.results.map((person) => [person.id, { ...person, children: [] }])
  );
  const childIds = new Set();

  for (const relationship of relationshipsResult.results) {
    if (relationship.relationship_type === "parent") {
      const parent = peopleById.get(relationship.person_id);
      const child = peopleById.get(relationship.related_person_id);
      if (parent && child) {
        parent.children.push(child);
        childIds.add(child.id);
      }
    }
  }

  const roots = [];
  for (const person of peopleById.values()) {
    if (!childIds.has(person.id)) {
      roots.push(person);
    }
  }

  console.log("Built tree hierarchy:", {
    treeSide: validation.value,
    roots: roots.length,
  });
  await logAction(db, user.username, "tree.view", { treeSide: validation.value });

  return jsonResponse({ tree: roots });
}

/**
 * Calculate ancestry side (maternal/paternal) for color coding
 * Returns map of person ID → ancestry type
 */
function calculateAncestry(people, relationships) {
  const ancestryMap = {};
  const peopleById = new Map(people.map((p) => [p.id, p]));

  // Helper: Find all ancestors of a person
  function getAncestorSides(personId, visited = new Set()) {
    if (visited.has(personId)) return { maternal: false, paternal: false };
    visited.add(personId);

    const parentRels = relationships.filter(
      (r) => r.person_id === personId && r.relationship_type === 'parent'
    );

    let hasMaternalAncestor = false;
    let hasPaternalAncestor = false;

    for (const parentRel of parentRels) {
      const parent = peopleById.get(parentRel.related_person_id);
      if (!parent) continue;

      // Check parent's tree_side to determine if this is maternal or paternal
      if (parent.tree_side === 'maternal') {
        hasMaternalAncestor = true;
      } else if (parent.tree_side === 'paternal') {
        hasPaternalAncestor = true;
      } else {
        // If parent has no explicit tree_side, recurse to find their ancestors
        const parentSides = getAncestorSides(parent.id, visited);
        hasMaternalAncestor = hasMaternalAncestor || parentSides.maternal;
        hasPaternalAncestor = hasPaternalAncestor || parentSides.paternal;
      }
    }

    return { maternal: hasMaternalAncestor, paternal: hasPaternalAncestor };
  }

  // Assign ancestry to each person
  for (const person of people) {
    if (person.tree_side && person.tree_side !== 'NULL') {
      // Use explicit tree_side if set
      ancestryMap[person.id] = person.tree_side;
    } else {
      // Calculate from ancestors
      const sides = getAncestorSides(person.id);
      if (sides.maternal && sides.paternal) {
        ancestryMap[person.id] = 'both';
      } else if (sides.maternal) {
        ancestryMap[person.id] = 'maternal';
      } else if (sides.paternal) {
        ancestryMap[person.id] = 'paternal';
      } else {
        ancestryMap[person.id] = 'unknown';
      }
    }
  }

  return ancestryMap;
}

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

    // Calculate ancestry for color coding
    const ancestryMap = calculateAncestry(people, relationships);

    // Transform to family-chart format
    const treeData = people.map((person) => {
      const rels = relIndex[person.id] || { spouses: [], children: [], parents: [] };
      const ancestry = ancestryMap[person.id] || 'unknown';

      return {
        id: String(person.id),
        data: {
          'first name': person.first_name || '',
          'middle name': person.middle_name || '',
          'last name': person.last_name || '',
          'gender': person.gender || 'other',
          'birthday': person.birth_date || '',
          'deathday': person.death_date || '',
          'is_alive': person.is_alive ? 1 : 0,
          'location': person.current_location || '',
          'profession': person.profession || '',
          'notes': person.personal_notes || '',
          'photo': person.headshot_url || '',
          'additional_photo': person.additional_photo_url || '',
          'tree_side': person.tree_side || 'both',
          'ancestry': ancestry, // Color coding hint: maternal, paternal, both, unknown
          'created_at': person.created_at || '',
        },
        rels: {
          spouses: rels.spouses.map((s) => s.id),
          children: rels.children,
          father: rels.parents.find((p) => {
            const parent = people.find((per) => per.id === parseInt(p));
            return parent && parent.gender === 'male';
          }),
          mother: rels.parents.find((p) => {
            const parent = people.find((per) => per.id === parseInt(p));
            return parent && parent.gender === 'female';
          }),
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
 * Map relationship types to their reciprocal.
 *
 * - parent <-> child
 * - spouse <-> spouse
 * - ex-spouse <-> ex-spouse
 * - sibling <-> sibling
 */
function getReciprocalRelationshipType(type) {
  switch (type) {
    case "parent":
      return "child";
    case "child":
      return "parent";
    case "spouse":
      return "spouse";
    case "ex-spouse":
      return "ex-spouse";
    case "sibling":
      return "sibling";
    default:
      return null;
  }
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
  const [peopleMaternal, peoplePaternal, peopleMaternalAll, peoplePaternalAll, relationships, relationshipsActive, activity] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM people WHERE tree_side = 'maternal' AND is_deleted = 0"
      )
      .first(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM people WHERE tree_side = 'paternal' AND is_deleted = 0"
      )
      .first(),
    db
      .prepare("SELECT COUNT(*) AS count FROM people WHERE tree_side = 'maternal'")
      .first(),
    db
      .prepare("SELECT COUNT(*) AS count FROM people WHERE tree_side = 'paternal'")
      .first(),
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
      maternal: peopleMaternal?.count || 0,
      paternal: peoplePaternal?.count || 0,
      maternalTotal: peopleMaternalAll?.count || 0,
      paternalTotal: peoplePaternalAll?.count || 0,
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
