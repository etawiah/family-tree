import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Tree from "react-d3-tree";
import TreeControls from "./TreeControls.jsx";
import TreeSelector from "./TreeSelector.jsx";
import { PersonNode, TreeLegend } from "./PersonNode.jsx";

const DEFAULT_TRANSLATE = { x: 350, y: 120 };

/**
 * Main tree visualization component.
 *
 * Responsibilities:
 * - Fetch tree data based on maternal/paternal selection
 * - Transform data for react-d3-tree
 * - Render the interactive tree with zoom and pan controls
 */
export default function FamilyTreeView() {
  const [treeSide, setTreeSide] = useState("maternal");
  const [zoom, setZoom] = useState(0.8);
  const [translate, setTranslate] = useState(DEFAULT_TRANSLATE);
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  const baseUrl = import.meta.env.VITE_API_URL;

  const { data, isLoading, error } = useQuery({
    queryKey: ["tree", treeSide],
    queryFn: async () => {
      const response = await fetch(
        `${baseUrl}/api/tree?tree_side=${treeSide}`,
        {
          headers: {
            // JWT is added in Phase 3 routes; placeholder for now.
            Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
          },
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error || "Failed to load tree.");
      }
      return response.json();
    },
  });

  // Convert API data into react-d3-tree nodes.
  const treeData = useMemo(() => {
    const roots = data?.tree || [];
    return roots.map((root) => mapNode(root, collapsedIds));
  }, [data, collapsedIds]);

  const handleZoomIn = () => setZoom((current) => Math.min(current + 0.1, 2));
  const handleZoomOut = () => setZoom((current) => Math.max(current - 0.1, 0.3));
  const handleReset = () => {
    setZoom(0.8);
    setTranslate(DEFAULT_TRANSLATE);
  };

  const handleCollapseAll = () => {
    const allIds = collectNodeIds(data?.tree || []);
    setCollapsedIds(new Set(allIds));
  };

  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };

  const handleSearch = (query) => {
    if (!query) {
      return;
    }
    const match = findNodeByName(data?.tree || [], query);
    if (match) {
      // Focus the tree around the matched node by nudging translate.
      setTranslate({ x: 350, y: 120 });
      setCollapsedIds(new Set());
    }
  };

  if (isLoading) {
    return <div className="page">Loading tree...</div>;
  }

  if (error) {
    return (
      <div className="page">
        <p>Unable to load the tree. {error.message}</p>
      </div>
    );
  }

  return (
    <section className="page tree-page">
      <TreeSelector treeSide={treeSide} onChange={setTreeSide} />
      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onSearch={handleSearch}
      />

      <div className="tree-canvas">
        <Tree
          data={treeData}
          translate={translate}
          zoom={zoom}
          orientation="vertical"
          pathFunc="elbow"
          collapsible
          renderCustomNodeElement={({ nodeDatum, toggleNode }) => (
            <PersonNode nodeDatum={nodeDatum} toggleNode={toggleNode} />
          )}
          separation={{ siblings: 1.2, nonSiblings: 2 }}
          nodeSize={{ x: 160, y: 120 }}
        />
      </div>

      <TreeLegend />
    </section>
  );
}

/**
 * Map API person objects to react-d3-tree node format.
 */
function mapNode(person, collapsedIds) {
  return {
    name: `${person.first_name} ${person.last_name}`,
    gender: person.gender,
    isAlive: person.is_alive,
    isBloodRelative: person.is_blood_relation ?? true,
    marriageStatus: person.marriage_status,
    hasMultipleMarriages: person.relationship_order > 1,
    collapsed: collapsedIds.has(person.id),
    children: (person.children || []).map((child) => mapNode(child, collapsedIds)),
  };
}

/**
 * Collect all node ids for expand/collapse operations.
 */
function collectNodeIds(nodes) {
  const ids = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children?.length) {
      ids.push(...collectNodeIds(node.children));
    }
  }
  return ids;
}

/**
 * Find a node by name to drive search interactions.
 */
function findNodeByName(nodes, query) {
  const normalized = query.toLowerCase();
  for (const node of nodes) {
    const name = `${node.first_name} ${node.last_name}`.toLowerCase();
    if (name.includes(normalized)) {
      return node;
    }
    if (node.children?.length) {
      const childMatch = findNodeByName(node.children, query);
      if (childMatch) {
        return childMatch;
      }
    }
  }
  return null;
}
