export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LAYOUT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #f4f4f5;
    color: #18181b;
    line-height: 1.5;
  }
  main {
    width: min(28rem, calc(100% - 2rem));
    margin: 2rem auto;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    padding: 1.5rem;
  }
  h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
  p { margin: 0 0 1rem; }
  label { display: block; font-weight: 600; margin: 0.85rem 0 0.35rem; }
  input[type=text], input[type=email] {
    width: 100%;
    padding: 0.7rem 0.75rem;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    font: inherit;
  }
  button, .btn {
    display: inline-block;
    width: 100%;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border: 0;
    border-radius: 8px;
    background: #18181b;
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
  }
  button.secondary { background: #52525b; }
  button.danger { background: #b91c1c; }
  .cf-turnstile { margin-top: 1rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.45rem 0.25rem; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  .muted { color: #52525b; font-size: 0.95rem; }
  form.inline { display: inline; }
  form.inline button { width: auto; margin: 0; padding: 0.35rem 0.7rem; font-size: 0.85rem; }
`;

export function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <style>${LAYOUT_CSS}</style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function htmlResponse(title, body, status = 200) {
  return new Response(page(title, body), {
    status,
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function requestAccessPage(siteKey) {
  const key = escapeHtml(siteKey || "");
  return htmlResponse(
    "Request access",
    `<h1>Request access</h1>
     <p>Eugene reviews requests, and once approved you sign in at family-tree.tawiah.net with a one-time code sent to your email.</p>
     <form method="post" action="/request-access/submit">
       <label for="name">Name</label>
       <input id="name" name="name" type="text" maxlength="80" required autocomplete="name">
       <label for="email">Email</label>
       <input id="email" name="email" type="email" maxlength="254" required autocomplete="email">
       <div class="cf-turnstile" data-sitekey="${key}"></div>
       <button type="submit">Submit request</button>
     </form>
     <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
  );
}

export function thankYouPage() {
  return htmlResponse(
    "Request received",
    `<h1>Thank you</h1>
     <p>If access is approved, sign in at <a href="https://family-tree.tawiah.net">family-tree.tawiah.net</a> with the one-time code sent to your email.</p>`
  );
}

export function confirmPage({ action, id, exp, sig, name, email, missing }) {
  const verb = action === "deny" ? "Deny" : "Approve";
  const title = `${verb} access request`;
  if (missing) {
    return htmlResponse(
      title,
      `<h1>${escapeHtml(verb)}</h1>
       <p>This request is no longer pending. It may already have been approved or denied.</p>
       <p><a class="btn" href="/access-admin/">Back to requests</a></p>`
    );
  }
  return htmlResponse(
    title,
    `<h1>${escapeHtml(verb)} this request?</h1>
     <p><strong>Name:</strong> ${escapeHtml(name)}<br>
        <strong>Email:</strong> ${escapeHtml(email)}</p>
     <p class="muted">This page is a confirmation step so link previews cannot trigger the action.</p>
     <form method="post" action="/access-admin/${escapeHtml(action)}">
       <input type="hidden" name="id" value="${escapeHtml(id)}">
       <input type="hidden" name="exp" value="${escapeHtml(exp)}">
       <input type="hidden" name="sig" value="${escapeHtml(sig)}">
       <button type="submit" class="${action === "deny" ? "danger" : ""}">Confirm ${escapeHtml(verb.toLowerCase())}</button>
     </form>
     <p><a href="/access-admin/">Cancel</a></p>`
  );
}

export function resultPage({ title, message }) {
  return htmlResponse(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p>${escapeHtml(message)}</p>
     <p><a class="btn" href="/access-admin/">Back to requests</a></p>`
  );
}

export function adminListPage({ pending, approved }) {
  const pendingRows = pending.length
    ? pending
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.email)}</td>
            <td>${escapeHtml(row.created_at)}</td>
            <td>
              <a href="${escapeHtml(row.approveUrl)}">Approve</a>
              ·
              <a href="${escapeHtml(row.denyUrl)}">Deny</a>
            </td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No pending requests.</td></tr>`;

  const approvedRows = approved.length
    ? approved
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.email)}</td>
            <td>${escapeHtml(row.name || "")}</td>
            <td>
              <form class="inline" method="post" action="/access-admin/revoke">
                <input type="hidden" name="email" value="${escapeHtml(row.email)}">
                <button type="submit" class="danger">Revoke</button>
              </form>
            </td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="muted">No approved emails in the Access group.</td></tr>`;

  return htmlResponse(
    "Access requests",
    `<h1>Access requests</h1>
     <h2>Pending</h2>
     <table>
       <thead><tr><th>Name</th><th>Email</th><th>Requested</th><th></th></tr></thead>
       <tbody>${pendingRows}</tbody>
     </table>
     <h2>Approved emails</h2>
     <table>
       <thead><tr><th>Email</th><th>Name</th><th></th></tr></thead>
       <tbody>${approvedRows}</tbody>
     </table>`
  );
}

export function forbiddenPage() {
  return htmlResponse("Forbidden", `<h1>Forbidden</h1><p>You do not have access.</p>`, 403);
}
