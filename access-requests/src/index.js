import {
  expiryUnixSeconds,
  signAction,
  stripTrailingSlashes,
  verifyAction,
} from "./crypto.js";
import { validateSubmission } from "./validation.js";
import {
  fetchAccessGroup,
  listEmailsFromInclude,
  mergeEmailIntoInclude,
  putAccessGroup,
  removeEmailFromInclude,
} from "./access-group.js";
import { requireAdmin } from "./jwt.js";
import {
  adminListPage,
  confirmPage,
  forbiddenPage,
  requestAccessPage,
  resultPage,
  thankYouPage,
} from "./html.js";
import {
  buildConfirmation,
  buildRequestAlert,
  buildSignedAdminUrl,
  publicOrigin,
  sendTelegram,
} from "./telegram.js";

const GENERIC_THANKS = () => thankYouPage();

function logEvent(event, extra = {}) {
  console.log(JSON.stringify({ event, ...extra }));
}

async function readForm(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const out = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }
  return {};
}

function paramsFrom(request, form = {}) {
  const url = new URL(request.url);
  return {
    id: form.id || url.searchParams.get("id") || "",
    exp: form.exp || url.searchParams.get("exp") || "",
    sig: form.sig || url.searchParams.get("sig") || "",
    email: form.email || url.searchParams.get("email") || "",
  };
}

async function verifyTurnstile(env, token) {
  if (!env.TURNSTILE_SECRET_KEY || !token || token.length > 2048) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return Boolean(data.success);
}

async function allowSubmit(env, request) {
  const limiter = env.SUBMIT_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") return true;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const { success } = await limiter.limit({ key: ip });
    return Boolean(success);
  } catch {
    logEvent("rate_limit_error");
    return true;
  }
}

async function getRequestById(env, id) {
  return env.DB.prepare(
    "SELECT id, name, email, status, created_at FROM access_requests WHERE id = ?"
  )
    .bind(id)
    .first();
}

async function findOpenByEmail(env, email) {
  return env.DB.prepare(
    "SELECT id, status FROM access_requests WHERE email = ? AND status IN ('pending', 'approved')"
  )
    .bind(email)
    .first();
}

async function handleSubmit(request, env) {
  const thanks = GENERIC_THANKS();
  try {
    if (!(await allowSubmit(env, request))) {
      logEvent("submit_rate_limited");
      return thanks;
    }

    const form = await readForm(request);
    const turnstileOk = await verifyTurnstile(env, form["cf-turnstile-response"] || "");
    if (!turnstileOk) {
      logEvent("submit_turnstile_failed");
      return thanks;
    }

    const parsed = validateSubmission({ name: form.name, email: form.email });
    if (!parsed.ok) {
      logEvent("submit_invalid");
      return thanks;
    }

    const existing = await findOpenByEmail(env, parsed.email);
    if (existing) {
      logEvent("submit_duplicate", { id: existing.id });
      return thanks;
    }

    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(
        "INSERT INTO access_requests (id, name, email, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))"
      )
        .bind(id, parsed.name, parsed.email)
        .run();
    } catch {
      logEvent("submit_duplicate", { id });
      return thanks;
    }

    const exp = expiryUnixSeconds();
    const approveSig = await signAction(env.ACTION_SIGNING_KEY, "approve", id, exp);
    const denySig = await signAction(env.ACTION_SIGNING_KEY, "deny", id, exp);
    const origin = publicOrigin(env);
    await sendTelegram(
      env,
      buildRequestAlert({
        name: parsed.name,
        email: parsed.email,
        approveUrl: buildSignedAdminUrl(origin, "approve", { id, exp, sig: approveSig }),
        denyUrl: buildSignedAdminUrl(origin, "deny", { id, exp, sig: denySig }),
      })
    );
    logEvent("submit_created", { id });
    return thanks;
  } catch (err) {
    logEvent("submit_error");
    return thanks;
  }
}

async function requireAdminAction(request, env, action, params) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return { ok: false, response: forbiddenPage() };

  const verified = await verifyAction(env.ACTION_SIGNING_KEY, {
    action,
    id: params.id,
    exp: params.exp,
    sig: params.sig,
  });
  if (!verified.ok) return { ok: false, response: forbiddenPage() };
  return { ok: true };
}

async function handleConfirmGet(request, env, action) {
  const params = paramsFrom(request);
  const gate = await requireAdminAction(request, env, action, params);
  if (!gate.ok) return gate.response;

  const row = params.id ? await getRequestById(env, params.id) : null;
  return confirmPage({
    action,
    id: params.id,
    exp: params.exp,
    sig: params.sig,
    name: row?.name,
    email: row?.email,
    missing: !row || (action === "deny" && row.status !== "pending"),
  });
}

async function approveRequest(env, row) {
  const group = await fetchAccessGroup(env);
  const merged = mergeEmailIntoInclude(group.include, row.email);
  if (merged.changed) {
    await putAccessGroup(env, group, merged.include);
  }
  if (row.status !== "approved") {
    await env.DB.prepare("UPDATE access_requests SET status = 'approved' WHERE id = ?")
      .bind(row.id)
      .run();
  }
  return { already: row.status === "approved" && !merged.added };
}

async function handleApprovePost(request, env) {
  const params = paramsFrom(request, await readForm(request));
  const gate = await requireAdminAction(request, env, "approve", params);
  if (!gate.ok) return gate.response;

  const row = await getRequestById(env, params.id);
  if (!row) {
    return resultPage({
      title: "Already processed",
      message: "This request is no longer available.",
    });
  }

  try {
    const result = await approveRequest(env, row);
    if (!result.already) {
      await sendTelegram(env, buildConfirmation({ action: "approve", name: row.name, email: row.email, id: row.id }));
    }
    logEvent("approved", { id: row.id });
    return resultPage({
      title: "Approved",
      message: result.already
        ? "This request was already approved."
        : "The email was added to the Access group. They can now sign in with a one-time email code.",
    });
  } catch {
    logEvent("approve_error", { id: row.id });
    return resultPage({
      title: "Could not approve",
      message: "The Access group could not be updated. Try again.",
    });
  }
}

async function handleDenyPost(request, env) {
  const params = paramsFrom(request, await readForm(request));
  const gate = await requireAdminAction(request, env, "deny", params);
  if (!gate.ok) return gate.response;

  const row = await getRequestById(env, params.id);
  if (!row) {
    return resultPage({
      title: "Already processed",
      message: "This request is no longer available.",
    });
  }
  if (row.status === "approved") {
    return resultPage({
      title: "Already approved",
      message: "This request was already approved. Use revoke if you need to remove access.",
    });
  }

  await env.DB.prepare("DELETE FROM access_requests WHERE id = ?").bind(row.id).run();
  await sendTelegram(env, buildConfirmation({ action: "deny", name: row.name, email: row.email, id: row.id }));
  logEvent("denied", { id: row.id });
  return resultPage({
    title: "Denied",
    message: "The request was discarded.",
  });
}

async function handleAdminList(request, env) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return forbiddenPage();

  const pendingResult = await env.DB.prepare(
    "SELECT id, name, email, status, created_at FROM access_requests WHERE status = 'pending' ORDER BY created_at DESC"
  ).all();
  const approvedRows = await env.DB.prepare(
    "SELECT id, name, email, status, created_at FROM access_requests WHERE status = 'approved'"
  ).all();

  const nameByEmail = new Map();
  for (const row of approvedRows.results || []) {
    nameByEmail.set(row.email, row.name);
  }

  let groupEmails = [];
  try {
    const group = await fetchAccessGroup(env);
    groupEmails = listEmailsFromInclude(group.include);
  } catch {
    logEvent("admin_list_group_error");
  }

  const pending = [];
  const exp = expiryUnixSeconds();
  for (const row of pendingResult.results || []) {
    const approveSig = await signAction(env.ACTION_SIGNING_KEY, "approve", row.id, exp);
    const denySig = await signAction(env.ACTION_SIGNING_KEY, "deny", row.id, exp);
    pending.push({
      ...row,
      approveUrl: `/access-admin/approve?id=${encodeURIComponent(row.id)}&exp=${exp}&sig=${encodeURIComponent(approveSig)}`,
      denyUrl: `/access-admin/deny?id=${encodeURIComponent(row.id)}&exp=${exp}&sig=${encodeURIComponent(denySig)}`,
    });
  }

  const approved = groupEmails.map((email) => ({
    email,
    name: nameByEmail.get(email) || "",
  }));

  return adminListPage({ pending, approved });
}

async function handleRevoke(request, env) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return forbiddenPage();

  const form = await readForm(request);
  const email = String(form.email || "").trim().toLowerCase();
  if (!email) {
    return resultPage({ title: "Revoke", message: "Missing email." });
  }

  try {
    const group = await fetchAccessGroup(env);
    const next = removeEmailFromInclude(group.include, email);
    if (next.changed) {
      await putAccessGroup(env, group, next.include);
    }
    await env.DB.prepare("DELETE FROM access_requests WHERE email = ?").bind(email).run();
    if (next.removed) {
      await sendTelegram(env, buildConfirmation({ action: "revoke", email, id: "" }));
    }
    logEvent("revoked");
    return resultPage({
      title: "Revoked",
      message: next.removed ? "The email was removed from the Access group." : "That email was not in the Access group.",
    });
  } catch {
    logEvent("revoke_error");
    return resultPage({
      title: "Could not revoke",
      message: "The Access group could not be updated. Try again.",
    });
  }
}

async function purgeApproved(env) {
  const result = await env.DB.prepare(
    "DELETE FROM access_requests WHERE status = 'approved' AND created_at < datetime('now', '-30 days')"
  ).run();
  logEvent("purge_approved", { changes: result?.meta?.changes ?? 0 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = stripTrailingSlashes(url.pathname) || "/";

    if (request.method === "GET" && path === "/request-access") {
      return requestAccessPage(env.TURNSTILE_SITE_KEY);
    }
    if (request.method === "POST" && path === "/request-access/submit") {
      return handleSubmit(request, env);
    }
    if (path === "/access-admin/approve") {
      return request.method === "GET"
        ? handleConfirmGet(request, env, "approve")
        : request.method === "POST"
          ? handleApprovePost(request, env)
          : new Response("Method Not Allowed", { status: 405 });
    }
    if (path === "/access-admin/deny") {
      return request.method === "GET"
        ? handleConfirmGet(request, env, "deny")
        : request.method === "POST"
          ? handleDenyPost(request, env)
          : new Response("Method Not Allowed", { status: 405 });
    }
    if (request.method === "GET" && (path === "/access-admin" || path === "/access-admin/")) {
      return handleAdminList(request, env);
    }
    if (request.method === "POST" && path === "/access-admin/revoke") {
      return handleRevoke(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(_event, env) {
    try {
      await purgeApproved(env);
    } catch {
      logEvent("purge_error");
    }
  },
};
