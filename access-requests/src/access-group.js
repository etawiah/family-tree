import { normalizeEmail } from "./validation.js";

export function emailFromRule(rule) {
  const value = rule?.email?.email;
  if (typeof value !== "string") return null;
  return normalizeEmail(value);
}

/**
 * GET-then-PUT merge: add an email include rule, preserve other rules, and
 * drop duplicate email rules (case-insensitive).
 */
export function mergeEmailIntoInclude(include, email) {
  const normalized = normalizeEmail(email);
  const existing = Array.isArray(include) ? include : [];
  const next = [];
  const seen = new Set();
  let alreadyPresent = false;

  for (const rule of existing) {
    const ruleEmail = emailFromRule(rule);
    if (ruleEmail) {
      if (seen.has(ruleEmail)) continue;
      seen.add(ruleEmail);
      if (ruleEmail === normalized) alreadyPresent = true;
    }
    next.push(rule);
  }

  if (!alreadyPresent && normalized) {
    next.push({ email: { email: normalized } });
    return { include: next, changed: true, added: true };
  }

  return {
    include: next,
    changed: next.length !== existing.length,
    added: false,
  };
}

/**
 * Remove an email include rule (case-insensitive) and drop leftover email dupes.
 */
export function removeEmailFromInclude(include, email) {
  const normalized = normalizeEmail(email);
  const existing = Array.isArray(include) ? include : [];
  const next = [];
  const seen = new Set();
  let removed = false;

  for (const rule of existing) {
    const ruleEmail = emailFromRule(rule);
    if (ruleEmail === normalized) {
      removed = true;
      continue;
    }
    if (ruleEmail) {
      if (seen.has(ruleEmail)) {
        removed = true;
        continue;
      }
      seen.add(ruleEmail);
    }
    next.push(rule);
  }

  return { include: next, changed: removed || next.length !== existing.length, removed };
}

export function listEmailsFromInclude(include) {
  const existing = Array.isArray(include) ? include : [];
  const emails = [];
  const seen = new Set();
  for (const rule of existing) {
    const email = emailFromRule(rule);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function groupHasEmail(include, email) {
  const normalized = normalizeEmail(email);
  return listEmailsFromInclude(include).includes(normalized);
}

export function buildGroupPutBody(group, include) {
  return {
    name: group.name,
    include,
    exclude: Array.isArray(group.exclude) ? group.exclude : [],
    require: Array.isArray(group.require) ? group.require : [],
  };
}

export function accessGroupUrl(accountId, groupId) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/groups/${groupId}`;
}

export async function fetchAccessGroup(env) {
  const res = await fetch(accessGroupUrl(env.CF_ACCOUNT_ID, env.ACCESS_GROUP_ID), {
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.result) {
    throw new Error("access_group_get_failed");
  }
  return data.result;
}

export async function putAccessGroup(env, group, include) {
  const res = await fetch(accessGroupUrl(env.CF_ACCOUNT_ID, env.ACCESS_GROUP_ID), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGroupPutBody(group, include)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error("access_group_put_failed");
  }
  return data.result;
}

