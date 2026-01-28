const TOKEN_KEY = "family_tree_token";
const ACCESS_KEY = "family_tree_access_level";

/**
 * Send login request to the backend and persist the JWT locally.
 *
 * Note: localStorage is vulnerable to XSS. Keep scripts locked down and
 * avoid injecting untrusted HTML to reduce risk.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ token: string, accessLevel: string }>}
 */
export async function login(username, password) {
  const baseUrl = import.meta.env.VITE_API_URL;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error || "Login failed.");
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(ACCESS_KEY, data.accessLevel);
  return data;
}

/**
 * Clear stored authentication tokens.
 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_KEY);
}

/**
 * Retrieve the current JWT from storage.
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Check if a token is currently stored.
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Return the stored access level for UI gating.
 */
export function getAccessLevel() {
  const level = localStorage.getItem(ACCESS_KEY);
  console.log("[auth.js] getAccessLevel() returning:", level, "from key:", ACCESS_KEY);
  return level;
}

/**
 * Compare access levels in a consistent order.
 *
 * @param {"view"|"edit"|"admin"} userLevel
 * @param {"view"|"edit"|"admin"} requiredLevel
 * @returns {boolean}
 */
export function hasRequiredAccess(userLevel, requiredLevel) {
  const order = { view: 0, edit: 1, admin: 2 };
  return order[userLevel] >= order[requiredLevel];
}
