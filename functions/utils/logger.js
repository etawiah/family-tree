/**
 * Simple activity logging utility.
 *
 * Guidelines:
 * - Do log: CRUD events, snapshot operations, auth attempts (success/fail).
 * - Do NOT log: passwords, tokens, or private personal data.
 */

/**
 * Store an activity log entry in the database.
 *
 * @param {D1Database} db
 * @param {string} userId - Username or system tag (e.g., "system").
 * @param {string} action - Short action label.
 * @param {Record<string, unknown>} details - Non-sensitive metadata.
 * @returns {Promise<void>}
 */
export async function logAction(db, userId, action, details = {}) {
  if (!db) {
    return;
  }

  const stmt = db.prepare(
    `
    INSERT INTO activity_log (user_id, action, details, created_at)
    VALUES (?, ?, ?, ?)
  `
  );

  const safeDetails = JSON.stringify(details);
  await stmt.bind(userId, action, safeDetails, new Date().toISOString()).run();
}
