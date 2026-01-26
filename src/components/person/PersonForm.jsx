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
    });
  }, [initialValues]);

  const updateField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formState.first_name) {
      nextErrors.first_name = "First name is required.";
    }
    if (!formState.last_name) {
      nextErrors.last_name = "Last name is required.";
    }
    if (!formState.gender) {
      nextErrors.gender = "Gender is required.";
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
          First name
          <input
            value={formState.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
          />
          {errors.first_name ? (
            <span className="form-error">{errors.first_name}</span>
          ) : null}
        </label>

        <label className="form-field">
          Middle name
          <input
            value={formState.middle_name}
            onChange={(event) => updateField("middle_name", event.target.value)}
          />
        </label>

        <label className="form-field">
          Last name
          <input
            value={formState.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
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
          Gender
          <select
            value={formState.gender}
            onChange={(event) => updateField("gender", event.target.value)}
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
            value={formState.current_location}
            onChange={(event) =>
              updateField("current_location", event.target.value)
            }
          />
        </label>

        <label className="form-field">
          Profession
          <input
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
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
