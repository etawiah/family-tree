import { afterEach, describe, expect, it, vi } from "vitest";
import { base64UrlEncode } from "../src/crypto.js";
import { normalizeTeamDomain, resetJwksCache, splitJwt, verifyAccessJwt } from "../src/jwt.js";

const TEAM = "https://example.cloudflareaccess.com";
const AUD = "audience-tag";

async function generatePair() {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"]
  );
}

function encodeJson(obj) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

async function signJwt(privateKey, payload, kid = "kid-1") {
  const header = encodeJson({ alg: "RS256", kid, typ: "JWT" });
  const body = encodeJson(payload);
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
  return `${header}.${body}.${base64UrlEncode(sig)}`;
}

describe("team domain and JWT split", () => {
  it("normalizes a host or URL", () => {
    expect(normalizeTeamDomain("example.cloudflareaccess.com")).toBe(TEAM);
    expect(normalizeTeamDomain(`${TEAM}/`)).toBe(TEAM);
    expect(normalizeTeamDomain("")).toBe("");
  });

  it("rejects a malformed token", () => {
    expect(splitJwt("")).toBeNull();
    expect(splitJwt("a.b")).toBeNull();
    expect(splitJwt("a..c")).toBeNull();
  });
});

describe("verifyAccessJwt", () => {
  afterEach(() => {
    resetJwksCache();
    vi.unstubAllGlobals();
  });

  async function setup({ expOffset = 3600, aud = AUD, iss = TEAM, kid = "kid-1" } = {}) {
    const pair = await generatePair();
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ keys: [{ ...jwk, kid, kty: "RSA" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const now = 1_700_000_000;
    const token = await signJwt(pair.privateKey, {
      aud,
      iss,
      exp: now + expOffset,
      email: "Eugene@Example.com",
    }, kid);
    return { token, nowMs: now * 1000 };
  }

  it("accepts a valid Access JWT and returns the email", async () => {
    const { token, nowMs } = await setup();
    const result = await verifyAccessJwt(token, { teamDomain: TEAM, audience: AUD, nowMs });
    expect(result.ok).toBe(true);
    expect(result.email).toBe("eugene@example.com");
  });

  it("rejects a wrong audience, issuer, or expiry", async () => {
    const wrongAud = await setup({ aud: "other" });
    expect(
      (await verifyAccessJwt(wrongAud.token, { teamDomain: TEAM, audience: AUD, nowMs: wrongAud.nowMs })).reason
    ).toBe("aud");

    resetJwksCache();
    const wrongIss = await setup({ iss: "https://other.cloudflareaccess.com" });
    expect(
      (await verifyAccessJwt(wrongIss.token, { teamDomain: TEAM, audience: AUD, nowMs: wrongIss.nowMs })).reason
    ).toBe("iss");

    resetJwksCache();
    const expired = await setup({ expOffset: -10 });
    expect(
      (await verifyAccessJwt(expired.token, { teamDomain: TEAM, audience: AUD, nowMs: expired.nowMs })).reason
    ).toBe("expired");
  });
});
