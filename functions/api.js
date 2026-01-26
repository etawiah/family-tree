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

    // Validate that the D1 database binding is available.
    if (!db) {
      return jsonResponse(
        { error: "Database binding not configured. Expected env.DB." },
        500
      );
    }

    // Basic health endpoint to confirm the Worker is live.
    if (method === "GET" && path === "/api/health") {
      return jsonResponse({
        message: "Family Tree API is running.",
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Route matching for endpoints with path parameters.
      const peopleIdMatch = path.match(/^\/api\/people\/(\d+)$/);
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

      if (peopleIdMatch && method === "DELETE") {
        const user = await requireAuth("admin")(request, env);
        const personId = Number(peopleIdMatch[1]);
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

      return jsonResponse({ error: "Route not found." }, 404);
    } catch (error) {
      // Log errors for debugging without exposing sensitive data.
      console.error("API error:", error);
      if (error?.name === "AuthError") {
        await logAction(db, "unknown", "auth.failed", {
          path,
          reason: error.message,
        });
        return jsonResponse({ error: error.message }, error.status || 401);
      }
      return jsonResponse(
        { error: "Unexpected server error. Please try again later." },
        500
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
  console.log("User logged in:", { username: user.username, accessLevel: user.access_level });
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
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

  console.log("Created person:", { personId: result.lastRowId });
  await logAction(db, user.username, "people.create", { personId: result.lastRowId });
  return jsonResponse({ id: result.lastRowId }, 201);
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
  return jsonResponse({ id: personId });
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
  const [peopleMaternal, peoplePaternal, relationships, activity] = await Promise.all([
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
    db.prepare("SELECT COUNT(*) AS count FROM relationships").first(),
    db.prepare("SELECT COUNT(*) AS count FROM activity_log").first(),
  ]);

  await logAction(db, user.username, "admin.stats.view", {});

  return jsonResponse({
    people: {
      maternal: peopleMaternal?.count || 0,
      paternal: peoplePaternal?.count || 0,
    },
    relationships: relationships?.count || 0,
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
