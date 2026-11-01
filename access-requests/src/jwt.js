import { base64UrlDecode, stripTrailingSlashes } from "./crypto.js";
import { isAdminEmail, normalizeEmail } from "./validation.js";

const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = { fetchedAt: 0, keys: null, url: "" };

export function normalizeTeamDomain(teamDomain) {
  const raw = stripTrailingSlashes(String(teamDomain ?? "").trim());
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function decodeJwtPart(part) {
  const bytes = base64UrlDecode(part);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function splitJwt(token) {
  if (typeof token !== "string" || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) return null;
  return { headerB64: parts[0], payloadB64: parts[1], sigB64: parts[2] };
}

function audienceMatches(claimAud, expected) {
  if (!expected) return false;
  if (Array.isArray(claimAud)) return claimAud.includes(expected);
  return claimAud === expected;
}

async function loadJwks(certsUrl) {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.url === certsUrl && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(certsUrl);
  if (!res.ok) throw new Error("certs_fetch_failed");
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) throw new Error("certs_empty");
  jwksCache = { fetchedAt: now, keys, url: certsUrl };
  return keys;
}

async function importRsaKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      n: jwk.n,
      e: jwk.e,
      alg: "RS256",
      ext: true,
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export async function verifyAccessJwt(token, { teamDomain, audience, nowMs = Date.now() }) {
  const parts = splitJwt(token);
  if (!parts) return { ok: false, reason: "malformed" };

  let header;
  let payload;
  try {
    header = decodeJwtPart(parts.headerB64);
    payload = decodeJwtPart(parts.payloadB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (header.alg !== "RS256") return { ok: false, reason: "alg" };

  const issuer = normalizeTeamDomain(teamDomain);
  if (!issuer || payload.iss !== issuer) return { ok: false, reason: "iss" };
  if (!audienceMatches(payload.aud, audience)) return { ok: false, reason: "aud" };
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(nowMs / 1000)) {
    return { ok: false, reason: "expired" };
  }

  let keys;
  try {
    keys = await loadJwks(`${issuer}/cdn-cgi/access/certs`);
  } catch {
    return { ok: false, reason: "certs" };
  }

  const jwk = keys.find((k) => k.kid === header.kid) || (keys.length === 1 ? keys[0] : null);
  if (!jwk?.n || !jwk?.e) return { ok: false, reason: "kid" };

  try {
    const key = await importRsaKey(jwk);
    const data = new TextEncoder().encode(`${parts.headerB64}.${parts.payloadB64}`);
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlDecode(parts.sigB64),
      data
    );
    if (!ok) return { ok: false, reason: "sig" };
  } catch {
    return { ok: false, reason: "sig" };
  }

  const email = normalizeEmail(payload.email);
  return { ok: true, email, payload };
}

export async function requireAdmin(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, reason: "missing_jwt" };

  const verified = await verifyAccessJwt(token, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.ACCESS_AUD,
  });
  if (!verified.ok) return { ok: false, reason: verified.reason };
  if (!isAdminEmail(verified.email, env.ADMIN_EMAILS)) {
    return { ok: false, reason: "not_admin" };
  }
  return { ok: true, email: verified.email };
}

export function resetJwksCache() {
  jwksCache = { fetchedAt: 0, keys: null, url: "" };
}
