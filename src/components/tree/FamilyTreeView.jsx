import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as f3 from "family-chart";
import { useToast } from "../common/Toast.jsx";
import TreeControls from "./TreeControls.jsx";
import PersonDetail from "../person/PersonDetail.jsx";
import "./FamilyTreeView.css";

const baseUrl = import.meta.env.VITE_API_URL || "";

/**
 * Family Tree View using family-chart library
 * Displays descendant tree visualization with person interaction
 *
 * Simplified version: focuses on tree rendering and essential interactions
 * Removed: color coding, custom zoom logic, ancestry calculation, view modes
 * Kept: family-chart rendering, person details, add/edit navigation
 */
export default function FamilyTreeView() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State for person detail modal
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [personDetailData, setPersonDetailData] = useState(null);
  const [personDetailLoading, setPersonDetailLoading] = useState(false);
  const [initError, setInitError] = useState(null);
  const initAttemptedRef = useRef(false);

  // Fetch tree data from backend
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

  // Initialize family-chart library
  useEffect(() => {
    console.log("[FamilyTreeView] Initializing with treeData length:", treeData.length);

    // Guard against infinite loops
    if (initError) {
      console.log("[FamilyTreeView] Skipping initialization - previous error");
      return;
    }

    if (!containerRef.current || treeData.length === 0) {
      console.log("[FamilyTreeView] Container not ready or no tree data");
      return;
    }

    if (initAttemptedRef.current) {
      console.log("[FamilyTreeView] Already attempted initialization");
      return;
    }
    initAttemptedRef.current = true;

    // Clear previous chart
    containerRef.current.innerHTML = "";

    try {
      console.log("[FamilyTreeView] Creating family-chart store");

      // Create store with tree data
      const store = f3.createStore({
        data: treeData,
        node_separation: 250,
        level_separation: 150,
      });

      console.log("[FamilyTreeView] Creating SVG");

      // Create SVG container
      const svg = f3.createSvg({
        cont: containerRef.current,
      });

      console.log("[FamilyTreeView] Creating chart");

      // Create chart
      const chart = f3.createChart({
        store,
        svg,
      });

      // Create cards
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

      // Handle card click - show person detail
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

      if (containerRef.current) {
        containerRef.current.addEventListener("click", handleCardClick);
      }

      // Store chart reference
      chartRef.current = { store, svg, chart, cards };

      console.log("[FamilyTreeView] Rendering tree");

      // Render the tree
      store.update.tree({ initial: true });

    } catch (err) {
      console.error("[FamilyTreeView] Error initializing chart:", err);
      setInitError(err.message);
      showToast(`Error rendering tree: ${err.message}`, "error");
    }

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      initAttemptedRef.current = false;
    };
  }, [treeData.length, initError, showToast]);

  // Reset error when tree data changes (allows retry)
  useEffect(() => {
    if (treeData.length > 0 && initError) {
      setInitError(null);
      initAttemptedRef.current = false;
    }
  }, [treeData.length, initError]);

  // Zoom controls
  const handleZoomIn = () => {
    if (chartRef.current?.svg) {
      showToast("Zoom in (scroll wheel or pinch to zoom)", "info");
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current?.svg) {
      showToast("Zoom out (scroll wheel or pinch to zoom)", "info");
    }
  };

  const handleReset = () => {
    if (chartRef.current?.chart && chartRef.current?.svg) {
      chartRef.current.chart.updateTree({ tree_position: "main_to_middle" });
      showToast("View reset", "success");
    }
  };

  const handleFitToScreen = () => {
    if (chartRef.current?.chart) {
      chartRef.current.chart.updateTree({ tree_position: "fit" });
      showToast("Fitted to screen", "success");
    }
  };

  // Fetch person detail when selected
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
  }, [selectedPerson?.id, showDetail, showToast]);

  // Loading state
  if (isLoading) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p>Loading family tree...</p>
        </div>
      </section>
    );
  }

  // API error
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

  // Initialization error
  if (initError) {
    return (
      <section className="page tree-page">
        <div className="empty-state">
          <p className="error">Error rendering tree visualization: {initError}</p>
          <p className="error-details">Try refreshing the page or logging out and back in.</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </section>
    );
  }

  // Empty tree
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

  // Tree view
  return (
    <section className="page tree-page">
      <div className="tree-header">
        <h1>Family Tree</h1>
      </div>

      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onFitToScreen={handleFitToScreen}
        onExpandAll={() => showToast("Click a person's mini-tree icon to expand/collapse", "info")}
        onCollapseAll={() => showToast("Click a person's mini-tree icon to expand/collapse", "info")}
        onSearch={() => showToast("Search: click a person or use family-chart search", "info")}
      />

      <div
        ref={containerRef}
        className="family-chart-container"
        style={{ width: "100%", height: "calc(100vh - 250px)" }}
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
