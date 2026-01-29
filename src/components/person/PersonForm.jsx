import { useState, useEffect } from "react";
import ImageUpload from "./ImageUpload.jsx";

/**
 * Simple PersonForm for family-chart integration
 * Works with space-separated field names ("first name", "last name", etc.)
 */
export default function PersonForm({ initialData, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    "first name": "",
    "last name": "",
    gender: "M",
    birthday: "",
    deathday: "",
    location: "",
    profession: "",
    notes: "",
    photo: "",
  });

  const [errors, setErrors] = useState({});

  // Initialize form data from props
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handlePhotoUpload = (url) => {
    setFormData((prev) => ({
      ...prev,
      photo: url,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData["first name"]?.trim()) {
      newErrors["first name"] = "First name is required";
    }

    if (!formData["last name"]?.trim()) {
      newErrors["last name"] = "Last name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* First Name */}
      <div>
        <label htmlFor="first-name" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          First Name *
        </label>
        <input
          id="first-name"
          type="text"
          name="first name"
          value={formData["first name"]}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="John"
          style={{
            width: "100%",
            padding: "0.75rem",
            border: errors["first name"] ? "2px solid var(--color-error)" : "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        />
        {errors["first name"] && (
          <div style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {errors["first name"]}
          </div>
        )}
      </div>

      {/* Last Name */}
      <div>
        <label htmlFor="last-name" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Last Name *
        </label>
        <input
          id="last-name"
          type="text"
          name="last name"
          value={formData["last name"]}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Smith"
          style={{
            width: "100%",
            padding: "0.75rem",
            border: errors["last name"] ? "2px solid var(--color-error)" : "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        />
        {errors["last name"] && (
          <div style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {errors["last name"]}
          </div>
        )}
      </div>

      {/* Gender */}
      <div>
        <label htmlFor="gender" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        >
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
      </div>

      {/* Birthday */}
      <div>
        <label htmlFor="birthday" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Birthday
        </label>
        <input
          id="birthday"
          type="date"
          name="birthday"
          value={formData.birthday}
          onChange={handleChange}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Deathday */}
      <div>
        <label htmlFor="deathday" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Death Date (if applicable)
        </label>
        <input
          id="deathday"
          type="date"
          name="deathday"
          value={formData.deathday}
          onChange={handleChange}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Location
        </label>
        <input
          id="location"
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="New York, NY"
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Profession */}
      <div>
        <label htmlFor="profession" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Profession
        </label>
        <input
          id="profession"
          type="text"
          name="profession"
          value={formData.profession}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Engineer"
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Add any notes about this person..."
          rows={4}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </div>

      {/* Photo Upload */}
      <div>
        <ImageUpload
          label="Photo"
          imageType="headshot"
          personId={initialData?.id || null}
          onUploadComplete={handlePhotoUpload}
          initialUrl={formData.photo}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            padding: "0.75rem 1.5rem",
            border: "1px solid var(--color-border)",
            background: "transparent",
            borderRadius: "0.375rem",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: "0.75rem 1.5rem",
            background: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
            fontWeight: 500,
          }}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
