import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import ImageUpload from "./ImageUpload.jsx";
import { API_URL, photoDisplayUrl } from "../utils/api.js";

const STORAGE_KEY = "family-tree-app-data";

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

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return defaultData;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export default function FamilyTree() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const raw = loadData();
    const data = raw.map((node) => ({
      ...node,
      data: { ...node.data, photo: photoDisplayUrl(node.data?.photo || "") || node.data?.photo },
    }));
    const container = containerRef.current;
    container.innerHTML = "";

    const chart = f3.createChart(container, data)
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
      .setCardImageField("photo");

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
        }, 100);
      })
      .setOnChange(() => {
        const updated = editTree.exportData();
        saveData(updated);
      });

    chart.updateTree({ initial: true });
    editTree.open(chart.getMainDatum());

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

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
