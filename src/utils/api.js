/**
 * API base URL for the family-tree-app Worker.
 * Set VITE_API_URL in .env or Cloudflare Pages env to override.
 */
export const API_URL =
  import.meta.env.VITE_API_URL || "https://family-tree-app.eugene-tawiah.workers.dev";

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

/**
 * Upload a photo to the Worker; returns the public URL.
 * @param {File} file - Image file (after compression)
 * @param {(percent: number) => void} onProgress - Optional progress callback (0-100)
 * @returns {Promise<string>} Public URL of the uploaded photo
 */
/**
 * Load the family tree from the API (D1).
 * @returns {Promise<Array>} Tree array (family-chart format)
 */
export async function getTree() {
  const res = await fetch(`${API_URL}/api/tree`);
  if (!res.ok) throw new Error(`Failed to load tree (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Save the family tree to the API (D1).
 * @param {Array} tree - Tree array (family-chart format)
 */
export async function saveTree(tree) {
  const res = await fetch(`${API_URL}/api/tree`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tree),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save tree (${res.status})`);
  }
}

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
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.url) resolve(data.url);
          else reject(new Error("Invalid response: missing url"));
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("POST", url);
    xhr.send(form);
  });
}
