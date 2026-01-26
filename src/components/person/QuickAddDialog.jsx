/**
 * Dialog for choosing between linking existing person or creating new person.
 */
export default function QuickAddDialog({
  relationshipType,
  onLinkExisting,
  onCreateNew,
  onClose,
}) {
  const labels = {
    child: "Add Child",
    spouse: "Add Spouse",
    parent: "Add Parent",
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal quick-add-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>{labels[relationshipType] || "Add Relationship"}</h2>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <div className="modal-content">
          <p>How would you like to add this relationship?</p>
          <div className="quick-add-choices">
            <button type="button" className="choice-button" onClick={onLinkExisting}>
              <strong>Link to Existing Person</strong>
              <p>Connect to someone already in the family tree</p>
            </button>
            <button type="button" className="choice-button" onClick={onCreateNew}>
              <strong>Create New Person & Link</strong>
              <p>Add a new person and automatically connect them</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
