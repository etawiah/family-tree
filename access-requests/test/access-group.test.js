import { describe, expect, it } from "vitest";
import {
  buildGroupPutBody,
  emailFromRule,
  groupHasEmail,
  listEmailsFromInclude,
  mergeEmailIntoInclude,
  removeEmailFromInclude,
} from "../src/access-group.js";

const everyone = { everyone: {} };
const domain = { email_domain: { domain: "tawiah.net" } };

describe("mergeEmailIntoInclude", () => {
  it("adds an email rule to an empty include list", () => {
    const result = mergeEmailIntoInclude([], "Ada@Example.com");
    expect(result).toEqual({
      include: [{ email: { email: "ada@example.com" } }],
      changed: true,
      added: true,
    });
  });

  it("preserves non-email rules and appends the new email", () => {
    const result = mergeEmailIntoInclude([everyone, domain], "ada@example.com");
    expect(result.added).toBe(true);
    expect(result.include).toEqual([
      everyone,
      domain,
      { email: { email: "ada@example.com" } },
    ]);
  });

  it("is case-insensitive and does not add a duplicate", () => {
    const include = [{ email: { email: "ada@example.com" } }, everyone];
    const result = mergeEmailIntoInclude(include, "ADA@example.com");
    expect(result.added).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.include).toEqual(include);
  });

  it("dedupes existing email rules while adding a new one", () => {
    const include = [
      { email: { email: "one@example.com" } },
      { email: { email: "ONE@example.com" } },
      everyone,
    ];
    const result = mergeEmailIntoInclude(include, "two@example.com");
    expect(result.added).toBe(true);
    expect(result.include).toEqual([
      { email: { email: "one@example.com" } },
      everyone,
      { email: { email: "two@example.com" } },
    ]);
  });

  it("treats a missing include as an empty list", () => {
    expect(mergeEmailIntoInclude(undefined, "ada@example.com").include).toEqual([
      { email: { email: "ada@example.com" } },
    ]);
  });
});

describe("removeEmailFromInclude", () => {
  it("removes the matching email and keeps other rules", () => {
    const include = [
      everyone,
      { email: { email: "ada@example.com" } },
      { email: { email: "other@example.com" } },
    ];
    const result = removeEmailFromInclude(include, "ADA@example.com");
    expect(result.removed).toBe(true);
    expect(result.include).toEqual([everyone, { email: { email: "other@example.com" } }]);
  });

  it("is a no-op when the email is not present", () => {
    const include = [everyone];
    const result = removeEmailFromInclude(include, "missing@example.com");
    expect(result.removed).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.include).toEqual(include);
  });

  it("drops duplicate copies of the same email", () => {
    const include = [
      { email: { email: "ada@example.com" } },
      { email: { email: "ADA@example.com" } },
    ];
    const result = removeEmailFromInclude(include, "ada@example.com");
    expect(result.removed).toBe(true);
    expect(result.include).toEqual([]);
  });
});

describe("include helpers", () => {
  it("lists unique emails and checks membership", () => {
    const include = [
      { email: { email: "Ada@Example.com" } },
      { email: { email: "ada@example.com" } },
      everyone,
    ];
    expect(listEmailsFromInclude(include)).toEqual(["ada@example.com"]);
    expect(groupHasEmail(include, "ADA@example.com")).toBe(true);
    expect(groupHasEmail(include, "other@example.com")).toBe(false);
    expect(emailFromRule(everyone)).toBeNull();
  });

  it("builds a PUT body that keeps name, exclude, and require", () => {
    const group = {
      name: "Family tree visitors",
      include: [],
      exclude: [domain],
      require: [],
    };
    expect(buildGroupPutBody(group, [{ email: { email: "ada@example.com" } }])).toEqual({
      name: "Family tree visitors",
      include: [{ email: { email: "ada@example.com" } }],
      exclude: [domain],
      require: [],
    });
  });
});
