import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import { useToast } from "../common/Toast.jsx";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import "./FamilyTreeView.css";

const baseUrl = import.meta.env.VITE_API_URL || "";

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

  // Initialize family-chart library using the native API
  useEffect(() => {
    if (!containerRef.current || treeData.length === 0) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";

    const chart = f3.createChart(container, treeData);
    const card = chart
      .setCardHtml()
      .setCardDisplay([["first name", "last name"], ["birthday"]]);

    const editTree = chart
      .editTree()
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
      .setCanDelete(canEdit)
      .setCardClickOpen(card)
      .setOnChange(() => {
        if (!canEdit) return;
        const updated = editTree.exportData();
        queueSave(updated);
      });

    editTreeRef.current = editTree;
    chart.updateTree({ initial: true });

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
        <div className="empty-state">
          <p>No people in the tree yet.</p>
          <p>Add your first family member using the chart editor.</p>
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
