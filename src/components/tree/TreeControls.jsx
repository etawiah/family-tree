import { useState } from "react";

/**
 * Control panel for zooming, searching, and toggling tree visibility.
 */
export default function TreeControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onExpandAll,
  onCollapseAll,
  onSearch,
}) {
  const [query, setQuery] = useState("");

  const handleSearch = (event) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  return (
    <div className="tree-controls">
      <div className="button-row">
        <button type="button" onClick={onZoomIn}>
          Zoom In
        </button>
        <button type="button" onClick={onZoomOut}>
          Zoom Out
        </button>
        <button type="button" onClick={onReset}>
          Reset View
        </button>
      </div>

      <div className="button-row">
        <button type="button" onClick={onExpandAll}>
          Expand All
        </button>
        <button type="button" onClick={onCollapseAll}>
          Collapse All
        </button>
      </div>

      <form className="search-row" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Find a person by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>
    </div>
  );
}
