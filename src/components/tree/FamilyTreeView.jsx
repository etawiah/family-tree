import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Tree from "react-d3-tree";
import TreeControls from "./TreeControls.jsx";
import TreeSelector from "./TreeSelector.jsx";
import { PersonNode, TreeLegend } from "./PersonNode.jsx";
import { getAccessLevel, hasRequiredAccess } from "../../services/auth.js";
import PersonDetail from "../person/PersonDetail.jsx";
import PersonForm from "../person/PersonForm.jsx";
import RelationshipForm from "../relationships/RelationshipForm.jsx";
import QuickAddDialog from "../person/QuickAddDialog.jsx";

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
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRelationshipOpen, setIsRelationshipOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState(null);
  const [isCreatePersonOpen, setIsCreatePersonOpen] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canEdit = hasRequiredAccess(getAccessLevel(), "edit");
  const queryClient = useQueryClient();

  const baseUrl = import.meta.env.VITE_API_URL;

  const {
    data: treeDataResponse,
    isLoading: isTreeLoading,
    error: treeError,
    refetch: refetchTree,
  } = useQuery({
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

  const {
    data: peopleDataResponse,
    isLoading: isPeopleLoading,
    error: peopleError,
    refetch: refetchPeople,
  } = useQuery({
    queryKey: ["people", treeSide],
    queryFn: async () => {
      const response = await fetch(
        `${baseUrl}/api/people?tree_side=${treeSide}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
          },
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load people.");
      }
      return payload;
    },
  });

  useEffect(() => {
    if (peopleDataResponse) {
      const people = peopleDataResponse.people || [];
      console.log(`[Tree Debug] API returned ${people.length} people for ${treeSide} tree`);
      if (people.length === 0) {
        console.warn(`[Tree Debug] No people returned from API for ${treeSide} side`);
      } else {
        people.forEach((person, idx) => {
          console.log(`[Tree Debug] Person ${idx + 1}:`, {
            id: person.id,
            name: `${person.first_name} ${person.last_name}`,
            tree_side: person.tree_side,
            has_relationships: person.children?.length > 0 || false,
          });
        });
      }
    }
  }, [peopleDataResponse, treeSide]);

  // Convert API data into react-d3-tree nodes.
  const treeData = useMemo(() => {
    const roots = treeDataResponse?.tree || [];
    const people = peopleDataResponse?.people || [];
    
    console.log(`[Tree Debug] Processing tree data: ${roots.length} roots, ${people.length} total people for ${treeSide} side`);
    
    // Build relationship info map for path styling
    // Note: We'll need to fetch relationships separately or enhance the tree API
    // For now, we'll use the relationship data from the tree structure
    const relationshipInfo = {};
    
    const mappedRoots = roots.map((root) => mapNode(root, collapsedIds, relationshipInfo));
    const linkedIds = new Set();
    collectNodeIds(roots).forEach((id) => linkedIds.add(id));
    const unlinkedPeople = people.filter((person) => !linkedIds.has(person.id));

    console.log(`[Tree Debug] Linked people: ${linkedIds.size}, Unlinked people: ${unlinkedPeople.length}`);

    const nodes = [...mappedRoots];
    if (unlinkedPeople.length) {
      nodes.push({
        name: "Unlinked",
        isGroup: true,
        children: unlinkedPeople.map((person) => mapNode(person, collapsedIds, relationshipInfo)),
      });
    }

    const totalNodes = nodes.reduce((count, node) => {
      return count + (node.isGroup ? (node.children?.length || 0) : 1) + countDescendants(node);
    }, 0);

    console.log(`[Tree Debug] Rendering ${nodes.length} root nodes, ${totalNodes} total nodes for ${treeSide} tree`);
    console.log(`[Tree Debug] API returned ${people.length} people, rendering ${totalNodes} nodes`);
    
    if (people.length > 0 && totalNodes === 0) {
      console.error(`[Tree Debug] ERROR: ${people.length} people in API but 0 nodes rendered! Check mapNode function.`);
    } else if (people.length !== totalNodes && !nodes.some(n => n.isGroup)) {
      console.warn(`[Tree Debug] WARNING: ${people.length} people in API but ${totalNodes} nodes rendered. Some people may be missing.`);
    }
    
    return nodes;
  }, [treeDataResponse, peopleDataResponse, collapsedIds, treeSide]);

  function countDescendants(node) {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.length + node.children.reduce((sum, child) => sum + countDescendants(child), 0);
  }

  const handleZoomIn = () => setZoom((current) => Math.min(current + 0.1, 2));
  const handleZoomOut = () => setZoom((current) => Math.max(current - 0.1, 0.3));
  const handleReset = () => {
    setZoom(0.8);
    setTranslate(DEFAULT_TRANSLATE);
  };

  const handleFitToScreen = () => {
    // Calculate bounds of all nodes and center/zoom to fit
    // For now, reset to default - can be enhanced with actual bounds calculation
    setZoom(0.8);
    setTranslate(DEFAULT_TRANSLATE);
  };

  // Touch/pan handlers for mobile
  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      setIsPanning(true);
      setPanStart({
        x: event.touches[0].clientX - translate.x,
        y: event.touches[0].clientY - translate.y,
      });
    }
  };

  const handleTouchMove = (event) => {
    if (isPanning && event.touches.length === 1) {
      event.preventDefault();
      setTranslate({
        x: event.touches[0].clientX - panStart.x,
        y: event.touches[0].clientY - panStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // Mouse wheel zoom
  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((current) => Math.max(0.3, Math.min(2, current + delta)));
  };

  const handleCollapseAll = () => {
    const allIds = collectNodeIds(treeDataResponse?.tree || []);
    setCollapsedIds(new Set(allIds));
  };

  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };

  const loadPersonDetails = async (personId, personSnapshot) => {
    if (!personId) {
      return;
    }
    setIsDetailLoading(true);
    if (personSnapshot) {
      setSelectedPerson(personSnapshot);
    }
    try {
      const response = await fetch(`${baseUrl}/api/people/${personId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load person details.");
      }
      setSelectedPerson(payload.person);
      setRelationships(payload.relationships || []);
    } catch (err) {
      console.error("Failed to load person details:", err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSelectPerson = async (nodeDatum) => {
    if (!nodeDatum || nodeDatum.isGroup) {
      return;
    }
    await loadPersonDetails(nodeDatum.id, nodeDatum.rawPerson || nodeDatum);
  };

  const handleSearch = (query) => {
    if (!query) {
      return;
    }
    const match = findNodeByName(treeDataResponse?.tree || [], query);
    if (match) {
      // Focus the tree around the matched node by nudging translate.
      setTranslate({ x: 350, y: 120 });
      setCollapsedIds(new Set());
    }
  };

  const handleRelationshipCreated = async () => {
    await Promise.all([refetchTree(), refetchPeople()]);
    if (selectedPerson?.id) {
      await loadPersonDetails(selectedPerson.id);
    } else {
      queryClient.invalidateQueries({ queryKey: ["tree", treeSide] });
      queryClient.invalidateQueries({ queryKey: ["people", treeSide] });
    }
  };

  const handleEditSubmit = async (values) => {
    if (!selectedPerson?.id) {
      return;
    }
    const response = await fetch(
      `${baseUrl}/api/people/${selectedPerson.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
        },
        body: JSON.stringify(values),
      }
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to update person.");
    }
    await Promise.all([refetchTree(), refetchPeople()]);
    await loadPersonDetails(selectedPerson.id);
  };

  const handleQuickAddChoice = (type, choice) => {
    setIsQuickAddOpen(false);
    if (choice === "link") {
      setIsRelationshipOpen(true);
    } else {
      setIsCreatePersonOpen(true);
    }
  };

  const handleCreatePersonAndLink = async (values, relationshipType) => {
    if (!selectedPerson?.id) {
      return;
    }

    // Create the person first
    const createResponse = await fetch(`${baseUrl}/api/people`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
      },
      body: JSON.stringify(values),
    });

    const createPayload = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(createPayload?.error || "Unable to create person.");
    }

    const newPersonId = createPayload.id || createPayload.person?.id;
    if (!newPersonId) {
      console.error("Create response:", createPayload);
      throw new Error("Person created but ID not returned. Check console for details.");
    }

    // Determine relationship details based on type
    const isBloodRelation = relationshipType !== "spouse";
    const relationshipData = {
      tree_side: values.tree_side || selectedPerson.tree_side,
      person_id: selectedPerson.id,
      related_person_id: newPersonId,
      relationship_type: relationshipType,
      is_blood_relation: isBloodRelation,
    };

    // Add marriage-specific fields for spouse
    if (relationshipType === "spouse") {
      if (values.marriage_date) {
        relationshipData.marriage_date = values.marriage_date;
      }
      relationshipData.relationship_order = values.relationship_order || 1;
    }

    // Create the relationship
    const relResponse = await fetch(`${baseUrl}/api/relationships`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("family_tree_token") || ""}`,
      },
      body: JSON.stringify(relationshipData),
    });

    const relPayload = await relResponse.json();
    if (!relResponse.ok) {
      throw new Error(relPayload?.error || "Person created but relationship failed.");
    }

    // Refresh everything
    await Promise.all([refetchTree(), refetchPeople()]);
    await loadPersonDetails(selectedPerson.id);
    setIsCreatePersonOpen(false);
  };

  if (isTreeLoading || isPeopleLoading) {
    return <div className="page">Loading tree...</div>;
  }

  if (treeError || peopleError) {
    return (
      <div className="page">
        <p>
          Unable to load the tree.{" "}
          {(treeError || peopleError)?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  if (isTreeLoading) {
    return (
      <section className="page tree-page">
        <TreeSelector treeSide={treeSide} onChange={setTreeSide} />
        <div className="empty-state">
          <p>Loading family tree...</p>
        </div>
      </section>
    );
  }

  if (treeError) {
    return (
      <section className="page tree-page">
        <TreeSelector treeSide={treeSide} onChange={setTreeSide} />
        <div className="empty-state">
          <p className="form-error">
            {treeError.message || "Unable to load family tree. Please refresh the page."}
          </p>
          <button type="button" onClick={() => refetchTree()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!treeData || treeData.length === 0) {
    return (
      <section className="page tree-page">
        <TreeSelector treeSide={treeSide} onChange={setTreeSide} />
        <div className="empty-state">
          <h2>No family members yet</h2>
          <p>
            Start building the family tree by adding the first person on the{" "}
            {treeSide} side.
          </p>
          {canEdit ? (
            <Link className="button-link" to="/people/new">
              Add first person
            </Link>
          ) : (
            <p>Ask an editor or admin to add the first record.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="page tree-page">
      <TreeSelector treeSide={treeSide} onChange={setTreeSide} />
      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onFitToScreen={handleFitToScreen}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onSearch={handleSearch}
      />

      <div
        className="tree-canvas"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <Tree
          data={treeData}
          translate={translate}
          zoom={zoom}
          orientation="vertical"
          pathFunc={customPathFunc}
          pathClassFunc={(link) => {
            const sourceNode = link.source.data;
            const targetNode = link.target.data;
            const isBlood = sourceNode.isBloodRelative ?? true;
            const isMarriage = sourceNode.marriageStatus === "married" || targetNode.marriageStatus === "married";
            const isDivorced = sourceNode.marriageStatus === "divorced" || targetNode.marriageStatus === "divorced";
            
            let className = "tree-link";
            if (isMarriage) {
              className += " tree-link-marriage";
              if (isDivorced) className += " tree-link-divorced";
            } else if (!isBlood) {
              className += " tree-link-nonblood";
            } else {
              className += " tree-link-blood";
            }
            return className;
          }}
          collapsible
          renderCustomNodeElement={({ nodeDatum }) => (
            <PersonNode nodeDatum={nodeDatum} onSelect={handleSelectPerson} />
          )}
          separation={{ siblings: 1.2, nonSiblings: 2 }}
          nodeSize={{ x: 160, y: 120 }}
          enableLegacyTransitions={false}
        />
      </div>

      <TreeLegend />

      <PersonDetail
        person={selectedPerson}
        relationships={relationships}
        isLoading={isDetailLoading}
        onClose={async () => {
          // Refresh tree data when closing detail view to show any changes
          await Promise.all([refetchTree(), refetchPeople()]);
          setSelectedPerson(null);
          setIsEditOpen(false);
          setIsRelationshipOpen(false);
          setIsQuickAddOpen(false);
          setIsCreatePersonOpen(false);
          setQuickAddType(null);
        }}
        onEdit={() => {
          if (selectedPerson?.id) {
            setEditError("");
            setEditSuccess("");
            setIsEditOpen(true);
          }
        }}
        onAddRelationship={() => {
          setIsRelationshipOpen(true);
        }}
        onQuickAddChild={() => {
          setQuickAddType("child");
          setIsQuickAddOpen(true);
        }}
        onQuickAddSpouse={() => {
          setQuickAddType("spouse");
          setIsQuickAddOpen(true);
        }}
        onQuickAddParent={() => {
          setQuickAddType("parent");
          setIsQuickAddOpen(true);
        }}
      />

      {isRelationshipOpen && selectedPerson ? (
        <RelationshipForm
          person={selectedPerson}
          treeSide={treeSide}
          people={peopleDataResponse?.people || []}
          preselectedType={quickAddType || ""}
          onClose={() => {
            setIsRelationshipOpen(false);
            setQuickAddType(null);
          }}
          onSuccess={async () => {
            await handleRelationshipCreated();
            setIsRelationshipOpen(false);
            setQuickAddType(null);
          }}
        />
      ) : null}

      {isEditOpen && selectedPerson ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsEditOpen(false)}
        >
          <div className="modal edit-person-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>
                  Edit Person: {selectedPerson?.first_name || ""}{" "}
                  {selectedPerson?.last_name || ""}
                </h2>
                <p className="subtitle">Update details and photos.</p>
              </div>
              <button type="button" onClick={() => setIsEditOpen(false)}>
                Close
              </button>
            </header>
            {selectedPerson ? (
              <PersonForm
                initialValues={selectedPerson}
                submitLabel="Update Person"
                warnOnTreeSideChange
                hasRelationships={relationships.length > 0}
                submitError={editError}
                submitSuccess={editSuccess}
                onSubmit={async (values) => {
                  setEditError("");
                  setEditSuccess("");
                  try {
                    await handleEditSubmit(values);
                    setEditSuccess("Person updated successfully.");
                    // Refresh tree immediately
                    await Promise.all([refetchTree(), refetchPeople()]);
                    setTimeout(() => {
                      setIsEditOpen(false);
                      setEditSuccess("");
                      // Refresh again after closing to ensure tree is updated
                      refetchTree();
                      refetchPeople();
                    }, 700);
                  } catch (err) {
                    console.error("Edit error:", err);
                    setEditError(err.message || "Unable to update person.");
                  }
                }}
                onCancel={() => setIsEditOpen(false)}
              />
            ) : (
              <p>Loading person data...</p>
            )}
          </div>
        </div>
      ) : null}

      {isQuickAddOpen && quickAddType ? (
        <QuickAddDialog
          relationshipType={quickAddType}
          onLinkExisting={() => {
            setIsRelationshipOpen(true);
            setIsQuickAddOpen(false);
          }}
          onCreateNew={() => {
            setIsCreatePersonOpen(true);
            setIsQuickAddOpen(false);
          }}
          onClose={() => setIsQuickAddOpen(false)}
        />
      ) : null}

      {isCreatePersonOpen && selectedPerson && quickAddType ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsCreatePersonOpen(false)}
        >
          <div className="modal create-person-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>
                  Create {quickAddType === "child" ? "Child" : quickAddType === "spouse" ? "Spouse" : "Parent"} & Link
                </h2>
                <p className="subtitle">
                  Add a new person and automatically connect to {selectedPerson.first_name} {selectedPerson.last_name}
                </p>
              </div>
              <button type="button" onClick={() => setIsCreatePersonOpen(false)}>
                Close
              </button>
            </header>
            <PersonForm
              initialValues={{
                tree_side: selectedPerson.tree_side || "maternal",
              }}
              quickAddType={quickAddType}
              submitLabel={`Create & Link as ${quickAddType === "child" ? "Child" : quickAddType === "spouse" ? "Spouse" : "Parent"}`}
              onSubmit={async (values) => {
                try {
                  await handleCreatePersonAndLink(values, quickAddType);
                } catch (err) {
                  console.error("Create and link error:", err);
                  alert(err.message || "Failed to create person and link.");
                }
              }}
              onCancel={() => setIsCreatePersonOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Map API person objects to react-d3-tree node format.
 * Includes relationship metadata for path styling.
 */
function mapNode(person, collapsedIds, relationshipInfo = {}) {
  const node = {
    id: person.id,
    name: `${person.first_name} ${person.last_name}`,
    rawPerson: person,
    gender: person.gender,
    isAlive: person.is_alive,
    isBloodRelative: person.is_blood_relation ?? true,
    marriageStatus: person.marriage_status,
    hasMultipleMarriages: person.relationship_order > 1,
    collapsed: collapsedIds.has(person.id),
    children: (person.children || []).map((child) => {
      // Attach relationship metadata to each child link
      const childRelInfo = relationshipInfo[child.id] || {};
      return mapNode(child, collapsedIds, relationshipInfo);
    }),
  };

  // Attach relationship info to node for path styling
  if (relationshipInfo[person.id]) {
    node.relationshipInfo = relationshipInfo[person.id];
  }

  return node;
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

/**
 * Custom path function for react-d3-tree to style relationship lines.
 * Styles based on relationship type: solid for blood, dashed for non-blood, thick for marriage.
 */
function customPathFunc({ source, target }) {
  const sourceNode = source.data;
  const targetNode = target.data;
  
  // Determine relationship type from node data
  const isBloodRelation = sourceNode.isBloodRelative ?? true;
  const isMarriage = sourceNode.marriageStatus === "married" || targetNode.marriageStatus === "married";
  const isDivorced = sourceNode.marriageStatus === "divorced" || targetNode.marriageStatus === "divorced";
  
  // Create elbow path
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const midX = source.x + dx / 2;
  const midY = source.y + dy / 2;
  
  return `M${source.x},${source.y} L${midX},${source.y} L${midX},${target.y} L${target.x},${target.y}`;
}

