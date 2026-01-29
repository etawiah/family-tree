import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState("descendant"); // "descendant" or "pedigree"
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [personDetailData, setPersonDetailData] = useState(null);
  const [personDetailLoading, setPersonDetailLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomTransform, setZoomTransform] = useState({ x: 0, y: 0, k: 1 });

  // Fetch tree data in family-chart format
  const { data: treeResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["family-chart-tree"],
    queryFn: async () => {
      const token = localStorage.getItem("family_tree_token") || "";
      console.log("[FamilyTreeView] Fetching tree from:", `${baseUrl}/api/tree/family-chart`);
      console.log("[FamilyTreeView] Token present:", !!token);

      const response = await fetch(`${baseUrl}/api/tree/family-chart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("[FamilyTreeView] API response status:", response.status);

      if (!response.ok) {
        console.error("[FamilyTreeView] API error:", response.statusText);
        throw new Error(`Failed to fetch tree: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[FamilyTreeView] Tree data received:", data);
      console.log("[FamilyTreeView] Tree length:", data.tree?.length || 0);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const treeData = treeResponse?.tree || [];

  // Helper function to apply zoom transform to SVG
  // Defined before useEffect to avoid dependency issues
  // Using useRef to avoid circular dependency issues
  const applyZoomTransformRef = useRef(null);
  applyZoomTransformRef.current = (level, transformOverride = null) => {
    if (chartRef.current?.svg) {
      try {
        // Find the main group element that contains the tree
        const svgElement = chartRef.current.svg;
        const mainGroup = svgElement.querySelector('g') || svgElement.firstElementChild;
        if (mainGroup) {
          const currentTransform = mainGroup.getAttribute('transform') || '';
          // Extract existing translate values if any, or use provided transform
          const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
          const t = transformOverride || zoomTransform;
          const translate = translateMatch ? translateMatch[1].split(',').map(Number) : [t.x, t.y];
          mainGroup.setAttribute('transform', `translate(${translate[0]},${translate[1]}) scale(${level})`);
        }
      } catch (err) {
        console.warn("Error applying zoom transform:", err);
      }
    }
  };
  
  const applyZoomTransform = useCallback((level, transformOverride = null) => {
    if (applyZoomTransformRef.current) {
      applyZoomTransformRef.current(level, transformOverride);
    }
  }, []);

  // Initialize family-chart
  useEffect(() => {
    console.log("[FamilyTreeView useEffect] treeData length:", treeData.length, "viewMode:", viewMode);
    console.log("[FamilyTreeView useEffect] containerRef.current exists:", !!containerRef.current);

    if (!containerRef.current || treeData.length === 0) {
      console.log("[FamilyTreeView useEffect] Returning early - no container or empty data");
      return;
    }

    const container = containerRef.current;
    if (typeof container.getBoundingClientRect !== "function") {
      console.warn("[FamilyTreeView useEffect] Chart container is not a DOM element:", container);
      return;
    }

    console.log("[FamilyTreeView useEffect] Initializing chart with", treeData.length, 'people');

    // Clear previous chart
    container.innerHTML = "";

    try {
      // Create store with tree data
      const store = f3.createStore({
        data: treeData,
        node_separation: 250,
        level_separation: 150,
      });

      // Create SVG container
      const svg = f3.createSvg(container);

      // Create chart
      const chart = f3.createChart({
        store,
        svg,
      });

      // Configure view mode - wrap in try-catch in case methods don't exist
      try {
        if (viewMode === "descendant") {
          if (chart && typeof chart.setAncestryDepth === 'function') {
            chart.setAncestryDepth(0);  // Hide ancestors
          }
          if (chart && typeof chart.setProgenyDepth === 'function') {
            chart.setProgenyDepth(10);   // Show descendants
          }
        } else if (viewMode === "pedigree") {
          if (chart && typeof chart.setAncestryDepth === 'function') {
            chart.setAncestryDepth(10);  // Show ancestors
          }
          if (chart && typeof chart.setProgenyDepth === 'function') {
            chart.setProgenyDepth(0);    // Hide descendants
          }
        }

        // Enable branch toggles for expand/collapse
        if (chart && typeof chart.setDuplicateBranchToggle === 'function') {
          chart.setDuplicateBranchToggle(true);
        }
      } catch (configError) {
        console.warn("Error configuring chart view mode:", configError);
        // Continue without view mode configuration - chart will use defaults
      }

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
      // Must be a stable function reference for proper cleanup
      const handleCardClick = (e) => {
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
      };

      containerRef.current.addEventListener("click", handleCardClick);

      // Store chart reference for controls
      chartRef.current = { store, svg, chart, cards };

      // Reset zoom when tree is recreated
      setZoomLevel((current) => (current === 1 ? current : 1));
      setZoomTransform((current) =>
        current.x === 0 && current.y === 0 && current.k === 1
          ? current
          : { x: 0, y: 0, k: 1 }
      );

      // Render the tree
      store.update.tree({ initial: true });
      
      // Apply initial zoom transform after a brief delay to ensure SVG is rendered
      setTimeout(() => {
        try {
          if (applyZoomTransformRef.current) {
            applyZoomTransformRef.current(1);
          }
        } catch (err) {
          console.warn("Failed to apply initial zoom transform:", err);
        }
      }, 100);
    } catch (err) {
      console.error("Error initializing family-chart:", err);
      showToast(`Error rendering tree: ${err.message}`, "error");
    }

    return () => {
      // Cleanup: Remove event listener AND clear DOM
      if (containerRef.current) {
        // Note: We can't access handleCardClick in cleanup because it's in try block
        // So we clear innerHTML which removes all listeners automatically
        containerRef.current.innerHTML = "";
      }
    };
  }, [treeData, viewMode, showToast]);

  // Handle zoom controls
  const handleZoomIn = () => {
    if (chartRef.current?.svg) {
      const newZoom = Math.min(zoomLevel + 0.1, 2.0);
      setZoomLevel(newZoom);
      applyZoomTransform(newZoom);
      showToast(`Zoom: ${Math.round(newZoom * 100)}%`, "info");
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current?.svg) {
      const newZoom = Math.max(zoomLevel - 0.1, 0.3);
      setZoomLevel(newZoom);
      applyZoomTransform(newZoom);
      showToast(`Zoom: ${Math.round(newZoom * 100)}%`, "info");
    }
  };

  const handleReset = () => {
    if (chartRef.current?.chart && chartRef.current?.svg) {
      setZoomLevel(1);
      setZoomTransform({ x: 0, y: 0, k: 1 });
      applyZoomTransform(1);
      chartRef.current.chart.updateTree({ tree_position: 'main_to_middle' });
      showToast("View reset", "success");
    }
  };

  const handleFitToScreen = () => {
    if (chartRef.current?.chart) {
      chartRef.current.chart.updateTree({ tree_position: 'fit' });
      setZoomLevel(1);
      setZoomTransform({ x: 0, y: 0, k: 1 });
      applyZoomTransform(1);
      showToast("Fitted to screen", "success");
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
    if (chartRef.current?.chart) {
      // Trigger tree update - library expands all by default when updating
      chartRef.current.chart.updateTree({ initial: false });
      showToast("All branches expanded. Click branch icons to collapse.", "success");
    }
  };

  const handleCollapseAll = () => {
    if (chartRef.current?.chart) {
      // Note: Programmatic collapse requires manipulating store internals
      // For now, provide user guidance
      showToast("Click on person's branch icon to collapse branches", "info");
    }
  };

  // Fetch person detail data when selectedPerson changes
  useEffect(() => {
    if (selectedPerson?.id && showDetail) {
      setPersonDetailLoading(true);
      const token = localStorage.getItem("family_tree_token") || "";
      fetch(`${baseUrl}/api/people/${selectedPerson.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch person: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          setPersonDetailData(data);
          setPersonDetailLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load person details:", err);
          showToast("Failed to load person details", "error");
          setPersonDetailLoading(false);
          setShowDetail(false);
        });
    } else if (!showDetail) {
      // Clear data when modal closes
      setPersonDetailData(null);
    }
  }, [selectedPerson?.id, showDetail, baseUrl, showToast]);

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

      {showDetail && personDetailData && (
        <PersonDetail
          person={personDetailData.person}
          relationships={personDetailData.relationships || []}
          isLoading={personDetailLoading}
          onClose={() => {
            setShowDetail(false);
            setSelectedPerson(null);
            setPersonDetailData(null);
          }}
          onEdit={() => {
            navigate(`/people/${personDetailData.person.id}/edit`);
            setShowDetail(false);
          }}
          onAddRelationship={() => {
            navigate(`/people/${personDetailData.person.id}/edit`);
            setShowDetail(false);
          }}
          onQuickAddChild={() => {
            navigate(`/people/add?parent_id=${personDetailData.person.id}`);
            setShowDetail(false);
          }}
          onQuickAddSpouse={() => {
            navigate(`/people/add?spouse_id=${personDetailData.person.id}`);
            setShowDetail(false);
          }}
          onQuickAddParent={() => {
            navigate(`/people/add?child_id=${personDetailData.person.id}`);
            setShowDetail(false);
          }}
        />
      )}
    </section>
  );
}
