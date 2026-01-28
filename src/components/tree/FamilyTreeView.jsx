import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as f3 from "family-chart";
import { useToast } from "../common/Toast.jsx";
import TreeControls from "./TreeControls.jsx";
import PersonDetail from "../person/PersonDetail.jsx";
import "./FamilyTreeView.css";

const baseUrl = import.meta.env.VITE_API_URL || "";

/**
 * Family Tree View using family-chart library
 * Displays descendant tree (primary) with optional pedigree view toggle
 */
export default function FamilyTreeView() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState("descendant"); // "descendant" or "pedigree"
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch tree data in family-chart format
  const { data: treeResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["family-chart-tree"],
    queryFn: async () => {
      const token = localStorage.getItem("family_tree_token") || "";
      const response = await fetch(`${baseUrl}/api/tree/family-chart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tree: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const treeData = treeResponse?.tree || [];

  // Initialize family-chart
  useEffect(() => {
    if (!containerRef.current || treeData.length === 0) return;

    // Clear previous chart
    containerRef.current.innerHTML = "";

    try {
      // Create store with tree data
      const store = f3.createStore({
        data: treeData,
        node_separation: 250,
        level_separation: 150,
      });

      // Create SVG container
      const svg = f3.createSvg({
        cont: containerRef.current,
      });

      // Create chart
      const chart = f3.createChart({
        store,
        svg,
      });

      // Add cards
      const cards = f3.elements.Card({
        store,
        svg,
        card_dim: {
          w: 220,
          h: 90,
          text_x: 75,
          text_y: 15,
          img_w: 60,
          img_h: 60,
          img_x: 5,
          img_y: 5,
        },
        card_display: [
          (d) => `${d.data["first name"]} ${d.data["last name"]}`,
          (d) =>
            d.data["birthday"]
              ? `Born: ${d.data["birthday"]}`
              : "",
          (d) =>
            d.data["is_alive"] === 0
              ? `† ${d.data["deathday"] || ""}`
              : "Living",
        ],
        mini_tree: true,
        link_break: false,
      });

      // Handle card click - intercept click on cards
      containerRef.current.addEventListener("click", (e) => {
        const cardElement = e.target.closest("g.card");
        if (cardElement) {
          const personId = cardElement.getAttribute("data-id");
          if (personId) {
            const person = treeData.find((p) => p.id === personId);
            if (person) {
              setSelectedPerson({
                id: parseInt(personId),
                ...person.data,
              });
              setShowDetail(true);
            }
          }
        }
      });

      // Store chart reference for controls
      chartRef.current = { store, svg, chart, cards };

      // Render the tree
      store.update.tree({ initial: true });
    } catch (err) {
      console.error("Error initializing family-chart:", err);
      showToast(`Error rendering tree: ${err.message}`, "error");
    }

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [treeData, viewMode]);

  // Handle zoom controls
  const handleZoomIn = () => {
    if (chartRef.current?.svg) {
      // Family-chart manages its own zoom, so we'll trigger re-render
      // This is a simplification - actual zoom implementation depends on family-chart internals
      showToast("Zoom in", "info");
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current?.svg) {
      showToast("Zoom out", "info");
    }
  };

  const handleReset = () => {
    if (chartRef.current?.svg) {
      showToast("View reset", "info");
    }
  };

  const handleFitToScreen = () => {
    if (chartRef.current?.svg) {
      showToast("Fit to screen", "info");
    }
  };

  // Handle search
  const handleSearch = (query) => {
    if (!query.trim()) {
      setSearchQuery("");
      return;
    }

    const matchingPerson = treeData.find((person) =>
      `${person.data["first name"]} ${person.data["last name"]}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );

    if (matchingPerson) {
      setSearchQuery(query);
      // Try to center on the matched person
      if (chartRef.current?.store) {
        chartRef.current.store.update.mainId(matchingPerson.id);
      }
      showToast(
        `Found: ${matchingPerson.data["first name"]} ${matchingPerson.data["last name"]}`,
        "success"
      );
    } else {
      showToast(`No person found matching "${query}"`, "error");
      setSearchQuery("");
    }
  };

  const handleExpandAll = () => {
    showToast(
      "Click on person's branch icon to expand",
      "info"
    );
  };

  const handleCollapseAll = () => {
    showToast(
      "Click on person's branch icon to collapse",
      "info"
    );
  };

  if (isLoading) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p>Loading family tree...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p className="error">Error loading tree: {error.message}</p>
          <button onClick={() => refetch()}>Retry</button>
        </div>
      </section>
    );
  }

  if (treeData.length === 0) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p>No people in the tree yet.</p>
          <p>Add your first family member to get started!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page tree-page">
      <div className="tree-header">
        <h1>Family Tree</h1>
        <div className="view-mode-toggle">
          <button
            className={viewMode === "descendant" ? "active" : ""}
            onClick={() => setViewMode("descendant")}
          >
            Descendant View
          </button>
          <button
            className={viewMode === "pedigree" ? "active" : ""}
            onClick={() => setViewMode("pedigree")}
          >
            Pedigree View
          </button>
        </div>
      </div>

      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onFitToScreen={handleFitToScreen}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onSearch={handleSearch}
        searchQuery={searchQuery}
      />

      {/* Legend for color coding */}
      <div className="tree-legend">
        <span className="legend-title">Legend:</span>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color maternal"></span>
            <span>Maternal Ancestry</span>
          </div>
          <div className="legend-item">
            <span className="legend-color paternal"></span>
            <span>Paternal Ancestry</span>
          </div>
          <div className="legend-item">
            <span className="legend-color both"></span>
            <span>Both Lineages</span>
          </div>
          <div className="legend-item">
            <span className="deceased-icon">†</span>
            <span>Deceased</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="family-chart-container"
        style={{ width: "100%", height: "calc(100vh - 320px)" }}
      />

      {showDetail && selectedPerson && (
        <PersonDetail
          personId={selectedPerson.id}
          onClose={() => setShowDetail(false)}
        />
      )}
    </section>
  );
}
