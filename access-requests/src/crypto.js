const encoder = new TextEncoder();

export function base64UrlEncode(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(sig);
}

export function timingSafeEqualBytes(a, b) {
  const x = a instanceof Uint8Array ? a : new Uint8Array(a);
  const y = b instanceof Uint8Array ? b : new Uint8Array(b);
  const len = Math.max(x.length, y.length);
  let diff = 0;
  for (let i = 0; i < len; i += 1) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0 && x.length === y.length;
}

export const ACTION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function actionPayload(action, id, exp) {
  return `${action}:${id}:${exp}`;
}

export async function signAction(secret, action, id, exp) {
  const sig = await hmacSha256(secret, actionPayload(action, id, exp));
  return base64UrlEncode(sig);
}

export function isExpired(exp, nowMs = Date.now()) {
  const expNum = typeof exp === "number" ? exp : Number(exp);
  if (!Number.isFinite(expNum)) return true;
  return expNum < Math.floor(nowMs / 1000);
}

export async function verifyAction(secret, { action, id, exp, sig }, nowMs = Date.now()) {
  if (!secret || !action || !id || exp === undefined || exp === null || !sig) {
    return { ok: false, reason: "missing" };
  }
  if (isExpired(exp, nowMs)) {
    return { ok: false, reason: "expired" };
  }
  const expected = await signAction(secret, action, id, String(exp));
  const got = String(sig);
  let expectedBytes;
  let gotBytes;
  try {
    expectedBytes = base64UrlDecode(expected);
    gotBytes = base64UrlDecode(got);
  } catch {
    return { ok: false, reason: "bad_sig" };
  }
  if (!timingSafeEqualBytes(expectedBytes, gotBytes)) {
    return { ok: false, reason: "bad_sig" };
  }
  return { ok: true };
}

export function expiryUnixSeconds(nowMs = Date.now(), ttlSeconds = ACTION_TTL_SECONDS) {
  return Math.floor(nowMs / 1000) + ttlSeconds;
}
