import { describe, expect, it } from "vitest";
import {
  ACTION_TTL_SECONDS,
  expiryUnixSeconds,
  isExpired,
  signAction,
  verifyAction,
} from "../src/crypto.js";

const SECRET = "test-signing-key-not-for-production";

describe("HMAC action signatures", () => {
  it("round-trips a valid approve signature", async () => {
    const exp = expiryUnixSeconds(1_700_000_000_000);
    const sig = await signAction(SECRET, "approve", "req-1", exp);
    const result = await verifyAction(
      SECRET,
      { action: "approve", id: "req-1", exp, sig },
      1_700_000_000_000
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a tampered signature", async () => {
    const exp = expiryUnixSeconds(1_700_000_000_000);
    const sig = await signAction(SECRET, "approve", "req-1", exp);
    const result = await verifyAction(
      SECRET,
      { action: "approve", id: "req-1", exp, sig: `${sig}x` },
      1_700_000_000_000
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bad_sig");
  });

  it("rejects a signature created for a different action", async () => {
    const exp = expiryUnixSeconds(1_700_000_000_000);
    const sig = await signAction(SECRET, "approve", "req-1", exp);
    const result = await verifyAction(
      SECRET,
      { action: "deny", id: "req-1", exp, sig },
      1_700_000_000_000
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bad_sig");
  });

  it("rejects a signature created for a different id", async () => {
    const exp = expiryUnixSeconds(1_700_000_000_000);
    const sig = await signAction(SECRET, "deny", "req-1", exp);
    const result = await verifyAction(
      SECRET,
      { action: "deny", id: "req-2", exp, sig },
      1_700_000_000_000
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bad_sig");
  });

  it("rejects a signature from a different key", async () => {
    const exp = expiryUnixSeconds(1_700_000_000_000);
    const sig = await signAction(SECRET, "approve", "req-1", exp);
    const result = await verifyAction(
      "other-key",
      { action: "approve", id: "req-1", exp, sig },
      1_700_000_000_000
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bad_sig");
  });

  it("rejects missing fields", async () => {
    const result = await verifyAction(SECRET, { action: "approve", id: "", exp: 1, sig: "x" });
    expect(result).toEqual({ ok: false, reason: "missing" });
  });
});

describe("action expiry", () => {
  it("is 7 days", () => {
    expect(ACTION_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(expiryUnixSeconds(0)).toBe(ACTION_TTL_SECONDS);
  });

  it("treats the exact expiry second as still valid", () => {
    expect(isExpired(100, 100_000)).toBe(false);
    expect(isExpired("100", 100_999)).toBe(false);
  });

  it("treats a second past expiry as expired", () => {
    expect(isExpired(100, 101_000)).toBe(true);
  });

  it("treats a non-numeric expiry as expired", () => {
    expect(isExpired("nope", Date.now())).toBe(true);
    expect(isExpired(undefined, Date.now())).toBe(true);
  });

  it("verifyAction reports expired independently of a valid signature", async () => {
    const exp = 50;
    const sig = await signAction(SECRET, "approve", "req-1", exp);
    const result = await verifyAction(
      SECRET,
      { action: "approve", id: "req-1", exp, sig },
      51_000
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});
