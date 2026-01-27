import { useState } from "react";

/**
 * Control panel for zooming, searching, and toggling tree visibility.
 */
export default function TreeControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onFitToScreen,
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
        {onFitToScreen ? (
          <button type="button" onClick={onFitToScreen}>
            Fit to Screen
          </button>
        ) : null}
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
          id="person-search"
          type="search"
          placeholder="Find a person by name (Press / to focus)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          title="Search for a person by name. Tip: Press / to focus this field"
        />
        <button type="submit">Search</button>
      </form>
    </div>
  );
}
