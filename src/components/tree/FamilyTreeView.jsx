import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import { useToast } from "../common/Toast.jsx";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import "./FamilyTreeView.css";

const baseUrl = import.meta.env.VITE_API_URL || "";

/**
 * Modal for adding the first person to an empty tree
 */
function AddFirstPersonModal({ isLoading, onSubmit, onCancel }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("M");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(firstName, lastName, gender);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Add First Family Member</h2>
          <button type="button" onClick={onCancel} disabled={isLoading}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="first-name" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
              First Name *
            </label>
            <input
              id="first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              disabled={isLoading}
              autoFocus
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--color-border)",
                borderRadius: "0.375rem",
                fontSize: "1rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="last-name" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
              Last Name
            </label>
            <input
              id="last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--color-border)",
                borderRadius: "0.375rem",
                fontSize: "1rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label htmlFor="gender" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--color-border)",
                borderRadius: "0.375rem",
                fontSize: "1rem",
              }}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid var(--color-border)",
                background: "transparent",
                borderRadius: "0.375rem",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Family Tree View using native family-chart integration.
 * The chart owns its editing UX and persistence via exportData().
 */
export default function FamilyTreeView() {
  const containerRef = useRef(null);
  const editTreeRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState("");
  const [showAddFirstPerson, setShowAddFirstPerson] = useState(false);
  const [addPersonLoading, setAddPersonLoading] = useState(false);
  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");

  // Fetch tree data from backend in family-chart format
  const { data: treeResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["family-chart-tree"],
    queryFn: async () => {
      const token = localStorage.getItem("family_tree_token") || "";
      const response = await fetch(`${baseUrl}/api/tree/family-chart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tree: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const treeData = treeResponse?.tree || [];

  const persistTree = async (nextTree) => {
    const token = localStorage.getItem("family_tree_token") || "";
    const response = await fetch(`${baseUrl}/api/tree/family-chart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tree: nextTree }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || response.statusText);
    }
  };

  const queueSave = (nextTree) => {
    if (saveInFlightRef.current) {
      pendingSaveRef.current = nextTree;
      return;
    }

    saveInFlightRef.current = true;
    persistTree(nextTree)
      .then(() => setSaveError(""))
      .catch((err) => {
        setSaveError(err.message || "Failed to save tree.");
        showToast(`Failed to save tree: ${err.message}`, "error");
      })
      .finally(() => {
        saveInFlightRef.current = false;
        if (pendingSaveRef.current) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          queueSave(pending);
        }
      });
  };

  const handleAddFirstPerson = async (firstName, lastName, gender) => {
    if (!firstName.trim()) {
      showToast("Please enter a first name", "error");
      return;
    }

    setAddPersonLoading(true);
    try {
      // Create minimal person object
      const newPerson = {
        id: String(Date.now()), // Temporary ID, will be assigned by backend
        data: {
          "first name": firstName.trim(),
          "last name": lastName.trim(),
          "gender": gender || "M",
          "birthday": "",
          "deathday": "",
          "location": "",
          "profession": "",
          "notes": "",
          "photo": "",
        },
        rels: {
          spouses: [],
          children: [],
          parents: [],
        },
      };

      // Save the single person as a tree
      await persistTree([newPerson]);
      console.log("[FamilyTreeView] First person created:", firstName, lastName);
      showToast(`Created ${firstName} ${lastName}`, "success");
      setShowAddFirstPerson(false);

      // Refetch tree
      await refetch();
    } catch (err) {
      console.error("[FamilyTreeView] Failed to add first person:", err);
      showToast(`Failed to add person: ${err.message}`, "error");
    } finally {
      setAddPersonLoading(false);
    }
  };

  // Initialize family-chart library using the native API
  useEffect(() => {
    if (!containerRef.current || treeData.length === 0) {
      console.log("[FamilyTreeView] Skipping init:", {
        hasContainer: !!containerRef.current,
        treeDataLength: treeData.length,
      });
      return;
    }

    console.log("[FamilyTreeView] Initializing family-chart with", treeData.length, "people");
    console.log("[FamilyTreeView] canEdit:", canEdit);

    try {
      const container = containerRef.current;
      container.innerHTML = "";

      // Create chart
      const chart = f3.createChart(container, treeData);
      console.log("[FamilyTreeView] Chart created successfully");

      // Set card display
      const card = chart
        .setCardHtml()
        .setCardDisplay([["first name", "last name"], ["birthday"]]);
      console.log("[FamilyTreeView] Card HTML set");

      // Create edit tree with error handling
      let editTree;
      try {
        editTree = chart.editTree();
        console.log("[FamilyTreeView] editTree created");
      } catch (err) {
        console.error("[FamilyTreeView] Failed to create editTree:", err);
        setSaveError("Failed to initialize edit mode. Please refresh the page.");
        return;
      }

      // Configure edit tree
      try {
        editTree
          .setFields([
            { type: "text", label: "First name", id: "first name" },
            { type: "text", label: "Last name", id: "last name" },
            {
              type: "select",
              label: "Gender",
              id: "gender",
              options: [
                { label: "Male", value: "M" },
                { label: "Female", value: "F" },
              ],
            },
            { type: "text", label: "Birthday", id: "birthday" },
            { type: "text", label: "Deathday", id: "deathday" },
            { type: "text", label: "Location", id: "location" },
            { type: "text", label: "Profession", id: "profession" },
            { type: "textarea", label: "Notes", id: "notes" },
            { type: "text", label: "Photo", id: "photo" },
          ])
          .setCanEdit(canEdit)
          .setCanAdd(canEdit)
          .setCanDelete(canEdit);
        console.log("[FamilyTreeView] Fields configured, canEdit:", canEdit);

        // Set card click to open editor
        editTree.setCardClickOpen(card);
        console.log("[FamilyTreeView] Card click handler set");

        // Set change listener
        editTree.setOnChange(() => {
          console.log("[FamilyTreeView] Change detected, saving...");
          if (!canEdit) {
            console.log("[FamilyTreeView] User cannot edit, skipping save");
            return;
          }
          const updated = editTree.exportData();
          queueSave(updated);
        });
        console.log("[FamilyTreeView] Change listener set");
      } catch (err) {
        console.error("[FamilyTreeView] Failed to configure editTree:", err);
        setSaveError("Failed to configure editor. Please refresh the page.");
        return;
      }

      editTreeRef.current = editTree;

      // Update tree to render
      try {
        chart.updateTree({ initial: true });
        console.log("[FamilyTreeView] Tree rendered successfully");
      } catch (err) {
        console.error("[FamilyTreeView] Failed to update tree:", err);
        setSaveError("Failed to render tree. Please refresh the page.");
        return;
      }
    } catch (err) {
      console.error("[FamilyTreeView] Unexpected error during initialization:", err);
      setSaveError(`Failed to initialize tree: ${err.message}`);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      editTreeRef.current = null;
    };
  }, [treeData, canEdit]);

  // Loading state
  if (isLoading) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p>Loading family tree...</p>
        </div>
      </section>
    );
  }

  // API error
  if (error) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p className="error">Error loading tree: {error.message}</p>
          <button onClick={() => refetch()}>Retry</button>
        </div>
      </section>
    );
  }

  // Empty tree
  if (treeData.length === 0) {
    return (
      <section className="page tree-page">
        <div className="tree-header">
          <h1>Family Tree</h1>
        </div>

        <div className="empty-state">
          <p>No people in the tree yet.</p>
          <p>Add your first family member to get started.</p>

          {canEdit && (
            <>
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowAddFirstPerson(true)}
                style={{ marginTop: "1rem" }}
              >
                Add First Person
              </button>

              {showAddFirstPerson && (
                <AddFirstPersonModal
                  isLoading={addPersonLoading}
                  onSubmit={handleAddFirstPerson}
                  onCancel={() => setShowAddFirstPerson(false)}
                />
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  // Tree view
  return (
    <section className="page tree-page">
      <div className="tree-header">
        <h1>Family Tree</h1>
      </div>

      {canEdit ? (
        <div className="tree-helper">
          Click a person card to edit or add relatives.
        </div>
      ) : null}

      {saveError && (
        <div className="tree-save-error">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError("")}>
            Dismiss
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="family-chart-container"
        style={{ width: "100%", height: "calc(100vh - 220px)" }}
      />
    </section>
  );
}
