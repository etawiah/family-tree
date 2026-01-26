import { logAction } from "./utils/logger.js";

/**
 * ES Module Worker entry point.
 *
 * Cloudflare Workers run in ES module format when you export a default object
 * with handler methods (fetch, scheduled, etc.). This keeps bindings like D1
 * available on the `env` parameter instead of using global variables.
 */
export default {
  /**
   * Scheduled handler for daily snapshots.
   *
   * The cron schedule itself is defined in `wrangler.toml`. When it fires,
   * Cloudflare invokes this handler with the D1 binding available at `env.DB`.
   */
  async scheduled(event, env, ctx) {
    if (!env.DB) {
      return;
    }
    // Use waitUntil so the snapshot can finish after the event completes.
    ctx.waitUntil(createSnapshot(env.DB, "auto"));
  },
};

/**
 * Export the entire database as JSON and store in snapshots table.
 *
 * JSON serialization strategy:
 * - Query each table independently to keep schema boundaries clear.
 * - Serialize to a single JSON document for easy restore.
 */
export async function createSnapshot(db, createdBy = "auto", description = "") {
  const [people, relationships, users, activityLog] = await Promise.all([
    db.prepare("SELECT * FROM people").all(),
    db.prepare("SELECT * FROM relationships").all(),
    db.prepare("SELECT * FROM users").all(),
    db.prepare("SELECT * FROM activity_log").all(),
  ]);

  const snapshotPayload = {
    people: people.results ?? [],
    relationships: relationships.results ?? [],
    users: users.results ?? [],
    activity_log: activityLog.results ?? [],
    created_at: new Date().toISOString(),
    description,
  };

  const insertStmt = db.prepare(
    `
    INSERT INTO snapshots (snapshot_data, created_at, created_by)
    VALUES (?, ?, ?)
  `
  );

  const createdAt = new Date().toISOString();
  const result = await insertStmt
    .bind(JSON.stringify(snapshotPayload), createdAt, createdBy)
    .run();

  await logAction(db, createdBy, "snapshot.create", {
    snapshotId: result.lastRowId,
    description,
  });

  return result.lastRowId;
}

/**
 * Return snapshot metadata in descending order.
 */
export async function listSnapshots(db) {
  const stmt = db.prepare(
    `
    SELECT id, created_at, created_by, snapshot_data
    FROM snapshots
    ORDER BY created_at DESC
  `
  );
  const result = await stmt.all();

  // Extract description without returning the full dataset in list view.
  return (result.results ?? []).map((row) => {
    const parsed = safeParseJson(row.snapshot_data);
    return {
      id: row.id,
      created_at: row.created_at,
      created_by: row.created_by,
      description: parsed?.description || "",
    };
  });
}

/**
 * Restore database state from a snapshot.
 *
 * Steps:
 * 1. Create a backup snapshot of the current state.
 * 2. Clear tables that will be restored.
 * 3. Insert rows from the snapshot in a batch.
 */
export async function restoreSnapshot(db, snapshotId, restoredBy = "admin") {
  const snapshotStmt = db.prepare(
    `
    SELECT snapshot_data
    FROM snapshots
    WHERE id = ?
  `
  );
  const snapshotRow = await snapshotStmt.bind(snapshotId).first();
  if (!snapshotRow) {
    throw new Error("Snapshot not found.");
  }

  // Backup current state before restore for safety.
  await createSnapshot(db, "system-backup", `Backup before restore ${snapshotId}`);

  const snapshotData = safeParseJson(snapshotRow.snapshot_data);
  if (!snapshotData) {
    throw new Error("Snapshot data is invalid.");
  }

  const batch = [
    db.prepare("DELETE FROM people"),
    db.prepare("DELETE FROM relationships"),
    db.prepare("DELETE FROM users"),
    db.prepare("DELETE FROM activity_log"),
  ];

  for (const person of snapshotData.people || []) {
    batch.push(
      db.prepare(
        `
        INSERT INTO people (
          id, tree_side, first_name, middle_name, last_name,
          birth_date, death_date, is_alive, current_location,
          profession, personal_notes, headshot_url,
          additional_photo_url, gender, is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).bind(
        person.id,
        person.tree_side,
        person.first_name,
        person.middle_name,
        person.last_name,
        person.birth_date,
        person.death_date,
        person.is_alive,
        person.current_location,
        person.profession,
        person.personal_notes,
        person.headshot_url,
        person.additional_photo_url,
        person.gender,
        person.is_deleted ?? 0,
        person.created_at,
        person.updated_at
      )
    );
  }

  for (const relation of snapshotData.relationships || []) {
    batch.push(
      db.prepare(
        `
        INSERT INTO relationships (
          id, tree_side, person_id, related_person_id, relationship_type,
          is_blood_relation, marriage_date, divorce_date, relationship_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).bind(
        relation.id,
        relation.tree_side,
        relation.person_id,
        relation.related_person_id,
        relation.relationship_type,
        relation.is_blood_relation,
        relation.marriage_date,
        relation.divorce_date,
        relation.relationship_order,
        relation.created_at
      )
    );
  }

  for (const user of snapshotData.users || []) {
    batch.push(
      db.prepare(
        `
        INSERT INTO users (id, username, password_hash, access_level, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).bind(
        user.id,
        user.username,
        user.password_hash,
        user.access_level,
        user.created_at
      )
    );
  }

  for (const log of snapshotData.activity_log || []) {
    batch.push(
      db.prepare(
        `
        INSERT INTO activity_log (id, user_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).bind(log.id, log.user_id, log.action, log.details, log.created_at)
    );
  }

  // Batch execution keeps the restore in a single operation sequence.
  await db.batch(batch);

  await logAction(db, restoredBy, "snapshot.restore", { snapshotId });
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
