const PUBLIC_ORIGIN = "https://family-tree.tawiah.net";

export function publicOrigin(env) {
  const fromEnv = String(env?.PUBLIC_ORIGIN || "").trim().replace(/\/+$/, "");
  return fromEnv || PUBLIC_ORIGIN;
}

export function buildSignedAdminUrl(origin, action, { id, exp, sig }) {
  const url = new URL(`/access-admin/${action}`, origin);
  url.searchParams.set("id", id);
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("sig", sig);
  return url.toString();
}

export function buildRequestAlert({ name, email, approveUrl, denyUrl }) {
  return {
    text: `Family tree access request\nName: ${name}\nEmail: ${email}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Approve", url: approveUrl },
          { text: "Deny", url: denyUrl },
        ],
      ],
    },
  };
}

export function buildConfirmation({ action, name, email, id }) {
  if (action === "approve") {
    return { text: `Approved access for ${name} <${email}>` };
  }
  if (action === "deny") {
    return { text: `Denied access request ${id}` };
  }
  if (action === "revoke") {
    return { text: `Revoked access for <${email}>` };
  }
  return { text: `Updated request ${id}` };
}

export async function sendTelegram(env, payload) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error(JSON.stringify({ event: "telegram_skipped" }));
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      disable_web_page_preview: true,
      ...payload,
    }),
  });
  if (!res.ok) {
    console.error(JSON.stringify({ event: "telegram_error", status: res.status }));
    return false;
  }
  return true;
}
