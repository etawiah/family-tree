/**
 * Input validation helpers with human-friendly error messages.
 * Examples are included for clarity during development.
 */

/**
 * Validate tree_side values.
 *
 * Valid: "maternal", "paternal"
 * Invalid: "mother", "", null
 */
export function validateTreeSide(treeSide) {
  if (!treeSide) {
    return { ok: false, error: "tree_side is required." };
  }
  if (treeSide !== "maternal" && treeSide !== "paternal") {
    return { ok: false, error: "tree_side must be 'maternal' or 'paternal'." };
  }
  return { ok: true, value: treeSide };
}

/**
 * Validate access level values.
 *
 * Valid: "view", "edit", "admin"
 * Invalid: "owner", 2, undefined
 */
export function validateAccessLevel(level) {
  const allowed = ["view", "edit", "admin"];
  if (!allowed.includes(level)) {
    return { ok: false, error: "access_level must be view, edit, or admin." };
  }
  return { ok: true, value: level };
}

/**
 * Validate required fields are present.
 *
 * Example:
 * - Required: ["first_name", "last_name"]
 * - Payload: { first_name: "Ada" } -> error for missing last_name
 */
export function validateRequiredFields(payload, requiredFields) {
  const missing = requiredFields.filter((field) => !payload?.[field]);
  if (missing.length) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}.` };
  }
  return { ok: true };
}

/**
 * Validate relationship types.
 *
 * Valid: "parent", "child", "spouse", "ex-spouse", "sibling"
 * Invalid: "partner", "guardian"
 */
export function validateRelationshipType(type) {
  const allowed = ["parent", "child", "spouse", "ex-spouse", "sibling"];
  if (!allowed.includes(type)) {
    return { ok: false, error: "relationship_type is invalid." };
  }
  return { ok: true, value: type };
}
