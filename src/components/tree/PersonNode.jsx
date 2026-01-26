import { CheckCircle, Heart, XCircle } from "lucide-react";

/**
 * Custom tree node for react-d3-tree.
 *
 * Styling encodes relationship metadata to improve at-a-glance understanding.
 */
export function PersonNode({ nodeDatum, toggleNode }) {
  const gender = nodeDatum.gender || "other";
  const isBloodRelative = nodeDatum.isBloodRelative ?? true;
  const isDeceased = nodeDatum.isAlive === false;
  const marriageStatus = nodeDatum.marriageStatus || "single";
  const hasMultipleMarriages = nodeDatum.hasMultipleMarriages || false;

  // Color coding communicates gender: blue = male, pink/purple = female, neutral = other.
  const fillColor =
    gender === "male" ? "#3b82f6" : gender === "female" ? "#d946ef" : "#64748b";

  // Blood relatives get a solid fill; non-blood relatives get an outlined style.
  const nodeStyle = isBloodRelative
    ? { fill: fillColor, stroke: "#0f172a", strokeWidth: 2 }
    : { fill: "transparent", stroke: fillColor, strokeWidth: 2 };

  // Marriage complexity markers use dashed or double borders for clarity.
  const borderDash = marriageStatus === "divorced" ? "4 2" : "0";
  const borderWidth = hasMultipleMarriages ? 4 : 2;

  return (
    <g>
      <circle
        r={28}
        style={{
          ...nodeStyle,
          strokeDasharray: borderDash,
          strokeWidth: borderWidth,
        }}
        onClick={toggleNode}
      />
      <text
        dy={4}
        x={36}
        textAnchor="start"
        style={{ fontSize: 12, fill: "#0f172a" }}
      >
        {nodeDatum.name}
      </text>
      <g transform="translate(-12, -46)">
        {isDeceased ? (
          <XCircle size={16} color="#ef4444" />
        ) : (
          <CheckCircle size={16} color="#22c55e" />
        )}
      </g>
      <g transform="translate(8, -46)">
        {marriageStatus === "married" ? (
          <Heart size={16} color="#ef4444" />
        ) : null}
      </g>
    </g>
  );
}

/**
 * Legend explaining the visual cues for nodes.
 */
export function TreeLegend() {
  return (
    <div className="tree-legend">
      <h3>Legend</h3>
      <ul>
        <li>Solid fill: blood relative</li>
        <li>Outlined fill: non-blood relative (spouse)</li>
        <li>Blue: male, Pink/Purple: female, Gray: other</li>
        <li>Dashed border: divorced</li>
        <li>Double border: multiple marriages</li>
        <li>Green check: living, Red X: deceased</li>
        <li>Heart icon: married</li>
      </ul>
    </div>
  );
}
