/**
 * Authentication utilities for Cloudflare Workers.
 *
 * - Password hashing uses PBKDF2 to slow down brute-force attacks.
 * - JWTs provide stateless authentication with short-lived tokens.
 * - Secrets are loaded from environment variables (env.JWT_SECRET).
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_ALGO = "SHA-256";

/**
 * Hash a password using PBKDF2.
 *
 * PBKDF2 is chosen because it is widely supported by the Web Crypto API and
 * intentionally slow, which makes credential stuffing attacks more expensive.
 *
 * @param {string} password
 * @returns {Promise<string>} Encoded hash containing iterations, salt, and hash.
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: PBKDF2_ALGO,
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256
  );

  const hash = new Uint8Array(derivedBits);
  return [
    "pbkdf2",
    PBKDF2_ITERATIONS,
    base64UrlEncode(salt),
    base64UrlEncode(hash),
  ].join("$");
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  const [scheme, iterations, saltB64, hashB64] = storedHash.split("$");
  if (scheme !== "pbkdf2") {
    return false;
  }

  const salt = base64UrlDecode(saltB64);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: PBKDF2_ALGO,
      salt,
      iterations: Number(iterations),
    },
    key,
    256
  );

  const computedHash = base64UrlEncode(new Uint8Array(derivedBits));
  return timingSafeEqual(hashB64, computedHash);
}

/**
 * Generate a signed JWT using HS256.
 *
 * The token expires in 7 days to balance security with user convenience for a family app.
 * Shorter expiration increases security if a token leaks, while longer expiration reduces
 * the need for frequent re-authentication.
 *
 * @param {string} username
 * @param {"view"|"edit"|"admin"} accessLevel
 * @param {string} jwtSecret
 * @returns {Promise<string>}
 */
export async function generateToken(username, accessLevel, jwtSecret) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: username,
    accessLevel,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
  };

  const headerB64 = base64UrlEncodeUtf8(JSON.stringify(header));
  const payloadB64 = base64UrlEncodeUtf8(JSON.stringify(payload));
  const signature = await signJwt(`${headerB64}.${payloadB64}`, jwtSecret);

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify a JWT signature and expiration.
 *
 * @param {string} token
 * @param {string} jwtSecret
 * @returns {Promise<{ username: string, accessLevel: string }>}
 */
export async function verifyToken(token, jwtSecret) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError("Invalid token format.", 401);
  }

  const [headerB64, payloadB64, signature] = parts;
  const unsigned = `${headerB64}.${payloadB64}`;
  const expectedSignature = await signJwt(unsigned, jwtSecret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new AuthError("Invalid token signature.", 401);
  }

  const payload = JSON.parse(base64UrlDecodeUtf8(payloadB64));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new AuthError("Token has expired.", 401);
  }

  return { username: payload.sub, accessLevel: payload.accessLevel };
}

/**
 * Middleware generator for access control.
 *
 * Usage:
 * const requireView = requireAuth("view");
 * await requireView(request, env);
 *
 * @param {"view"|"edit"|"admin"} requiredLevel
 * @returns {(request: Request, env: Record<string, any>) => Promise<{ username: string, accessLevel: string }>}
 */
export function requireAuth(requiredLevel) {
  return async (request, env) => {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new AuthError("Missing Authorization header.", 401);
    }

    // JWT_SECRET should be set in the Cloudflare Worker environment variables.
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AuthError("JWT_SECRET is not configured.", 500);
    }

    const user = await verifyToken(token, jwtSecret);
    if (!hasRequiredAccess(user.accessLevel, requiredLevel)) {
      throw new AuthError("Insufficient access level.", 403);
    }

    return user;
  };
}

class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function hasRequiredAccess(userLevel, requiredLevel) {
  const order = { view: 0, edit: 1, admin: 2 };
  return order[userLevel] >= order[requiredLevel];
}

async function signJwt(data, jwtSecret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeUtf8(value) {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlDecodeUtf8(value) {
  return new TextDecoder().decode(base64UrlDecode(value));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
