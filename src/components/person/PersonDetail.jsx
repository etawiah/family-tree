import { useEffect, useMemo } from "react";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";

/**
 * Modal for viewing a person's full details.
 *
 * This component is intentionally presentational so it can be reused in
 * different contexts (tree click, search results, admin panel).
 */
export default function PersonDetail({
  person,
  relationships = [],
  onClose,
  onEdit,
  onAddRelationship,
  onQuickAddChild,
  onQuickAddSpouse,
  onQuickAddParent,
  isLoading = false,
}) {
  if (!person) {
    return null;
  }

  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");

  // Keyboard navigation: Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && onClose) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Organize relationships for display - group marriages by order, detect step/half relationships
  const organizedRelationships = useMemo(() => {
    if (!relationships.length) return { marriages: [], others: [] };

    const marriages = [];
    const others = [];

    relationships.forEach((rel) => {
      if (rel.relationship_type === "spouse" || rel.relationship_type === "ex-spouse") {
        marriages.push(rel);
      } else {
        others.push(rel);
      }
    });

    // Sort marriages by relationship_order, then by marriage_date
    marriages.sort((a, b) => {
      const orderA = a.relationship_order || 0;
      const orderB = b.relationship_order || 0;
      if (orderA !== orderB) return orderA - orderB;
      const dateA = a.marriage_date ? new Date(a.marriage_date) : new Date(0);
      const dateB = b.marriage_date ? new Date(b.marriage_date) : new Date(0);
      return dateA - dateB;
    });

    return { marriages, others };
  }, [relationships]);

  // Detect half-siblings and step-relationships (simplified - would need full relationship graph for complete detection)
  const getRelationshipLabel = (rel) => {
    if (rel.relationship_type === "spouse" || rel.relationship_type === "ex-spouse") {
      const order = rel.relationship_order || 1;
      const orderLabel = order === 1 ? "1st" : order === 2 ? "2nd" : order === 3 ? "3rd" : `${order}th`;
      return `${rel.relationship_type === "ex-spouse" ? "Ex-Spouse" : "Spouse"} [${orderLabel} marriage]`;
    }
    if (!rel.is_blood_relation) {
      if (rel.relationship_type === "parent") return "Step-Parent";
      if (rel.relationship_type === "child") return "Step-Child";
      if (rel.relationship_type === "sibling") return "Step-Sibling";
    }
    return rel.relationship_type;
  };

  const formatMarriageDate = (rel) => {
    if (!rel.marriage_date) return "";
    const date = new Date(rel.marriage_date);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const formatDivorceDate = (rel) => {
    if (!rel.divorce_date) return "";
    const date = new Date(rel.divorce_date);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div
      className="modal-overlay person-detail-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal person-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header person-detail-header">
          <div>
            <h2>
              {person.first_name} {person.last_name}
            </h2>
            <p className="subtitle">
              {person.tree_side?.toUpperCase() || "UNKNOWN"} side
            </p>
          </div>
          <div className="person-detail-actions">
            {canEdit ? (
              <button type="button" className="ghost-button" onClick={onEdit}>
                Edit Person
              </button>
            ) : null}
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="modal-content">
          {isLoading ? <p>Loading details...</p> : null}
          <div className="photo-grid">
            <img
              src={person.headshot_url || "/placeholder-headshot.png"}
              alt={`${person.first_name} headshot`}
            />
            <img
              src={person.additional_photo_url || "/placeholder-photo.png"}
              alt={`${person.first_name} additional`}
            />
          </div>

          <section className="detail-section">
            <h3>Profile</h3>
            <p>Tree Side: {person.tree_side}</p>
            <p>Birth Date: {person.birth_date || "Unknown"}</p>
            <p>Death Date: {person.death_date || "N/A"}</p>
            <p>Current Location: {person.current_location || "Unknown"}</p>
            <p>Profession: {person.profession || "Unknown"}</p>
            <p>Gender: {person.gender}</p>
          </section>

          <section className="detail-section">
            <h3>Relationships</h3>
            {organizedRelationships.marriages.length > 0 ? (
              <div style={{ marginBottom: "1rem" }}>
                <h4>Marriages</h4>
                <ul>
                  {organizedRelationships.marriages.map((rel) => {
                    const isCurrent = rel.relationship_type === "spouse" && !rel.divorce_date;
                    const marriageDate = formatMarriageDate(rel);
                    const divorceDate = formatDivorceDate(rel);
                    const order = rel.relationship_order || 1;
                    const orderLabel = order === 1 ? "1st" : order === 2 ? "2nd" : order === 3 ? "3rd" : `${order}th`;
                    
                    return (
                      <li key={rel.id} style={{ marginBottom: "0.5rem" }}>
                        <strong>{getRelationshipLabel(rel)}</strong>
                        <br />
                        {rel.related_first_name} {rel.related_last_name}
                        {marriageDate && (
                          <>
                            <br />
                            <span style={{ fontSize: "0.9rem", color: "#64748b" }}>
                              Married {marriageDate}
                              {divorceDate ? `, divorced ${divorceDate}` : isCurrent ? " - present" : ""}
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {organizedRelationships.others.length > 0 ? (
              <div>
                <h4>Family</h4>
                <ul>
                  {organizedRelationships.others.map((rel) => (
                    <li key={rel.id}>
                      <strong>{getRelationshipLabel(rel)}</strong>: {rel.related_first_name} {rel.related_last_name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {relationships.length === 0 ? (
              <p>No relationships added yet.</p>
            ) : null}
          </section>

          <section className="detail-section">
            <h3>Personal Notes</h3>
            <p>{person.personal_notes || "No notes available."}</p>
          </section>
        </div>

        {canEdit ? (
          <footer className="modal-footer">
            <div className="quick-add-buttons">
              <button type="button" onClick={onQuickAddChild}>
                Add Child
              </button>
              <button type="button" onClick={onQuickAddSpouse}>
                Add Spouse
              </button>
              <button type="button" onClick={onQuickAddParent}>
                Add Parent
              </button>
            </div>
            <button type="button" onClick={onAddRelationship}>
              Add Relationship
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
