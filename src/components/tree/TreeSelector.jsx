/**
 * Tab selector for maternal vs paternal tree.
 *
 * The selected side is kept in state by the parent, ensuring a single source
 * of truth for fetching and rendering.
 */
export default function TreeSelector({ treeSide, onChange }) {
  return (
    <div className="tree-selector">
      <button
        type="button"
        className={treeSide === "maternal" ? "active" : ""}
        onClick={() => onChange("maternal")}
      >
        Maternal Tree
      </button>
      <button
        type="button"
        className={treeSide === "paternal" ? "active" : ""}
        onClick={() => onChange("paternal")}
      >
        Paternal Tree
      </button>
    </div>
  );
}
