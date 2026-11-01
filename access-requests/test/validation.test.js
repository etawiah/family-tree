import { describe, expect, it } from "vitest";
import {
  capName,
  isAdminEmail,
  isValidEmail,
  MAX_NAME_LENGTH,
  normalizeEmail,
  validateSubmission,
} from "../src/validation.js";

describe("email validation", () => {
  it("accepts a normal address and lowercases it", () => {
    expect(isValidEmail("Ada@Example.COM")).toBe(true);
    expect(normalizeEmail(" Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("rejects empty, missing-at, and consecutive-dot addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a@b..com")).toBe(false);
    expect(isValidEmail("a@@b.com")).toBe(false);
  });

  it("rejects an oversized local-part+domain", () => {
    const tooLong = `${"a".repeat(250)}@example.com`;
    expect(isValidEmail(tooLong)).toBe(false);
  });
});

describe("name cap", () => {
  it("trims and collapses whitespace", () => {
    expect(capName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
  });

  it("caps the name at 80 characters", () => {
    const long = "n".repeat(120);
    expect(capName(long)).toHaveLength(MAX_NAME_LENGTH);
    expect(capName(long)).toBe("n".repeat(80));
  });
});

describe("validateSubmission", () => {
  it("returns normalized values for a valid payload", () => {
    expect(validateSubmission({ name: "  Jane  Doe ", email: "Jane@Family.example" })).toEqual({
      ok: true,
      name: "Jane Doe",
      email: "jane@family.example",
    });
  });

  it("rejects an empty name or invalid email", () => {
    expect(validateSubmission({ name: "   ", email: "jane@family.example" }).ok).toBe(false);
    expect(validateSubmission({ name: "Jane", email: "nope" }).ok).toBe(false);
  });
});

describe("admin emails", () => {
  it("matches a comma-separated list case-insensitively", () => {
    expect(isAdminEmail("eugene@example.com", "Eugene@Example.com, other@example.com")).toBe(true);
    expect(isAdminEmail("visitor@example.com", "eugene@example.com")).toBe(false);
    expect(isAdminEmail("", "eugene@example.com")).toBe(false);
  });

  it("matches any address at an exact @domain entry", () => {
    const allow = "@eugenetawiah.com, eugene@gmail.com";
    expect(isAdminEmail("ada@eugenetawiah.com", allow)).toBe(true);
    expect(isAdminEmail("ADA@EugeneTawiah.COM", allow)).toBe(true);
    expect(isAdminEmail("eugene@gmail.com", allow)).toBe(true);
  });

  it("does not treat @domain as a suffix match", () => {
    const allow = "@eugenetawiah.com";
    expect(isAdminEmail("ada@mail.eugenetawiah.com", allow)).toBe(false);
    expect(isAdminEmail("ada@eugenetawiah.com.evil", allow)).toBe(false);
    expect(isAdminEmail("ada@example.com", allow)).toBe(false);
    expect(isAdminEmail("eugenetawiah.com@example.com", allow)).toBe(false);
  });

  it("ignores a bare @ with no domain", () => {
    expect(isAdminEmail("ada@eugenetawiah.com", "@")).toBe(false);
  });
});
