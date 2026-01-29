import { useEffect, useMemo, useState } from "react";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import FieldLabel from "../common/FieldLabel.jsx";
import * as validationRules from "../../utils/validationRules.js";

const RELATIONSHIP_TYPES = [
  { label: "Parent", value: "parent" },
  { label: "Child", value: "child" },
  { label: "Spouse", value: "spouse" },
  { label: "Ex-Spouse", value: "ex-spouse" },
  { label: "Sibling", value: "sibling" },
];

const BLOOD_DEFAULTS = {
  parent: true,
  child: true,
  sibling: true,
  spouse: false,
  "ex-spouse": false,
};

export default function RelationshipForm({
  person,
  people = [],
  onClose,
  onSuccess,
  preselectedType = "",
}) {
  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");
  const [relationshipType, setRelationshipType] = useState(preselectedType);
  const [relatedPersonId, setRelatedPersonId] = useState("");
  const [isBloodRelation, setIsBloodRelation] = useState(true);
  const [marriageDate, setMarriageDate] = useState("");
  const [divorceDate, setDivorceDate] = useState("");
  const [relationshipOrder, setRelationshipOrder] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [warning, setWarning] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const isSpouseType =
    relationshipType === "spouse" || relationshipType === "ex-spouse";
  const isExSpouse = relationshipType === "ex-spouse";

  const relatedPeople = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = people.filter((candidate) => {
      if (!candidate || candidate.id === person?.id) {
        return false;
      }
      if (term.length === 0) {
        return true;
      }
      const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
      return fullName.includes(term);
    });
    return filtered;
  }, [people, person?.id, searchTerm]);

  // Auto-detect next relationship_order for spouse relationships
  const existingSpouseRelationships = useMemo(() => {
    if (!isSpouseType || !person?.id) return [];
    // We'll fetch this from the API when the form opens
    return [];
  }, [isSpouseType, person?.id]);

  useEffect(() => {
    if (!relationshipType) {
      return;
    }
    setIsBloodRelation(BLOOD_DEFAULTS[relationshipType] ?? true);
    if (!isSpouseType) {
      setMarriageDate("");
      setDivorceDate("");
      setRelationshipOrder(1);
    } else {
      // Auto-suggest next relationship_order for spouse
      // This will be enhanced when we fetch existing relationships
      setRelationshipOrder(1);
    }
  }, [relationshipType, isSpouseType]);

  // Fetch existing spouse relationships to auto-suggest order and check for overlaps
  const [existingMarriages, setExistingMarriages] = useState([]);

  useEffect(() => {
    if (!isSpouseType || !person?.id) {
      setExistingMarriages([]);
      return;
    }
    
    const fetchExistingMarriages = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/people/${person.id}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const spouseRels = (data.relationships || []).filter(
            (rel) => rel.relationship_type === "spouse" || rel.relationship_type === "ex-spouse"
          );
          setExistingMarriages(spouseRels);
          if (spouseRels.length > 0) {
            const maxOrder = Math.max(...spouseRels.map((r) => r.relationship_order || 1));
            setRelationshipOrder(maxOrder + 1);
          } else {
            setRelationshipOrder(1);
          }
        }
      } catch (err) {
        console.error("Failed to fetch existing marriages:", err);
      }
    };
    
    fetchExistingMarriages();
  }, [isSpouseType, person?.id]);

  useEffect(() => {
    const ageWarning = getAgeWarning();
    const marriageWarning = getMarriageWarning();
    setWarning(ageWarning || marriageWarning);
  }, [relationshipType, relatedPersonId, people, person, marriageDate, relationshipOrder, existingMarriages, isSpouseType]);

  const getMarriageWarning = () => {
    if (!isSpouseType || !person?.id || !marriageDate) return "";
    
    // Check for bigamy (multiple current spouses)
    const currentSpouses = existingMarriages.filter(
      (rel) => rel.relationship_type === "spouse" && !rel.divorce_date
    );
    if (currentSpouses.length > 0 && relationshipType === "spouse") {
      return "Warning: Person has current spouse. Adding another will show bigamy. Continue?";
    }
    
    // Check for marriage date overlaps
    for (const existing of existingMarriages) {
      if (!existing.marriage_date || !existing.divorce_date) continue;
      const existingMarriage = new Date(existing.marriage_date);
      const existingDivorce = new Date(existing.divorce_date);
      const newMarriage = new Date(marriageDate);
      
      if (newMarriage >= existingMarriage && newMarriage <= existingDivorce) {
        return "Warning: Marriage date overlaps with previous marriage. Is this correct?";
      }
    }
    
    return "";
  };

  if (!person) {
    return null;
  }

  if (!canEdit) {
    return null;
  }

  /**
   * Validate relationship form using centralized validation rules
   */
  const getValidationErrors = () => {
    return validationRules.validateRelationshipForm(
      {
        relationshipType,
        relatedPersonId,
        isBloodRelation,
        marriageDate,
        divorceDate,
        relationshipOrder,
      },
      person?.id
    );
  };

  /**
   * Handle blur events for real-time validation
   */
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    let fieldError = null;

    switch (field) {
      case "relationshipType": {
        const validation = validationRules.validateRelationshipType(relationshipType);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "relatedPersonId": {
        const validation = validationRules.validateRelatedPerson(relatedPersonId, person?.id);
        fieldError = validation.valid ? null : validation.error;
        break;
      }
      case "marriageDate": {
        if (isSpouseType) {
          const validation = validationRules.validateMarriageDate(marriageDate);
          fieldError = validation.valid ? null : validation.error;
        }
        break;
      }
      case "divorceDate": {
        if (isExSpouse) {
          const validation = validationRules.validateDivorceDate(divorceDate, marriageDate);
          fieldError = validation.valid ? null : validation.error;
        }
        break;
      }
      case "relationshipOrder": {
        if (isSpouseType) {
          const validation = validationRules.validateRelationshipOrder(relationshipOrder);
          fieldError = validation.valid ? null : validation.error;
        }
        break;
      }
      default:
        break;
    }

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

  useEffect(() => {
    setErrors(getValidationErrors());
  }, [
    relationshipType,
    relatedPersonId,
    isBloodRelation,
    marriageDate,
    divorceDate,
    relationshipOrder,
    person?.id,
  ]);

  const isFormValid =
    Boolean(relationshipType && relatedPersonId) &&
    Object.keys(errors).length === 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");

    const nextErrors = getValidationErrors();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      // Mark all fields as touched to show all errors
      setTouched({
        relationshipType: true,
        relatedPersonId: true,
        isBloodRelation: true,
        marriageDate: true,
        divorceDate: true,
        relationshipOrder: true,
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/relationships`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          person_id: person.id,
          related_person_id: Number(relatedPersonId),
          relationship_type: relationshipType,
          is_blood_relation: isBloodRelation,
          marriage_date: isSpouseType ? marriageDate : null,
          divorce_date: isExSpouse ? divorceDate : null,
          relationship_order: isSpouseType ? Number(relationshipOrder) : null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create relationship.");
      }

      setStatusMessage("Relationship saved successfully.");
      setTimeout(() => {
        onSuccess?.(payload);
      }, 600);
    } catch (err) {
      setStatusMessage(err.message || "Unable to save relationship.");
    } finally {
      setIsSaving(false);
    }
  };

  function getAgeWarning() {
    if (!relationshipType || !relatedPersonId) {
      return "";
    }
    const relatedPerson = people.find(
      (candidate) => String(candidate.id) === String(relatedPersonId)
    );
    if (!relatedPerson) {
      return "";
    }
    const primaryBirth = person.birth_date ? new Date(person.birth_date) : null;
    const relatedBirth = relatedPerson.birth_date
      ? new Date(relatedPerson.birth_date)
      : null;
    if (!primaryBirth || !relatedBirth) {
      return "";
    }

    const diffYears = Math.abs(primaryBirth - relatedBirth) / (1000 * 60 * 60 * 24 * 365.25);

    if (relationshipType === "parent" && primaryBirth >= relatedBirth) {
      return "Warning: Parent appears younger than child. Please double-check dates.";
    }

    if (relationshipType === "child" && primaryBirth <= relatedBirth) {
      return "Warning: Child appears older than parent. Please double-check dates.";
    }

    if (relationshipType === "spouse" || relationshipType === "ex-spouse") {
      if (diffYears > 25) {
        return "Warning: Spouses have a large age gap. Confirm birth dates are accurate.";
      }
    }

    return "";
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal relationship-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Add Relationship</h2>
            <p className="subtitle">
              Linking for {person.first_name} {person.last_name}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <form className="relationship-form" onSubmit={handleSubmit}>
          <FieldLabel
            label="Relationship Type"
            required
            helpText="Select the type of relationship to create. Examples: Parent (mother/father), Child (son/daughter), Spouse (married partner), Sibling (brother/sister)."
            error={errors.relationshipType}
            fieldId="relationship-type"
            touched={touched.relationshipType}
          >
            {(props) => (
              <select
                value={relationshipType}
                onChange={(event) => setRelationshipType(event.target.value)}
                onBlur={() => handleBlur("relationshipType")}
                required
                {...props}
              >
                <option value="">Select relationship type...</option>
                {RELATIONSHIP_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </FieldLabel>

          {/* Related Person Field - Custom structure (search + select) */}
          <label className="form-field">
            <div className="field-header">
              <span className="field-label">Related Person</span>
              <span className="required-indicator" aria-label="required">*</span>
            </div>

            <div className="field-input-wrapper">
              <div className="related-person-group">
                <input
                  type="search"
                  id="related-person-search"
                  placeholder="Search by name (e.g., John, Smith)"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="search-input"
                  aria-label="Search for related person"
                  aria-describedby="related-person-help"
                />
                <select
                  id="related-person-select"
                  value={relatedPersonId}
                  onChange={(event) => setRelatedPersonId(event.target.value)}
                  onBlur={() => handleBlur("relatedPersonId")}
                  required
                  aria-describedby="related-person-help related-person-error"
                  aria-invalid={errors.relatedPersonId && touched.relatedPersonId ? "true" : "false"}
                  aria-required="true"
                >
                  <option value="">Select person...</option>
                  {relatedPeople.length ? (
                    relatedPeople.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.first_name} {candidate.last_name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No matches found
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div className="field-footer">
              <span id="related-person-help" className="field-hint">
                Search for and select the person to link to. You can search by first or last name. Select from the dropdown after finding the person.
              </span>
            </div>

            {errors.relatedPersonId && touched.relatedPersonId && (
              <span
                id="related-person-error"
                className="form-error"
                role="alert"
              >
                {errors.relatedPersonId}
              </span>
            )}
          </label>

          <FieldLabel
            label="Is Blood Relation"
            optional
            helpText="Check if this is a biological/blood relation. Uncheck for step-relations or adoptive relationships."
            error={errors.isBloodRelation}
            fieldId="is-blood-relation"
            touched={touched.isBloodRelation}
          >
            {(props) => (
              <input
                type="checkbox"
                checked={isBloodRelation}
                onChange={(event) => setIsBloodRelation(event.target.checked)}
                onBlur={() => setTouched((prev) => ({ ...prev, isBloodRelation: true }))}
                {...props}
              />
            )}
          </FieldLabel>

          {isSpouseType ? (
            <>
              <FieldLabel
                label="Marriage Date"
                required={isSpouseType}
                helpText="Enter the marriage date in YYYY-MM-DD format (e.g., 2010-06-20). Cannot be in the future."
                error={errors.marriageDate}
                fieldId="marriage-date"
                touched={touched.marriageDate}
              >
                {(props) => (
                  <input
                    type="date"
                    value={marriageDate}
                    onChange={(event) => setMarriageDate(event.target.value)}
                    onBlur={() => handleBlur("marriageDate")}
                    max={new Date().toISOString().split("T")[0]}
                    required={isSpouseType}
                    {...props}
                  />
                )}
              </FieldLabel>

              {isExSpouse ? (
                <FieldLabel
                  label="Divorce Date"
                  required={isExSpouse}
                  helpText="Enter the divorce date in YYYY-MM-DD format. Must be after the marriage date and not in the future."
                  error={errors.divorceDate}
                  fieldId="divorce-date"
                  touched={touched.divorceDate}
                >
                  {(props) => (
                    <input
                      type="date"
                      value={divorceDate}
                      onChange={(event) => setDivorceDate(event.target.value)}
                      onBlur={() => handleBlur("divorceDate")}
                      max={new Date().toISOString().split("T")[0]}
                      required={isExSpouse}
                      {...props}
                    />
                  )}
                </FieldLabel>
              ) : null}

              <FieldLabel
                label="Marriage Order"
                required={isSpouseType}
                helpText={`Which marriage is this? (1st, 2nd, 3rd, etc.) This person has ${existingMarriages.length} existing marriage(s). Suggested: ${relationshipOrder}`}
                error={errors.relationshipOrder}
                fieldId="relationship-order"
                touched={touched.relationshipOrder}
              >
                {(props) => (
                  <input
                    type="number"
                    min="1"
                    value={relationshipOrder}
                    onChange={(event) => setRelationshipOrder(Number(event.target.value))}
                    onBlur={() => handleBlur("relationshipOrder")}
                    required={isSpouseType}
                    {...props}
                  />
                )}
              </FieldLabel>
            </>
          ) : null}

          {warning ? <p className="form-warning">{warning}</p> : null}
          {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !isFormValid}>
              {isSaving ? "Saving..." : "Create Relationship"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
