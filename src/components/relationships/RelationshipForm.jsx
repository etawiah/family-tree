import { useEffect, useMemo, useState } from "react";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";

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
  treeSide,
  people = [],
  onClose,
  onSuccess,
}) {
  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");
  const [relationshipType, setRelationshipType] = useState("");
  const [relatedPersonId, setRelatedPersonId] = useState("");
  const [isBloodRelation, setIsBloodRelation] = useState(true);
  const [marriageDate, setMarriageDate] = useState("");
  const [divorceDate, setDivorceDate] = useState("");
  const [relationshipOrder, setRelationshipOrder] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState({});
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

  const formatTreeSide = (value) => {
    if (!value) {
      return "";
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  useEffect(() => {
    if (!relationshipType) {
      return;
    }
    setIsBloodRelation(BLOOD_DEFAULTS[relationshipType] ?? true);
    if (!isSpouseType) {
      setMarriageDate("");
      setDivorceDate("");
      setRelationshipOrder(1);
    }
  }, [relationshipType, isSpouseType]);

  useEffect(() => {
    setWarning(getAgeWarning());
  }, [relationshipType, relatedPersonId, people, person]);

  if (!person) {
    return null;
  }

  if (!canEdit) {
    return null;
  }

  const getValidationErrors = () => {
    const nextErrors = {};

    if (!relationshipType) {
      nextErrors.relationshipType = "Select a relationship type.";
    }

    if (!relatedPersonId) {
      nextErrors.relatedPersonId = "Select a related person.";
    }

    if (String(relatedPersonId) === String(person.id)) {
      nextErrors.relatedPersonId = "You cannot relate a person to themselves.";
    }

    if (isSpouseType && !marriageDate) {
      nextErrors.marriageDate = "Marriage date is required.";
    }

    if (isExSpouse && !divorceDate) {
      nextErrors.divorceDate = "Divorce date is required.";
    }

    if (isExSpouse && marriageDate && divorceDate) {
      const marriage = new Date(marriageDate);
      const divorce = new Date(divorceDate);
      if (marriage > divorce) {
        nextErrors.divorceDate = "Divorce date must be after marriage date.";
      }
    }

    if (isSpouseType && (!relationshipOrder || relationshipOrder < 1)) {
      nextErrors.relationshipOrder = "Marriage order must be 1 or higher.";
    }

    return nextErrors;
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
          tree_side: treeSide || person.tree_side,
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
          <label className="form-row">
            Relationship Type
            <select
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value)}
            >
              <option value="">Select type</option>
              {RELATIONSHIP_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.relationshipType ? (
              <span className="form-error">{errors.relationshipType}</span>
            ) : null}
          </label>

          <label className="form-row">
            Related Person
            <input
              type="search"
              placeholder="Search by name"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select
              value={relatedPersonId}
              onChange={(event) => setRelatedPersonId(event.target.value)}
            >
              <option value="">Select person</option>
              {relatedPeople.length ? (
                relatedPeople.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.first_name} {candidate.last_name} (Tree:{" "}
                    {formatTreeSide(candidate.tree_side || treeSide)})
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No matches found
                </option>
              )}
            </select>
            {errors.relatedPersonId ? (
              <span className="form-error">{errors.relatedPersonId}</span>
            ) : null}
          </label>

          <label className="form-row checkbox-row">
            <input
              type="checkbox"
              checked={isBloodRelation}
              onChange={(event) => setIsBloodRelation(event.target.checked)}
            />
            Is blood relation
          </label>

          {isSpouseType ? (
            <>
              <label className="form-row">
                Marriage Date
                <input
                  type="date"
                  value={marriageDate}
                  onChange={(event) => setMarriageDate(event.target.value)}
                />
                {errors.marriageDate ? (
                  <span className="form-error">{errors.marriageDate}</span>
                ) : null}
              </label>

              {isExSpouse ? (
                <label className="form-row">
                  Divorce Date
                  <input
                    type="date"
                    value={divorceDate}
                    onChange={(event) => setDivorceDate(event.target.value)}
                  />
                  {errors.divorceDate ? (
                    <span className="form-error">{errors.divorceDate}</span>
                  ) : null}
                </label>
              ) : null}

              <label className="form-row">
                Marriage Order (1st, 2nd, etc.)
                <input
                  type="number"
                  min="1"
                  value={relationshipOrder}
                  onChange={(event) => setRelationshipOrder(Number(event.target.value))}
                />
                {errors.relationshipOrder ? (
                  <span className="form-error">{errors.relationshipOrder}</span>
                ) : null}
              </label>
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
