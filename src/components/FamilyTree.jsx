import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import ImageUpload from "./ImageUpload.jsx";
import { API_URL, getTree, photoDisplayUrl, saveTree } from "../utils/api.js";

const STORAGE_KEY = "family-tree-app-data";
const SAVE_DEBOUNCE_MS = 400;

const defaultData = [
  {
    id: "1",
    data: {
      gender: "M",
      "first name": "Eugene",
      "middle name": "",
      "last name": "Tawiah",
      birthday: "1985",
      deathday: "",
      location: "Accra",
      profession: "Developer",
      notes: "Sample entry",
      photo: "",
    },
    rels: { parents: [], spouses: [], children: [] },
  },
];

function getLocalTree() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [];
}

const APP_URL = import.meta.env.VITE_APP_URL || "https://family-tree.tawiah.net";

export default function FamilyTree() {
  const containerRef = useRef(null);
  const [treeData, setTreeData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const saveTimeoutRef = useRef(null);

  // Load tree from API; if empty and localStorage has data, upload it (one-time migration)
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53e3d4a7-e895-4c1a-a9aa-dfd44319e82e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FamilyTree.jsx:load-effect',message:'Tree load effect start',data:{},timestamp:Date.now(),hypothesisId:'H1,H4,H5'})}).catch(()=>{});
    // #endregion
    (async () => {
      try {
        let data = await getTree();
        if (!cancelled && data.length === 0) {
          const local = getLocalTree();
          if (local.length > 0) {
            await saveTree(local);
            data = local;
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch (_) {}
          }
        }
        if (!cancelled) {
          const final = data.length > 0 ? data : defaultData;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/53e3d4a7-e895-4c1a-a9aa-dfd44319e82e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FamilyTree.jsx:setTreeData',message:'Setting tree data from API',data:{dataLength:data.length,finalLength:final.length,usingDefault:data.length===0},timestamp:Date.now(),hypothesisId:'H1,H4'})}).catch(()=>{});
          // #endregion
          final.forEach((node) => {
            if (node.data && typeof node.data.photo === "string" && node.data.photo) {
              const rewritten = photoDisplayUrl(node.data.photo);
              if (rewritten) node.data.photo = rewritten;
            }
          });
          setTreeData(final);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || "";
          const isUnauthorized = msg.includes("401") || msg.toLowerCase().includes("unauthorized");
          const isWrongGateway = msg.includes("HTML") || msg.includes("Worker");
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/53e3d4a7-e895-4c1a-a9aa-dfd44319e82e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FamilyTree.jsx:getTree-catch',message:'getTree failed',data:{errMessage:msg,isUnauthorized,isWrongGateway},timestamp:Date.now(),hypothesisId:'H3,H5'})}).catch(()=>{});
          // #endregion
          if (isUnauthorized) {
            setLoadError("unauthorized");
          } else if (isWrongGateway) {
            setLoadError("wrong_gateway");
          } else {
            setTreeData(defaultData);
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When tree data is ready, create chart (data layer only; chart behavior unchanged)
  useEffect(() => {
    if (!containerRef.current || treeData === null) return;

    const container = containerRef.current;
    container.innerHTML = "";

    const chart = f3.createChart(container, treeData)
      .setCardXSpacing(250)
      .setCardYSpacing(150)
      .setTransitionTime(1000)
      .setOrientationVertical();

    const card = chart
      .setCardHtml()
      .setCardDisplay([
        ["first name", "middle name", "last name"],
        ["location"],
        ["birthday", "deathday"],
      ])
      .setCardImageField("photo")
      .setCardInnerHtmlCreator((d) => {
        const data = d.data?.data ?? {};
        const isAdd = d.data?.to_add;
        const isUnknown = d.data?.unknown;
        const isNewRel = d.data?._new_rel_data;
        const photo = data.photo;
        const name = [data["first name"], data["middle name"], data["last name"]].filter(Boolean).join(" ") || "";
        const location = data.location ?? "";
        const birthDeath = [data.birthday, data.deathday].filter(Boolean).join(" – ") || "";
        const notes = (data.notes ?? "").toString();
        const escapedNotes = notes
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        if (isNewRel) {
          const rel = d.data._new_rel_data;
          const attrs = [`data-rel-type="${(rel.rel_type || "").replace(/"/g, "&quot;")}"`];
          if (["son", "daughter"].includes(rel.rel_type))
            attrs.push(`data-other-parent-id="${(rel.other_parent_id || "").replace(/"/g, "&quot;")}"`);
          return `<div class="card-inner card-image-rect"><div class="card-label"><div ${attrs.join(" ")}>${(rel.label || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div></div>`;
        }
        if (isAdd) {
          return `<div class="card-inner card-image-rect"><div class="card-label"><div>ADD</div></div></div>`;
        }
        if (isUnknown) {
          return `<div class="card-inner card-image-rect"><div class="card-label"><div>UNKNOWN</div></div></div>`;
        }
        const imgHtml = photo
          ? `<img src="${photo.replace(/"/g, "&quot;")}" style="position: relative;">`
          : `<div class="person-icon" style="position: relative;"></div>`;
        const duplicateTag = d.duplicate ? `<div class="f3-card-duplicate-tag">x${d.duplicate}</div>` : "";
        return `
<div class="card-inner card-image-rect">
  ${imgHtml}
  <div class="card-label">
    <div>${name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <div>${(location || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <div>${(birthDeath || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <div class="card-notes-wrap">
      <div class="card-notes-label">Notes &amp; Bio</div>
      <div class="card-notes-view">${escapedNotes || "\u00A0"}</div>
    </div>
  </div>
  ${duplicateTag}
</div>`;
      });

    const editTree = chart
      .editTree()
      .setFields([
        "first name",
        "middle name",
        "last name",
        "gender",
        "birthday",
        "deathday",
        "location",
        "profession",
        "notes",
        "photo",
      ])
      .setEditFirst(false)
      .setCardClickOpen(card)
      .setCanEdit(() => true)
      .setCanAdd(() => true)
      .setCanDelete(() => true)
      .setOnFormCreation(({ cont, form_creator }) => {
        // Customize the photo field to use ImageUpload component
        // Wait a bit for family-chart to finish creating the form
        setTimeout(() => {
          const photoInput = cont.querySelector('input[name="photo"]');
          if (photoInput && photoInput.type === 'text') {
            const fieldContainer = photoInput.closest('.input-field') || photoInput.parentElement;
            if (fieldContainer) {
              // Get current photo value
              const currentPhoto = photoInput.value || "";
              const displayUrl = photoDisplayUrl(currentPhoto);

              // Create a container for the ImageUpload component
              const uploadContainer = document.createElement('div');
              uploadContainer.style.marginTop = '0.5rem';
              
              // Create React root and render ImageUpload
              const root = createRoot(uploadContainer);
              root.render(
                <ImageUpload
                  label="Photo"
                  initialUrl={displayUrl || currentPhoto}
                  inputId="photo-upload"
                  apiUrl={API_URL}
                  onUploadComplete={(urlOrDataUrl) => {
                    if (!urlOrDataUrl || typeof urlOrDataUrl !== "string") {
                      console.error("Invalid photo value received:", urlOrDataUrl);
                      return;
                    }
                    photoInput.value = urlOrDataUrl;
                    // Trigger input event (more reliable than change for programmatic updates)
                    photoInput.dispatchEvent(new Event('input', { bubbles: true }));
                    photoInput.dispatchEvent(new Event('change', { bubbles: true }));
                    // Also trigger blur to ensure family-chart processes it
                    photoInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    // Force form to recognize the change
                    const form = photoInput.closest('form');
                    if (form) {
                      form.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                  onRemove={() => {
                    photoInput.value = '';
                    photoInput.dispatchEvent(new Event('input', { bubbles: true }));
                    photoInput.dispatchEvent(new Event('change', { bubbles: true }));
                  }}
                />
              );
              
              // Hide the text input and add our upload component
              photoInput.style.display = 'none';
              fieldContainer.appendChild(uploadContainer);
            }
          }

          // Customize the Notes field: replace text input with 5-row textarea, change label to "Notes & Bio"
          const notesInput = cont.querySelector('input[name="notes"]');
          if (notesInput && notesInput.type === 'text') {
            const notesFieldContainer = notesInput.closest('.input-field') || notesInput.parentElement;
            if (notesFieldContainer) {
              const currentNotes = notesInput.value || '';
              
              // Update label text to "Notes & Bio"
              const label = notesFieldContainer.querySelector('label[for="notes"], label');
              if (label) {
                label.textContent = 'Notes & Bio';
              }

              // Create textarea to replace the input
              const textarea = document.createElement('textarea');
              textarea.name = 'notes';
              textarea.id = notesInput.id || 'notes';
              textarea.value = currentNotes;
              textarea.rows = 5;
              textarea.style.width = '100%';
              textarea.style.minHeight = '5em';
              textarea.style.resize = 'vertical';
              textarea.style.overflowY = 'auto';
              textarea.style.padding = '0.5rem';
              textarea.style.fontFamily = 'inherit';
              textarea.style.fontSize = 'inherit';
              textarea.style.border = notesInput.style.border || '1px solid #ccc';
              textarea.style.borderRadius = '0.25rem';
              
              // Copy any other attributes that might be needed
              if (notesInput.required) textarea.required = true;
              if (notesInput.placeholder) textarea.placeholder = notesInput.placeholder;

              // Event handlers to ensure family-chart recognizes changes
              textarea.addEventListener('input', (e) => {
                e.stopPropagation();
                const form = textarea.closest('form');
                if (form) {
                  form.dispatchEvent(new Event('input', { bubbles: true }));
                }
              });
              textarea.addEventListener('change', (e) => {
                e.stopPropagation();
                const form = textarea.closest('form');
                if (form) {
                  form.dispatchEvent(new Event('change', { bubbles: true }));
                }
              });
              textarea.addEventListener('blur', (e) => {
                e.stopPropagation();
                const form = textarea.closest('form');
                if (form) {
                  form.dispatchEvent(new Event('blur', { bubbles: true }));
                }
              });

              // Replace the input with textarea
              notesInput.parentNode.replaceChild(textarea, notesInput);
            }
          }
        }, 100);
      })
      .setOnChange(() => {
        const updated = editTree.exportData();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveTree(updated).catch(() => {});
          saveTimeoutRef.current = null;
        }, SAVE_DEBOUNCE_MS);
      });

    chart.updateTree({ initial: true });

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [treeData]);

  if (loadError === "unauthorized") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "rgb(33, 33, 33)",
          color: "#fff",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: "1.1rem" }}>You need to sign in to view the family tree.</p>
        <a
          href={APP_URL}
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#6366f1",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Go to sign in
        </a>
      </div>
    );
  }

  if (loadError === "wrong_gateway") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "rgb(33, 33, 33)",
          color: "#fff",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: "1.1rem" }}>
          This address is not going through the login. The domain may be pointing to Pages instead of the Worker.
        </p>
        <p style={{ margin: 0, fontSize: "0.95rem", color: "#94a3b8" }}>
          In Cloudflare: remove the custom domain from the Pages project and attach it only to the family-tree-app Worker (Settings → Triggers → Custom domains).
        </p>
        <a
          href={APP_URL}
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#6366f1",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open app URL
        </a>
      </div>
    );
  }

  if (treeData === null) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: "900px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(33, 33, 33)",
          color: "#fff",
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="f3"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "900px",
        display: "flex",
        background: "rgb(33, 33, 33)",
        color: "#fff",
      }}
    />
  );
}
