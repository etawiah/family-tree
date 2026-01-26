import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonForm from "./PersonForm.jsx";
import { getToken } from "../../services/auth.js";

/**
 * Page wrapper for creating a new person entry.
 */
export default function AddPersonPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (values) => {
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/people`,
        {
          method: "POST",
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

  return (
    <section className="page">
      <h1>Add a person</h1>
      <p>
        Fill out the details below. Required fields are first name, last name,
        gender, and tree side.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <PersonForm onSubmit={handleSubmit} onCancel={() => navigate("/tree")} />
      {isSaving ? <p>Saving...</p> : null}
    </section>
  );
}
