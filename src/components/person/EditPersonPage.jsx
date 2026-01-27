import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PersonForm from "./PersonForm.jsx";
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
  const { execute: executeDelete, loading: isDeleting, error: deleteError, retry: retryDelete, clearError: clearDeleteError, retryCount: deleteRetryCount } = useApiRequest();
  const [person, setPerson] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canDelete = hasRequiredAccess(getAccessLevel(), "admin");

  useEffect(() => {
    const load = async () => {
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

    load();
  }, [id, showToast]);

  const handleSubmit = async (values) => {
    setSaveError("");
    setIsSaving(true);
    try {
      await apiRequest(`/api/people/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });

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
