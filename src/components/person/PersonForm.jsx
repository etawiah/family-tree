import { useEffect, useState } from "react";
import ImageUpload from "./ImageUpload.jsx";
import FieldLabel from "../common/FieldLabel.jsx";
import * as validationRules from "../../utils/validationRules.js";

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
  submitError = "",
  submitSuccess = "",
  quickAddType = null,
}) {
  const [formState, setFormState] = useState(() => ({
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
  const [touched, setTouched] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormState({
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
    // Clear error for this field when user starts editing
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /**
   * Validate single field on blur using centralized validation rules
   */
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    let fieldError = null;

    // Use validation rules for each field
    switch (field) {
      case "first_name": {
        const validation = validationRules.validateFirstName(formState.first_name);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "last_name": {
        const validation = validationRules.validateLastName(formState.last_name);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "middle_name": {
        const validation = validationRules.validateMiddleName(formState.middle_name);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "gender": {
        const validation = validationRules.validateGender(formState.gender);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "birth_date": {
        const validation = validationRules.validateBirthDate(formState.birth_date);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "death_date": {
        const validation = validationRules.validateDeathDate(
          formState.death_date,
          formState.birth_date
        );
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "current_location": {
        const validation = validationRules.validateCurrentLocation(formState.current_location);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "profession": {
        const validation = validationRules.validateProfession(formState.profession);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "personal_notes": {
        const validation = validationRules.validatePersonalNotes(formState.personal_notes);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "marriage_date": {
        const validation = validationRules.validateMarriageDate(formState.marriage_date);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "relationship_order": {
        const validation = validationRules.validateRelationshipOrder(
          formState.relationship_order
        );
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      default:
        break;
    }

    // Update errors for this field
    if (fieldError) {
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /**
   * Validate entire form using centralized validation rules
   */
  const validate = () => {
    const nextErrors = validationRules.validatePersonForm(formState);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate form and mark all fields as touched
    if (!validate()) {
      // Mark all fields as touched to show all errors
      setTouched({
        first_name: true,
        last_name: true,
        middle_name: true,
        gender: true,
        birth_date: true,
        death_date: true,
        current_location: true,
        profession: true,
        personal_notes: true,
        marriage_date: true,
        relationship_order: true,
      });

      // Focus first input element (for accessibility)
      const firstInput = document.querySelector(".person-form input, .person-form select, .person-form textarea");
      firstInput?.focus();

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
        <FieldLabel
          label="First Name"
          required
          helpText="Enter the person's legal first name as it appears on official documents. Maximum 100 characters."
          error={errors.first_name}
          fieldId="first-name"
          maxLength={100}
          currentLength={formState.first_name.length}
          touched={touched.first_name}
        >
          {(props) => (
            <input
              type="text"
              placeholder="e.g., John"
              value={formState.first_name}
              onChange={(event) => updateField("first_name", event.target.value)}
              onBlur={() => handleBlur("first_name")}
              maxLength={100}
              required
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Middle Name"
          optional
          helpText="Middle name or initial (optional). Maximum 100 characters."
          error={errors.middle_name}
          fieldId="middle-name"
          maxLength={100}
          currentLength={formState.middle_name.length}
          touched={touched.middle_name}
        >
          {(props) => (
            <input
              type="text"
              placeholder="e.g., Michael"
              value={formState.middle_name}
              onChange={(event) => updateField("middle_name", event.target.value)}
              onBlur={() => handleBlur("middle_name")}
              maxLength={100}
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Last Name"
          required
          helpText="Enter the person's legal last name as it appears on official documents. Maximum 100 characters."
          error={errors.last_name}
          fieldId="last-name"
          maxLength={100}
          currentLength={formState.last_name.length}
          touched={touched.last_name}
        >
          {(props) => (
            <input
              type="text"
              placeholder="e.g., Smith"
              value={formState.last_name}
              onChange={(event) => updateField("last_name", event.target.value)}
              onBlur={() => handleBlur("last_name")}
              maxLength={100}
              required
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Gender"
          required
          helpText="Select the person's gender. This affects how they appear in the tree visualization."
          error={errors.gender}
          fieldId="gender"
          touched={touched.gender}
        >
          {(props) => (
            <select
              value={formState.gender}
              onChange={(event) => updateField("gender", event.target.value)}
              onBlur={() => handleBlur("gender")}
              required
              {...props}
            >
              <option value="">Select gender...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          )}
        </FieldLabel>

        <FieldLabel
          label="Birth Date"
          optional
          helpText="Enter birth date in MM/DD/YYYY format (e.g., 05/15/1990). Cannot be in the future."
          error={errors.birth_date}
          fieldId="birth-date"
          touched={touched.birth_date}
        >
          {(props) => (
            <input
              type="date"
              value={formState.birth_date}
              onChange={(event) => updateField("birth_date", event.target.value)}
              onBlur={() => handleBlur("birth_date")}
              max={new Date().toISOString().split("T")[0]}
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Death Date"
          optional
          helpText="Enter death date in MM/DD/YYYY format (e.g., 03/20/2015) if deceased. Must be after birth date and not in the future."
          error={errors.death_date}
          fieldId="death-date"
          touched={touched.death_date}
        >
          {(props) => (
            <input
              type="date"
              value={formState.death_date}
              onChange={(event) => {
                const value = event.target.value;
                updateField("death_date", value);
                updateField("is_alive", value ? false : true);
              }}
              onBlur={() => handleBlur("death_date")}
              max={new Date().toISOString().split("T")[0]}
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Currently Alive"
          optional
          helpText="Uncheck if this person is deceased. A death date will be required."
          error={errors.is_alive}
          fieldId="is-alive"
          touched={touched.is_alive}
        >
          {(props) => (
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
              onBlur={() => handleBlur("is_alive")}
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Current Location"
          optional
          helpText="City and state/country where this person lives or last lived (e.g., Miami, Florida). Maximum 200 characters."
          error={errors.current_location}
          fieldId="location"
          maxLength={200}
          currentLength={formState.current_location.length}
          touched={touched.current_location}
        >
          {(props) => (
            <input
              type="text"
              placeholder="e.g., Miami, Florida"
              value={formState.current_location}
              onChange={(event) =>
                updateField("current_location", event.target.value)
              }
              onBlur={() => handleBlur("current_location")}
              maxLength={200}
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Profession"
          optional
          helpText="Current or past profession (e.g., Engineer, Teacher). Maximum 200 characters."
          error={errors.profession}
          fieldId="profession"
          maxLength={200}
          currentLength={formState.profession.length}
          touched={touched.profession}
        >
          {(props) => (
            <input
              type="text"
              placeholder="e.g., Engineer"
              value={formState.profession}
              onChange={(event) => updateField("profession", event.target.value)}
              onBlur={() => handleBlur("profession")}
              maxLength={200}
              {...props}
            />
          )}
        </FieldLabel>

        <FieldLabel
          label="Personal Notes"
          optional
          helpText="Stories, memories, characteristics, or additional biographical information. Maximum 2000 characters."
          error={errors.personal_notes}
          fieldId="personal-notes"
          maxLength={2000}
          currentLength={formState.personal_notes.length}
          touched={touched.personal_notes}
        >
          {(props) => (
            <textarea
              placeholder="Share memories, family stories, or interesting facts about this person..."
              rows={4}
              value={formState.personal_notes}
              onChange={(event) =>
                updateField("personal_notes", event.target.value)
              }
              onBlur={() => handleBlur("personal_notes")}
              maxLength={2000}
              {...props}
            />
          )}
        </FieldLabel>
      </div>

      {quickAddType === "spouse" ? (
        <div className="form-grid">
          <FieldLabel
            label="Marriage Date"
            required={quickAddType === "spouse"}
            helpText="Enter the marriage date in MM/DD/YYYY format (e.g., 06/20/2010). Cannot be in the future."
            error={errors.marriage_date}
            fieldId="marriage-date"
            touched={touched.marriage_date}
          >
            {(props) => (
              <input
                type="date"
                value={formState.marriage_date}
                onChange={(event) => updateField("marriage_date", event.target.value)}
                onBlur={() => handleBlur("marriage_date")}
                max={new Date().toISOString().split("T")[0]}
                {...props}
              />
            )}
          </FieldLabel>
          <FieldLabel
            label="Marriage Order"
            required={quickAddType === "spouse"}
            helpText="Which marriage is this? (1st, 2nd, 3rd, etc.) Defaults to 1."
            error={errors.relationship_order}
            fieldId="relationship-order"
            touched={touched.relationship_order}
          >
            {(props) => (
              <input
                type="number"
                min="1"
                value={formState.relationship_order}
                onChange={(event) => updateField("relationship_order", Number(event.target.value))}
                onBlur={() => handleBlur("relationship_order")}
                {...props}
              />
            )}
          </FieldLabel>
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
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
