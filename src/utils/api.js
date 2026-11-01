/**
 * API base URL. Empty string = same-origin relative `/api/...`
 * (production: family-tree.tawiah.net behind Cloudflare Access).
 * Set VITE_API_URL in .env for a local Worker (e.g. http://localhost:8787).
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "";

export const ACCESS_SESSION_EXPIRED = "AccessSessionExpired";

const ACCESS_RELOAD_KEY = "family-tree-access-reload";

/** Legacy public R2 hostname; stored photo URLs are rewritten to /api/photo/:file. */
const R2_PHOTO_ORIGIN = "https://family-tree-photos.family-tree.tawiah.net";

/**
 * Photos are served by the Worker at /api/photo/:filename (R2 bucket is private).
 * Rewrite any stored R2 public URL to the Worker URL so existing uploads still load.
 */
export function photoDisplayUrl(storedUrl) {
  if (!storedUrl || typeof storedUrl !== "string") return storedUrl;
  if (storedUrl.startsWith(R2_PHOTO_ORIGIN + "/")) {
    const filename = storedUrl.slice(R2_PHOTO_ORIGIN.length + 1).split("?")[0];
    if (filename) return `${API_URL}/api/photo/${filename}`;
  }
  return storedUrl;
}

function isHtmlContentType(value) {
  return typeof value === "string" && value.toLowerCase().includes("text/html");
}

function looksLikeHtml(body) {
  if (!body || typeof body !== "string") return false;
  const trimmed = body.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

function looksLikeAccessChallenge(body, contentType) {
  if (!isHtmlContentType(contentType) && !looksLikeHtml(body)) return false;
  const text = (body || "").toLowerCase();
  return (
    text.includes("cloudflareaccess") ||
    text.includes("cloudflare access") ||
    text.includes("cf_authorization") ||
    text.includes("cdn-cgi/access")
  );
}

/**
 * Reload so Cloudflare Access can re-authenticate. Guard against a loop when
 * pages.dev previews get HTML (no API) instead of an Access challenge.
 */
function reloadForAccessSession() {
  if (typeof window === "undefined") {
    const err = new Error("Access session expired");
    err.name = ACCESS_SESSION_EXPIRED;
    throw err;
  }
  try {
    if (sessionStorage.getItem(ACCESS_RELOAD_KEY) === "1") {
      sessionStorage.removeItem(ACCESS_RELOAD_KEY);
      throw new Error(
        "Could not reach the API. Open https://family-tree.tawiah.net — pages.dev previews cannot call the Access-protected API."
      );
    }
    sessionStorage.setItem(ACCESS_RELOAD_KEY, "1");
  } catch (err) {
    if (err?.name === ACCESS_SESSION_EXPIRED) throw err;
    if (err instanceof Error && err.message.startsWith("Could not reach the API")) throw err;
  }
  window.location.reload();
  const err = new Error("Access session expired");
  err.name = ACCESS_SESSION_EXPIRED;
  throw err;
}

function clearAccessReloadGuard() {
  try {
    sessionStorage.removeItem(ACCESS_RELOAD_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
}

function throwIfAccessRedirect(res) {
  if (!res) return;
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    reloadForAccessSession();
  }
  const contentType = res.headers.get("content-type") || "";
  if (isHtmlContentType(contentType)) {
    reloadForAccessSession();
  }
}

function throwIfAccessBody(body, contentType) {
  if (looksLikeAccessChallenge(body, contentType) || looksLikeHtml(body)) {
    reloadForAccessSession();
  }
}

/**
 * Same-origin fetch that sends the CF_Authorization cookie.
 * Reloads if Cloudflare Access redirects or returns its login HTML.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    redirect: "manual",
  });
  throwIfAccessRedirect(res);
  return res;
}

/**
 * Load the family tree from the API (D1).
 * @returns {Promise<Array>} Tree array (family-chart format)
 */
export async function getTree() {
  const res = await apiFetch("/api/tree");
  if (!res.ok) throw new Error(`Failed to load tree (${res.status})`);
  const text = await res.text();
  throwIfAccessBody(text, res.headers.get("content-type") || "");
  clearAccessReloadGuard();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Failed to load tree (invalid response)");
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Save the family tree to the API (D1).
 * @param {Array} tree - Tree array (family-chart format)
 */
export async function saveTree(tree) {
  const res = await apiFetch("/api/tree", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tree),
  });
  const text = await res.text();
  throwIfAccessBody(text, res.headers.get("content-type") || "");
  if (!res.ok) {
    let err = {};
    try {
      err = JSON.parse(text);
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(err.error || `Failed to save tree (${res.status})`);
  }
  clearAccessReloadGuard();
}

/**
 * Upload a photo to the Worker; returns the public URL.
 * @param {File} file - Image file (after compression)
 * @param {(percent: number) => void} onProgress - Optional progress callback (0-100)
 * @returns {Promise<string>} Public URL of the uploaded photo
 */
export async function uploadPhoto(file, onProgress) {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${API_URL}/api/upload`;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 300 && xhr.status < 400) {
        try {
          reloadForAccessSession();
        } catch (err) {
          reject(err);
        }
        return;
      }
      const contentType = xhr.getResponseHeader("content-type") || "";
      const body = xhr.responseText || "";
      if (looksLikeAccessChallenge(body, contentType) || looksLikeHtml(body)) {
        try {
          reloadForAccessSession();
        } catch (err) {
          reject(err);
        }
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(body);
          if (data.url) {
            clearAccessReloadGuard();
            resolve(data.url);
          } else reject(new Error("Invalid response: missing url"));
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        try {
          const err = JSON.parse(body);
          reject(new Error(err.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.send(form);
  });
}
