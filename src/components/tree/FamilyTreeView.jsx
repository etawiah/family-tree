import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import { useToast } from "../common/Toast.jsx";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import PersonForm from "../person/PersonForm.jsx";
import RelationshipForm from "../relationships/RelationshipForm.jsx";
import "./FamilyTreeView.css";

const baseUrl = import.meta.env.VITE_API_URL || "";

/**
 * Modal overlay for forms
 */
function ModalOverlay({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/**
 * Add Person Modal
 */
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
        <PersonForm
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

/**
 * Edit Person Modal
 */
function EditPersonModal({
  person,
  treeData,
  isLoading,
  onSubmit,
  onAddRelationship,
  onRemoveRelationship,
  onCancel,
  canEdit,
}) {
  return (
    <ModalOverlay onClose={onCancel}>
      <header className="modal-header">
        <h2>
          Edit {person.data["first name"]} {person.data["last name"]}
        </h2>
        <button type="button" onClick={onCancel} disabled={isLoading}>
          ✕
        </button>
      </header>
      <div style={{ maxHeight: "80vh", overflowY: "auto", padding: "1.5rem" }}>
        {/* Person Form */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Personal Information</h3>
          <PersonForm
            initialData={person.data}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isLoading={isLoading}
          />
        </div>

        {/* Relationships Section */}
        {canEdit && (
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Relationships</h3>

            {/* Existing relationships */}
            {person.rels && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h4 style={{ fontSize: "0.95rem", marginBottom: "0.75rem", color: "var(--color-text-muted)" }}>
                  Connected People
                </h4>

                {/* Parents */}
                {person.rels.parents && person.rels.parents.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Parents:</div>
                    {person.rels.parents.map((parentId) => {
                      const parent = treeData.find((p) => p.id === parentId);
                      return (
                        <div
                          key={parentId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "0.5rem",
                            background: "var(--color-bg-secondary)",
                            borderRadius: "0.375rem",
                            marginBottom: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          <span>
                            {parent?.data["first name"]} {parent?.data["last name"]}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onRemoveRelationship(parentId, "parent")}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--color-error)",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Spouses */}
                {person.rels.spouses && person.rels.spouses.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Spouses:</div>
                    {person.rels.spouses.map((spouseId) => {
                      const spouse = treeData.find((p) => p.id === spouseId);
                      return (
                        <div
                          key={spouseId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "0.5rem",
                            background: "var(--color-bg-secondary)",
                            borderRadius: "0.375rem",
                            marginBottom: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          <span>
                            {spouse?.data["first name"]} {spouse?.data["last name"]}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onRemoveRelationship(spouseId, "spouse")}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--color-error)",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Children */}
                {person.rels.children && person.rels.children.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Children:</div>
                    {person.rels.children.map((childId) => {
                      const child = treeData.find((p) => p.id === childId);
                      return (
                        <div
                          key={childId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "0.5rem",
                            background: "var(--color-bg-secondary)",
                            borderRadius: "0.375rem",
                            marginBottom: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          <span>
                            {child?.data["first name"]} {child?.data["last name"]}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onRemoveRelationship(childId, "child")}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--color-error)",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Add relationship button */}
            <button
              type="button"
              onClick={() => onAddRelationship()}
              style={{
                padding: "0.75rem 1.5rem",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                width: "100%",
              }}
            >
              + Add Relationship
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

/**
 * Add Relationship Modal
 */
function AddRelationshipModal({ person, treeData, isLoading, onSubmit, onCancel }) {
  return (
    <ModalOverlay onClose={onCancel}>
      <header className="modal-header">
        <h2>Add Relationship for {person.data["first name"]}</h2>
        <button type="button" onClick={onCancel} disabled={isLoading}>
          ✕
        </button>
      </header>
      <div style={{ padding: "1.5rem" }}>
        <RelationshipForm
          person={person}
          treeData={treeData}
          onSubmit={onSubmit}
          onCancel={onCancel}
          isLoading={isLoading}
        />
      </div>
    </ModalOverlay>
  );
}

/**
 * Family Tree View using family-chart for visualization
 * Custom forms for editing
 */
export default function FamilyTreeView() {
  const containerRef = useRef(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Modal states
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showEditPerson, setShowEditPerson] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");

  // Fetch tree data
  const { data: treeResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["family-chart-tree"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("family_tree_token") || "";
        console.log("[FamilyTreeView] Fetching tree data");

        const response = await fetch(`${baseUrl}/api/tree/family-chart`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch tree: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("[FamilyTreeView] Tree loaded:", data.tree?.length || 0, "people");
        return data;
      } catch (err) {
        console.error("[FamilyTreeView] Fetch error:", err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const treeData = treeResponse?.tree || [];

  // Persist tree changes
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

  // Handle add person
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

  // Handle edit person
  const handleEditPerson = async (formData) => {
    setIsSaving(true);
    try {
      const updated = treeData.map((p) =>
        p.id === selectedPerson.id ? { ...p, data: formData } : p
      );

      await persistTree(updated);
      showToast("Person updated", "success");
      setShowEditPerson(false);
      setSelectedPerson(null);
      await refetch();
    } catch (err) {
      console.error("Edit person error:", err);
      showToast(`Failed to update person: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle add relationship
  const handleAddRelationship = async (relationshipData) => {
    setIsSaving(true);
    try {
      const { relationType, relatedPersonId } = relationshipData;

      // Update selected person's relationships
      const updatedTree = treeData.map((p) => {
        if (p.id !== selectedPerson.id) return p;

        const updated = { ...p };
        if (relationType === "spouse") {
          if (!updated.rels.spouses) updated.rels.spouses = [];
          if (!updated.rels.spouses.includes(relatedPersonId)) {
            updated.rels.spouses.push(relatedPersonId);
          }
        } else if (relationType === "child") {
          if (!updated.rels.children) updated.rels.children = [];
          if (!updated.rels.children.includes(relatedPersonId)) {
            updated.rels.children.push(relatedPersonId);
          }
        } else if (relationType === "parent") {
          if (!updated.rels.parents) updated.rels.parents = [];
          if (!updated.rels.parents.includes(relatedPersonId)) {
            updated.rels.parents.push(relatedPersonId);
          }
        }

        return updated;
      });

      // Add reverse relationship to related person
      const finalTree = updatedTree.map((p) => {
        if (p.id !== relatedPersonId) return p;

        const updated = { ...p };
        if (relationType === "spouse") {
          if (!updated.rels.spouses) updated.rels.spouses = [];
          if (!updated.rels.spouses.includes(selectedPerson.id)) {
            updated.rels.spouses.push(selectedPerson.id);
          }
        } else if (relationType === "child") {
          if (!updated.rels.parents) updated.rels.parents = [];
          if (!updated.rels.parents.includes(selectedPerson.id)) {
            updated.rels.parents.push(selectedPerson.id);
          }
        } else if (relationType === "parent") {
          if (!updated.rels.children) updated.rels.children = [];
          if (!updated.rels.children.includes(selectedPerson.id)) {
            updated.rels.children.push(selectedPerson.id);
          }
        }

        return updated;
      });

      await persistTree(finalTree);
      showToast("Relationship added", "success");
      setShowAddRelationship(false);
      await refetch();
    } catch (err) {
      console.error("Add relationship error:", err);
      showToast(`Failed to add relationship: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle remove relationship
  const handleRemoveRelationship = async (relatedPersonId, relationType) => {
    setIsSaving(true);
    try {
      const updatedTree = treeData.map((p) => {
        if (p.id === selectedPerson.id) {
          const updated = { ...p };
          if (relationType === "spouse") {
            updated.rels.spouses = updated.rels.spouses.filter((id) => id !== relatedPersonId);
          } else if (relationType === "child") {
            updated.rels.children = updated.rels.children.filter((id) => id !== relatedPersonId);
          } else if (relationType === "parent") {
            updated.rels.parents = updated.rels.parents.filter((id) => id !== relatedPersonId);
          }
          return updated;
        }
        return p;
      });

      await persistTree(updatedTree);
      showToast("Relationship removed", "success");
      await refetch();
    } catch (err) {
      console.error("Remove relationship error:", err);
      showToast(`Failed to remove relationship: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize family-chart
  useEffect(() => {
    if (!containerRef.current || treeData.length === 0) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";

    try {
      const chart = f3.createChart(container, treeData);
      chart.setCardHtml().setCardDisplay([["first name", "last name"], ["birthday"]]);

      // Handle card click
      const onCardClick = (cardData) => {
        const person = treeData.find((p) => p.id === cardData.id);
        if (person) {
          setSelectedPerson(person);
          setShowEditPerson(true);
        }
      };

      // Manual click handler since family-chart's built-in modal is broken
      container.querySelectorAll(".card").forEach((cardElement) => {
        cardElement.addEventListener("click", () => {
          const cardId = cardElement.getAttribute("data-id");
          const cardData = treeData.find((p) => p.id === cardId);
          if (cardData) {
            onCardClick(cardData);
          }
        });
      });

      chart.updateTree({ initial: true });
      console.log("[FamilyTreeView] Tree rendered successfully");
    } catch (err) {
      console.error("[FamilyTreeView] Render error:", err);
      setSaveError("Failed to render tree. Please refresh the page.");
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [treeData]);

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

  // Error state
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
                onClick={() => setShowAddPerson(true)}
                style={{ marginTop: "1rem" }}
              >
                Add First Person
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

  // Tree view
  return (
    <section className="page tree-page">
      <div className="tree-header">
        <h1>Family Tree</h1>
        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowAddPerson(true)}
          >
            + Add Person
          </button>
        )}
      </div>

      {saveError && (
        <div className="tree-save-error">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError("")}>
            Dismiss
          </button>
        </div>
      )}

      <div ref={containerRef} className="family-chart-container" />

      {/* Modals */}
      {showAddPerson && (
        <AddPersonModal
          isLoading={isSaving}
          onSubmit={handleAddPerson}
          onCancel={() => setShowAddPerson(false)}
        />
      )}

      {showEditPerson && selectedPerson && (
        <EditPersonModal
          person={selectedPerson}
          treeData={treeData}
          isLoading={isSaving}
          onSubmit={handleEditPerson}
          onAddRelationship={() => setShowAddRelationship(true)}
          onRemoveRelationship={handleRemoveRelationship}
          onCancel={() => {
            setShowEditPerson(false);
            setSelectedPerson(null);
          }}
          canEdit={canEdit}
        />
      )}

      {showAddRelationship && selectedPerson && (
        <AddRelationshipModal
          person={selectedPerson}
          treeData={treeData}
          isLoading={isSaving}
          onSubmit={handleAddRelationship}
          onCancel={() => setShowAddRelationship(false)}
        />
      )}
    </section>
  );
}
