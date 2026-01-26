/**
 * Database helper utilities for Cloudflare D1.
 *
 * These functions encapsulate common patterns like error handling, response
 * formatting, and data transformation to keep API handlers focused on routing.
 */

/**
 * Execute a SQL query with consistent error handling.
 *
 * @param {D1Database} db - Cloudflare D1 database binding.
 * @param {string} sql - SQL query string with ? placeholders.
 * @param {Array<unknown>} params - Query parameters to bind.
 * @returns {Promise<{ results: any[], success: boolean, error?: string }>}
 */
export async function executeQuery(db, sql, params = []) {
  try {
    const statement = db.prepare(sql).bind(...params);
    const result = await statement.all();
    return { results: result.results ?? [], success: true };
  } catch (error) {
    console.error("Database query failed:", { sql, error });
    return { results: [], success: false, error: "Database query failed." };
  }
}

/**
 * Convert a raw DB row into the API response shape expected by the frontend.
 *
 * @param {Record<string, any>} dbRow - Row returned by D1.
 * @returns {Record<string, any>}
 */
export function formatPersonResponse(dbRow) {
  if (!dbRow) {
    return null;
  }

  return {
    id: dbRow.id,
    treeSide: dbRow.tree_side,
    firstName: dbRow.first_name,
    middleName: dbRow.middle_name,
    lastName: dbRow.last_name,
    birthDate: dbRow.birth_date,
    deathDate: dbRow.death_date,
    isAlive: Boolean(dbRow.is_alive),
    currentLocation: dbRow.current_location,
    profession: dbRow.profession,
    personalNotes: dbRow.personal_notes,
    headshotUrl: dbRow.headshot_url,
    additionalPhotoUrl: dbRow.additional_photo_url,
    gender: dbRow.gender,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
  };
}

/**
 * Build a hierarchical tree from flat people + relationship lists.
 *
 * @param {Array<Record<string, any>>} people
 * @param {Array<Record<string, any>>} relationships
 * @returns {Array<Record<string, any>>} Root nodes for the tree
 */
export function buildTreeHierarchy(people, relationships) {
  // Index people by id for fast lookups.
  const peopleById = new Map(
    people.map((person) => [person.id, { ...person, children: [] }])
  );
  const childIds = new Set();

  // Attach children to parents using relationship edges.
  for (const relationship of relationships) {
    if (relationship.relationship_type === "parent") {
      const parent = peopleById.get(relationship.person_id);
      const child = peopleById.get(relationship.related_person_id);
      if (parent && child) {
        parent.children.push(child);
        childIds.add(child.id);
      }
    }
  }

  // Roots are people who never appear as a child.
  const roots = [];
  for (const person of peopleById.values()) {
    if (!childIds.has(person.id)) {
      roots.push(person);
    }
  }

  return roots;
}
