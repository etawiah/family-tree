import { useEffect, useState } from "react";
import ImageUpload from "./ImageUpload.jsx";

/**
 * Form for creating or editing a person record.
 *
 * Includes client-side validation and image compression to reduce upload size.
 */
export default function PersonForm({
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = "Save Person",
  warnOnTreeSideChange = false,
  hasRelationships = false,
  submitError = "",
  submitSuccess = "",
  quickAddType = null,
}) {
  const [formState, setFormState] = useState(() => ({
    tree_side: initialValues.tree_side || "maternal",
    first_name: initialValues.first_name || "",
    middle_name: initialValues.middle_name || "",
    last_name: initialValues.last_name || "",
    birth_date: initialValues.birth_date || "",
    death_date: initialValues.death_date || "",
    is_alive: initialValues.is_alive ?? true,
    current_location: initialValues.current_location || "",
    profession: initialValues.profession || "",
    personal_notes: initialValues.personal_notes || "",
    gender: initialValues.gender || "other",
    headshot_url: initialValues.headshot_url || "",
    additional_photo_url: initialValues.additional_photo_url || "",
    marriage_date: initialValues.marriage_date || "",
    relationship_order: initialValues.relationship_order || 1,
  }));

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormState({
      tree_side: initialValues.tree_side || "maternal",
      first_name: initialValues.first_name || "",
      middle_name: initialValues.middle_name || "",
      last_name: initialValues.last_name || "",
      birth_date: initialValues.birth_date || "",
      death_date: initialValues.death_date || "",
      is_alive: initialValues.is_alive ?? true,
      current_location: initialValues.current_location || "",
      profession: initialValues.profession || "",
      personal_notes: initialValues.personal_notes || "",
      gender: initialValues.gender || "other",
      headshot_url: initialValues.headshot_url || "",
      additional_photo_url: initialValues.additional_photo_url || "",
      marriage_date: initialValues.marriage_date || "",
      relationship_order: initialValues.relationship_order || 1,
    });
  }, [initialValues]);

  const updateField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formState.first_name?.trim()) {
      nextErrors.first_name = "First name is required.";
    }
    if (!formState.last_name?.trim()) {
      nextErrors.last_name = "Last name is required.";
    }
    if (!formState.gender) {
      nextErrors.gender = "Gender is required.";
    }
    
    // Date validation
    if (formState.birth_date && formState.death_date) {
      const birth = new Date(formState.birth_date);
      const death = new Date(formState.death_date);
      if (death < birth) {
        nextErrors.death_date = "Death date must be after birth date.";
      }
    }
    
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        ...formState,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="person-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          First name <span style={{ color: "#ef4444" }}>*</span>
          <input
            type="text"
            value={formState.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            required
          />
          {errors.first_name ? (
            <span className="form-error">{errors.first_name}</span>
          ) : null}
        </label>

        <label className="form-field">
          Middle name
          <input
            type="text"
            value={formState.middle_name}
            onChange={(event) => updateField("middle_name", event.target.value)}
          />
        </label>

        <label className="form-field">
          Last name <span style={{ color: "#ef4444" }}>*</span>
          <input
            type="text"
            value={formState.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            required
          />
          {errors.last_name ? (
            <span className="form-error">{errors.last_name}</span>
          ) : null}
        </label>

        <label className="form-field">
          Tree side
          <select
            value={formState.tree_side}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (
                warnOnTreeSideChange &&
                hasRelationships &&
                initialValues.tree_side &&
                initialValues.tree_side !== nextValue
              ) {
                const confirmed = window.confirm(
                  "This person has relationships. Changing tree side may cause issues. Continue?"
                );
                if (!confirmed) {
                  return;
                }
              }
              updateField("tree_side", nextValue);
            }}
          >
            <option value="maternal">Maternal</option>
            <option value="paternal">Paternal</option>
          </select>
        </label>

        <label className="form-field">
          Gender <span style={{ color: "#ef4444" }}>*</span>
          <select
            value={formState.gender}
            onChange={(event) => updateField("gender", event.target.value)}
            required
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {errors.gender ? (
            <span className="form-error">{errors.gender}</span>
          ) : null}
        </label>

        <label className="form-field">
          Birth date
          <input
            type="date"
            value={formState.birth_date}
            onChange={(event) => updateField("birth_date", event.target.value)}
          />
        </label>

        <label className="form-field">
          Death date
          <input
            type="date"
            value={formState.death_date}
            onChange={(event) => {
              const value = event.target.value;
              updateField("death_date", value);
              updateField("is_alive", value ? false : true);
            }}
          />
          {errors.death_date ? (
            <span className="form-error">{errors.death_date}</span>
          ) : null}
        </label>

        <label className="form-field checkbox">
          <input
            type="checkbox"
            checked={formState.is_alive}
            onChange={(event) => {
              const checked = event.target.checked;
              updateField("is_alive", checked);
              if (checked) {
                updateField("death_date", "");
              }
            }}
          />
          Currently alive
        </label>

        <label className="form-field">
          Location
          <input
            type="text"
            value={formState.current_location}
            onChange={(event) =>
              updateField("current_location", event.target.value)
            }
          />
        </label>

        <label className="form-field">
          Profession
          <input
            type="text"
            value={formState.profession}
            onChange={(event) => updateField("profession", event.target.value)}
          />
        </label>

        <label className="form-field">
          Personal notes
          <textarea
            rows={4}
            value={formState.personal_notes}
            onChange={(event) =>
              updateField("personal_notes", event.target.value)
            }
          />
        </label>
      </div>

      {quickAddType === "spouse" ? (
        <div className="form-grid">
          <label className="form-field">
            Marriage Date
            <input
              type="date"
              value={formState.marriage_date}
              onChange={(event) => updateField("marriage_date", event.target.value)}
            />
          </label>
          <label className="form-field">
            Marriage Order (1st, 2nd, etc.)
            <input
              type="number"
              min="1"
              value={formState.relationship_order}
              onChange={(event) => updateField("relationship_order", Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}

      <div className="photo-upload">
        <ImageUpload
          label="Headshot"
          imageType="headshot"
          personId={initialValues.id}
          initialUrl={formState.headshot_url}
          onUploadComplete={(url) => updateField("headshot_url", url)}
          onRemove={() => updateField("headshot_url", "")}
        />
        <ImageUpload
          label="Additional photo"
          imageType="additional"
          personId={initialValues.id}
          initialUrl={formState.additional_photo_url}
          onUploadComplete={(url) => updateField("additional_photo_url", url)}
          onRemove={() => updateField("additional_photo_url", "")}
        />
      </div>

      {submitError ? <p className="form-error">{submitError}</p> : null}
      {submitSuccess ? <p className="form-success">{submitSuccess}</p> : null}

      <div className="button-row">
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </button>
        {onCancel ? (
          <button 
            type="button" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }} 
            disabled={isSaving}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
