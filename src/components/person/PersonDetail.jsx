import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";

/**
 * Modal for viewing a person's full details.
 *
 * This component is intentionally presentational so it can be reused in
 * different contexts (tree click, search results, admin panel).
 */
export default function PersonDetail({ person, relationships = [], onClose, onEdit }) {
  if (!person) {
    return null;
  }

  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <h2>
            {person.first_name} {person.last_name}
          </h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-content">
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
            <ul>
              {relationships.length ? (
                relationships.map((relationship) => (
                  <li key={relationship.id}>
                    {relationship.relationship_type} -{" "}
                    {relationship.related_first_name}{" "}
                    {relationship.related_last_name}
                  </li>
                ))
              ) : (
                <li>No relationships added yet.</li>
              )}
            </ul>
          </section>

          <section className="detail-section">
            <h3>Personal Notes</h3>
            <p>{person.personal_notes || "No notes available."}</p>
          </section>
        </div>

        {canEdit ? (
          <footer className="modal-footer">
            <button type="button" onClick={onEdit}>
              Edit Person
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
