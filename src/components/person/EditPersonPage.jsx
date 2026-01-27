import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PersonForm from "./PersonForm.jsx";
import { getAccessLevel, getToken, hasRequiredAccess } from "../../services/auth.js";
import { useToast } from "../common/Toast.jsx";
import { apiRequest } from "../../utils/api.js";

/**
 * Page wrapper for editing or deleting an existing person.
 */
export default function EditPersonPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [person, setPerson] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canDelete = hasRequiredAccess(getAccessLevel(), "admin");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiRequest(`/api/people/${id}`);
        setPerson(data.person);
        setRelationships(data.relationships || []);
      } catch (err) {
        const message = err.message || "Person information could not be loaded. Please refresh the page.";
        setError(message);
        showToast(message, "error");
      }
    };

    load();
  }, [id, showToast]);

  const handleSubmit = async (values) => {
    setError("");
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
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/tree");
  };

  const handleDelete = async () => {
    if (!canDelete) {
      return;
    }
    const confirmed = window.confirm("Delete this person? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/people/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken() || ""}`,
        },
      }
    );

    if (!response.ok) {
      const payload = await response.json();
      setError(payload?.error || "Unable to delete person.");
      return;
    }

    navigate("/tree");
  };

  if (!person) {
    return (
      <section className="page">
        <h1>Edit person</h1>
        {error ? <p className="form-error">{error}</p> : <p>Loading...</p>}
      </section>
    );
  }

  return (
    <section className="page">
      <h1>
        Edit Person: {person.first_name} {person.last_name}
      </h1>
      <p>Update any details below.</p>
      {error ? <p className="form-error">{error}</p> : null}
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
        <div className="button-row">
          <button type="button" className="danger-button" onClick={handleDelete}>
            Delete Person
          </button>
        </div>
      ) : null}
    </section>
  );
}
