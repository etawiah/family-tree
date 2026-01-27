import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PersonForm from "./PersonForm.jsx";
import ErrorDisplay from "../common/ErrorDisplay.jsx";
import { useToast } from "../common/Toast.jsx";
import { apiRequest } from "../../utils/api.js";

/**
 * Page wrapper for creating a new person entry.
 */
export default function AddPersonPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (values) => {
    setError("");
    setIsSaving(true);
    try {
      await apiRequest("/api/people", {
        method: "POST",
        body: JSON.stringify(values),
      });

      // Invalidate tree and people queries so fresh data loads when navigating back
      // This provides optimistic-like experience: user sees new person immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tree"] }),
        queryClient.invalidateQueries({ queryKey: ["people"] }),
      ]);

      showToast("Person added successfully", "success");
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

  return (
    <section className="page">
      <h1>Add a person</h1>
      <p>
        Fill out the details below. Required fields are first name, last name,
        gender, and tree side.
      </p>
      <div style={{ padding: "20px", border: "2px solid red", marginBottom: "20px" }}>
        <p><strong>DEBUG: Test input below - can you type here?</strong></p>
        <input type="text" placeholder="Test typing here" />
      </div>
      <ErrorDisplay
        error={error}
        onRetry={() => {}}
        onClear={() => setError("")}
        canRetry={false}
        clearLabel="Dismiss"
      />
      <PersonForm
        initialValues={{}}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      {isSaving ? <p>Saving...</p> : null}
    </section>
  );
}
