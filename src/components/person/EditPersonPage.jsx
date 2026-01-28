import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PersonForm from "./PersonForm.jsx";
import RelationshipForm from "../relationships/RelationshipForm.jsx";
import ErrorDisplay from "../common/ErrorDisplay.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import { useToast } from "../common/Toast.jsx";
import { apiRequest } from "../../utils/api.js";
import { useApiRequest } from "../../hooks/useApiRequest.js";

/**
 * Page wrapper for editing or deleting an existing person.
 */
export default function EditPersonPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { execute: executeDelete, loading: isDeleting, error: deleteError, retry: retryDelete, clearError: clearDeleteError, retryCount: deleteRetryCount } = useApiRequest();
  const [person, setPerson] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const canDelete = hasRequiredAccess(getAccessLevel(), "admin");
  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");

  // Reload person data (used after relationship changes)
  const loadPerson = async () => {
    try {
      const data = await apiRequest(`/api/people/${id}`);
      setPerson(data.person);
      setRelationships(data.relationships || []);
      setLoadError("");
    } catch (err) {
      const message = err.message || "Person information could not be loaded. Please refresh the page.";
      setLoadError(message);
      showToast(message, "error");
    }
  };

  useEffect(() => {
    loadPerson();
  }, [id, showToast]);

  // Helper function for ordinal suffixes (1st, 2nd, 3rd, 4th)
  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };

  // Handle adding new relationship
  const handleAddRelationship = async (relationshipData) => {
    try {
      await apiRequest("/api/relationships", {
        method: "POST",
        body: JSON.stringify(relationshipData),
      });

      showToast("Relationship added successfully", "success");
      setShowAddRelationship(false);

      // Refresh person data to show new relationship
      await loadPerson();

      // Invalidate tree queries to refresh tree view
      await queryClient.invalidateQueries({ queryKey: ["family-chart-tree"] });
      await queryClient.invalidateQueries({ queryKey: ["tree"] });
    } catch (err) {
      const message = err.message || "Unable to add relationship. Please try again.";
      showToast(message, "error");
    }
  };

  // Handle deleting relationship (admin only)
  const handleDeleteRelationship = async (relationshipId, relatedPersonName) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove the relationship with ${relatedPersonName}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await apiRequest(`/api/relationships/${relationshipId}`, {
        method: "DELETE",
      });

      showToast("Relationship removed successfully", "success");

      // Refresh person data
      await loadPerson();

      // Invalidate tree queries
      await queryClient.invalidateQueries({ queryKey: ["family-chart-tree"] });
      await queryClient.invalidateQueries({ queryKey: ["tree"] });
    } catch (err) {
      const message = err.message || "Unable to remove relationship. Please try again.";
      showToast(message, "error");
    }
  };

  const handleSubmit = async (values) => {
    setSaveError("");
    setIsSaving(true);
    try {
      await apiRequest(`/api/people/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });

      // Invalidate related queries so tree updates with new data
      // This provides fast feedback without waiting for refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["family-chart-tree"] }),
        queryClient.invalidateQueries({ queryKey: ["tree"] }),
        queryClient.invalidateQueries({ queryKey: ["people"] }),
        queryClient.invalidateQueries({ queryKey: ["person", id] }),
      ]);

      showToast("Person updated successfully", "success");
      setTimeout(() => {
        navigate("/tree");
      }, 500);
    } catch (err) {
      const message = err.message || "Unable to save person. Please check your information and try again.";
      setSaveError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/tree");
  };

  const handleDeleteClick = () => {
    if (!canDelete) {
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await executeDelete(`/api/people/${id}`, {
        method: "DELETE",
      }, true);

      // Invalidate queries so tree reflects deletion
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["family-chart-tree"] }),
        queryClient.invalidateQueries({ queryKey: ["tree"] }),
        queryClient.invalidateQueries({ queryKey: ["people"] }),
      ]);

      showToast("Person deleted successfully", "success");
      setTimeout(() => {
        navigate("/tree");
      }, 500);
    } catch (err) {
      // Error already displayed by useApiRequest hook
      setShowDeleteConfirm(false);
    }
  };

  const handleRetryDelete = async () => {
    try {
      await retryDelete(`/api/people/${id}`, {
        method: "DELETE",
      }, true);

      showToast("Person deleted successfully", "success");
      setShowDeleteConfirm(false);
      setTimeout(() => {
        navigate("/tree");
      }, 500);
    } catch (err) {
      // Error already handled
    }
  };

  if (!person) {
    return (
      <section className="page">
        <h1>Edit person</h1>
        {loadError ? (
          <ErrorDisplay
            error={loadError}
            onRetry={() => window.location.reload()}
            onClear={() => setLoadError("")}
            canRetry={true}
            retryLabel="Reload Page"
            clearLabel="Dismiss"
          />
        ) : (
          <p>Loading...</p>
        )}
      </section>
    );
  }

  return (
    <section className="page">
      <h1>
        Edit Person: {person.first_name} {person.last_name}
      </h1>
      <p>Update any details below.</p>
      <ErrorDisplay
        error={saveError}
        onRetry={() => {}}
        onClear={() => setSaveError("")}
        canRetry={false}
        clearLabel="Dismiss"
      />
      <PersonForm
        initialValues={person}
        submitLabel="Update Person"
        warnOnTreeSideChange
        hasRelationships={relationships.length > 0}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      {isSaving ? <p>Saving...</p> : null}

      {/* Relationship Management Section */}
      <section className="relationships-section">
        <h2>Relationships</h2>

        {relationships.length > 0 ? (
          <div className="relationships-list">
            {relationships.map((rel) => {
              const relatedPerson = rel.related_person_name || `Person #${rel.related_person_id}`;
              const relType = rel.relationship_type;
              const metadata = [];

              if (rel.marriage_date) metadata.push(`Married: ${rel.marriage_date}`);
              if (rel.divorce_date) metadata.push(`Divorced: ${rel.divorce_date}`);
              if (rel.relationship_order > 1)
                metadata.push(`${rel.relationship_order}${getOrdinalSuffix(rel.relationship_order)} marriage`);

              return (
                <div key={rel.id} className="relationship-card">
                  <div className="relationship-info">
                    <strong>{relatedPerson}</strong>
                    <span className="relationship-type">({relType})</span>
                    {metadata.length > 0 && (
                      <div className="relationship-metadata">
                        {metadata.join(" • ")}
                      </div>
                    )}
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleDeleteRelationship(rel.id, relatedPerson)}
                      aria-label={`Remove ${relType} relationship with ${relatedPerson}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-message">No relationships recorded yet.</p>
        )}

        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowAddRelationship(true)}
            style={{ marginTop: "1rem" }}
          >
            Add Relationship
          </button>
        )}

        {showAddRelationship && (
          <div className="modal-overlay" onClick={() => setShowAddRelationship(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <h2>Add Relationship</h2>
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setShowAddRelationship(false)}
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </header>
              <RelationshipForm
                person={person}
                onSubmit={handleAddRelationship}
                onCancel={() => setShowAddRelationship(false)}
              />
            </div>
          </div>
        )}
      </section>

      {canDelete ? (
        <div>
          <div className="button-row">
            <button
              type="button"
              className="danger-button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Person"}
            </button>
          </div>
          <ErrorDisplay
            error={deleteError}
            onRetry={handleRetryDelete}
            onClear={clearDeleteError}
            canRetry={deleteRetryCount < 2}
            retryLabel="Retry Delete"
            clearLabel="Dismiss"
          />
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            title="Delete this person?"
            message={`Are you sure you want to delete ${person.first_name} ${person.last_name}? This action cannot be undone.`}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={handleConfirmDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            isDangerous={true}
            isLoading={isDeleting}
          />
        </div>
      ) : null}
    </section>
  );
}
