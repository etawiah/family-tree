import { CheckCircle, Heart, XCircle } from "lucide-react";

/**
 * Custom tree node for react-d3-tree.
 *
 * Styling encodes relationship metadata to improve at-a-glance understanding.
 */
export function PersonNode({ nodeDatum, onSelect }) {
  if (nodeDatum.isGroup) {
    return (
      <g onClick={() => onSelect?.(nodeDatum)}>
        <rect
          width={140}
          height={36}
          x={-70}
          y={-18}
          rx={10}
          ry={10}
          fill="#e2e8f0"
          stroke="#64748b"
          strokeWidth={2}
        />
        <text
          textAnchor="middle"
          dy={5}
          style={{ fontSize: 12, fill: "#1f2933", fontWeight: 600 }}
        >
          {nodeDatum.name}
        </text>
      </g>
    );
  }

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
  
  // Deceased styling: grayscale filter
  const deceasedFilter = isDeceased ? { filter: "grayscale(100%) opacity(0.7)" } : {};

  return (
    <g onClick={() => onSelect?.(nodeDatum)} style={{ cursor: "pointer", ...deceasedFilter }}>
      <circle
        r={28}
        style={{
          ...nodeStyle,
          strokeDasharray: borderDash,
          strokeWidth: borderWidth,
        }}
      />
      <text
        dy={4}
        x={36}
        textAnchor="start"
        style={{ fontSize: 12, fill: isDeceased ? "#64748b" : "#0f172a", fontWeight: isDeceased ? "normal" : "500" }}
      >
        {nodeDatum.name}
        {isDeceased ? " †" : ""}
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
        ) : marriageStatus === "divorced" ? (
          <Heart size={16} color="#94a3b8" style={{ opacity: 0.5 }} />
        ) : null}
      </g>
    </g>
  );
}

/**
 * Legend explaining the visual cues for nodes and relationship lines.
 */
export function TreeLegend() {
  return (
    <div className="tree-legend">
      <h3>Legend</h3>
      <div className="legend-sections">
        <div>
          <h4>Nodes</h4>
          <ul>
            <li>Solid fill: blood relative</li>
            <li>Outlined fill: non-blood relative (spouse)</li>
            <li>Blue: male, Pink/Purple: female, Gray: other</li>
            <li>Dashed border: divorced</li>
            <li>Thick border: multiple marriages</li>
            <li>Green check: living, Red X: deceased</li>
            <li>Heart icon: married (gray = divorced)</li>
            <li>† symbol: deceased person</li>
          </ul>
        </div>
        <div>
          <h4>Relationship Lines</h4>
          <ul>
            <li>Solid blue line: blood relation (parent-child, siblings)</li>
            <li>Dashed gray line: non-blood relation (step-parent, step-sibling)</li>
            <li>Thick purple line: marriage (current)</li>
            <li>Thick dashed purple line: divorce (ex-spouse)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
