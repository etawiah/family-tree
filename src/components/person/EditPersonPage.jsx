import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PersonForm from "./PersonForm.jsx";
import { getAccessLevel, getToken, hasRequiredAccess } from "../../services/auth.js";

/**
 * Page wrapper for editing or deleting an existing person.
 */
export default function EditPersonPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canDelete = hasRequiredAccess(getAccessLevel(), "admin");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/people/${id}`,
          {
            headers: {
              Authorization: `Bearer ${getToken() || ""}`,
            },
          }
        );
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload?.error || "Unable to load person.");
        }
        const data = await response.json();
        setPerson(data.person);
      } catch (err) {
        setError(err.message);
      }
    };

    load();
  }, [id]);

  const handleSubmit = async (values) => {
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/people/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken() || ""}`,
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Unable to save person.");
      }

      navigate("/tree");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
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
      <h1>Edit person</h1>
      <p>Update any details below.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <PersonForm
        initialValues={person}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/tree")}
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
