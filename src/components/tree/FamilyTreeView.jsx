import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import { useToast } from "../common/Toast.jsx";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import PersonForm from "../person/PersonForm.jsx";
import "./FamilyTreeView.css";

const baseUrl = import.meta.env.VITE_API_URL || "";

function ModalOverlay({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function AddPersonModal({ isLoading, onSubmit, onCancel }) {
  return (
    <ModalOverlay onClose={onCancel}>
      <header className="modal-header">
        <h2>Add Family Member</h2>
        <button type="button" onClick={onCancel} disabled={isLoading}>
          ✕
        </button>
      </header>
      <div style={{ padding: "1.5rem" }}>
        <div className="legacy-form-note">
          Legacy bootstrap form (not part of the native EditTree UI).
        </div>
        <PersonForm
          isLegacy
          initialData={{
            "first name": "",
            "last name": "",
            gender: "M",
            birthday: "",
            deathday: "",
            location: "",
            profession: "",
            notes: "",
            photo: "",
          }}
          onSubmit={onSubmit}
          onCancel={onCancel}
          isLoading={isLoading}
        />
      </div>
    </ModalOverlay>
  );
}

export default function FamilyTreeView() {
  console.log("[FamilyTreeView] Component mounted");

  const containerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const { showToast } = useToast();

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");
  console.log("[FamilyTreeView] canEdit:", canEdit);

  const { data: treeResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["family-chart-tree"],
    queryFn: async () => {
      console.log("[FamilyTreeView] Fetching tree data");
      const token = localStorage.getItem("family_tree_token") || "";
      const response = await fetch(`${baseUrl}/api/tree/family-chart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tree: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[FamilyTreeView] Tree data fetched:", data);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const treeData = treeResponse?.tree || [];
  console.log("[FamilyTreeView] treeData:", treeData, "isLoading:", isLoading, "error:", error);

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
        console.error("Save tree error:", err);
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

  const handleAddPerson = async (formData) => {
    if (!formData["first name"]?.trim()) {
      showToast("First name is required", "error");
      return;
    }

    setIsSaving(true);
    try {
      const newPerson = {
        id: String(Date.now()),
        data: formData,
        rels: { spouses: [], children: [], parents: [] },
      };

      await persistTree([...treeData, newPerson]);
      showToast(`Added ${formData["first name"]} ${formData["last name"]}`, "success");
      setShowAddPerson(false);
      await refetch();
    } catch (err) {
      console.error("Add person error:", err);
      showToast(`Failed to add person: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    console.log("[FamilyTreeView] useEffect running - treeData.length:", treeData.length, "canEdit:", canEdit);

    if (!containerRef.current || treeData.length === 0) {
      console.log("[FamilyTreeView] Early return - no container or empty tree");
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";

    try {
      console.log("[FamilyTreeView] Creating chart");
      const chart = f3.createChart(container, treeData);
      const card = chart
        .setCardHtml()
        .setCardDisplay([["first name", "last name"], ["birthday"]]);

      if (canEdit) {
        console.log("[FamilyTreeView] Initializing editTree with native API");
        const editTree = chart
          .editTree()
          .setFields([
            "first name",
            "last name",
            "gender",
            "birthday",
            "deathday",
            "location",
            "profession",
            "notes",
            "photo",
          ])
          .setEditFirst(true) // Open edit form on card click
          .setCardClickOpen(card) // Pass the card object
          .setOnChange(() => {
            console.log("[FamilyTreeView] editTree onChange fired");
            const updated = editTree.exportData();
            queueSave(updated);
          });

        // CRITICAL: Must call .open() to activate the interactive form
        editTree.open(chart.getMainDatum());
        console.log("[FamilyTreeView] editTree activated with open()");
      }

      chart.updateTree({ initial: true });
      console.log("[FamilyTreeView] Chart rendered successfully");
    } catch (err) {
      console.error("[FamilyTreeView] Render error:", err);
      setSaveError("Failed to render tree. Please refresh the page.");
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [treeData, canEdit]);

  if (isLoading) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p>Loading family tree...</p>
        </div>
      </section>
    );
  }

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
                className="primary-button legacy-button"
                onClick={() => setShowAddPerson(true)}
                style={{ marginTop: "1rem" }}
              >
                Add First Person (Legacy)
              </button>

              {showAddPerson && (
                <AddPersonModal
                  isLoading={isSaving}
                  onSubmit={handleAddPerson}
                  onCancel={() => setShowAddPerson(false)}
                />
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="page tree-page">
      <div className="tree-header">
        <h1>Family Tree</h1>
      </div>

      {canEdit && (
        <div className="tree-helper">
          Click a person card to edit or add relatives in the native editor.
        </div>
      )}

      {saveError && (
        <div className="tree-save-error">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError("")}>
            Dismiss
          </button>
        </div>
      )}

      <div ref={containerRef} className="family-chart-container" />
    </section>
  );
}
