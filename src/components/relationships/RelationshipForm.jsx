import { useState } from "react";

/**
 * Simple RelationshipForm for family-chart integration
 * Allows adding relationships between people
 */
export default function RelationshipForm({
  person,
  treeData,
  onSubmit,
  onCancel,
  isLoading,
}) {
  const [relationType, setRelationType] = useState("spouse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Filter candidates
  const candidates = (treeData || [])
    .filter((p) => p.id !== person.id) // Can't link to self
    .filter((p) => {
      const fullName = `${p.data["first name"]} ${p.data["last name"]}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedPerson) {
      return;
    }

    onSubmit({
      relationType,
      relatedPersonId: selectedPerson.id,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Relationship Type */}
      <div>
        <label htmlFor="relationship-type" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Relationship Type
        </label>
        <select
          id="relationship-type"
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
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
          <option value="spouse">Spouse</option>
          <option value="child">Child</option>
          <option value="parent">Parent</option>
          <option value="sibling">Sibling</option>
        </select>
      </div>

      {/* Search for Person */}
      <div>
        <label htmlFor="search" style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
          Find Person
        </label>
        <input
          id="search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading}
          placeholder="Search by name..."
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

      {/* Search Results */}
      {candidates.length > 0 && (
        <div style={{ maxHeight: "250px", overflowY: "auto" }}>
          <div style={{ fontWeight: 500, marginBottom: "0.75rem", color: "var(--color-text-muted)" }}>
            {candidates.length} result{candidates.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                onClick={() => setSelectedPerson(candidate)}
                style={{
                  padding: "0.75rem",
                  border: selectedPerson?.id === candidate.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  background: selectedPerson?.id === candidate.id ? "var(--color-primary-light, #f0f4ff)" : "var(--color-bg-secondary)",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontWeight: 500 }}>
                  {candidate.data["first name"]} {candidate.data["last name"]}
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  {candidate.data.birthday ? `Born: ${candidate.data.birthday}` : ""}
                  {candidate.data.profession && ` • ${candidate.data.profession}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {searchQuery && candidates.length === 0 && (
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", padding: "1rem", textAlign: "center" }}>
          No matching people found. Try a different search.
        </div>
      )}

      {/* Selection Info */}
      {selectedPerson && (
        <div style={{ padding: "1rem", background: "var(--color-bg-secondary)", borderRadius: "0.375rem" }}>
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
            Selected:
          </div>
          <div style={{ fontWeight: 500 }}>
            {selectedPerson.data["first name"]} {selectedPerson.data["last name"]}
          </div>
        </div>
      )}

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
          disabled={isLoading || !selectedPerson}
          style={{
            padding: "0.75rem 1.5rem",
            background: !selectedPerson ? "var(--color-text-muted)" : "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: isLoading || !selectedPerson ? "not-allowed" : "pointer",
            opacity: isLoading || !selectedPerson ? 0.6 : 1,
            fontWeight: 500,
          }}
        >
          {isLoading ? "Adding..." : "Add Relationship"}
        </button>
      </div>
    </form>
  );
}
