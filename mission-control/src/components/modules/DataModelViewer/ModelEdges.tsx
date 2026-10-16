import type { KeyboardEvent } from "react";
import type { DataModelEndpoint } from "@/lib/architecture/data-model/types";
import { COPY } from "./copy.es";
import type { ModelEdge, ModelLayout } from "./layout";
import type { ModelSelection } from "./ModelInspector";
import styles from "./viewer.module.css";

function EndpointMarker({
  endpoint,
  point,
  toward,
}: {
  endpoint: DataModelEndpoint;
  point: { x: number; y: number };
  toward: { x: number; y: number };
}) {
  const angle = (Math.atan2(toward.y - point.y, toward.x - point.x) * 180) / Math.PI;
  return (
    <g
      transform={`translate(${point.x} ${point.y}) rotate(${angle})`}
      focusable="false"
      pointerEvents="none"
      data-cardinality={`${endpoint.min}..${endpoint.max}`}
    >
      <path
        className={styles.edgeLine}
        d={endpoint.max === "many" ? "M0 -7 L14 0 L0 7 M0 0 H14" : "M8 -7 V7"}
      />
      {endpoint.min === 0 ? (
        <circle
          className={styles.edgeLine}
          cx={24}
          cy={0}
          r={4}
          style={{ fill: "var(--color-base)" }}
        />
      ) : (
        <path className={styles.edgeLine} d="M24 -7 V7" />
      )}
    </g>
  );
}

function Edge({
  edge,
  active,
  onSelect,
}: {
  edge: ModelEdge;
  active: boolean;
  onSelect: (selection: ModelSelection) => void;
}) {
  const relation = edge.relationship;
  const points = edge.points;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const second = points[1] ?? first;
  const previous = points[points.length - 2] ?? last;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  function select() {
    onSelect({ kind: "relationship", id: relation.id });
  }
  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    }
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG paths require an SVG group; equivalent HTML buttons are also present in the inspector.
    <g
      className={styles.edge}
      data-active={active}
      data-model-interactive="true"
      role="button"
      tabIndex={0}
      aria-label={`${COPY.relation} ${relation.name ?? relation.id}`}
      aria-pressed={active}
      onClick={select}
      onKeyDown={handleKeyDown}
    >
      <path d={path} className={styles.edgeHit} />
      <path d={path} className={styles.edgeLine} />
      <EndpointMarker endpoint={relation.from} point={first} toward={second} />
      <EndpointMarker endpoint={relation.to} point={last} toward={previous} />
      <text
        x={first.x + (second.x >= first.x ? 12 : -12)}
        y={first.y - 9}
        textAnchor={second.x >= first.x ? "start" : "end"}
      >
        {relation.from.min}..{relation.from.max === "many" ? "*" : relation.from.max}
      </text>
      <text
        x={last.x + (previous.x >= last.x ? 12 : -12)}
        y={last.y - 9}
        textAnchor={previous.x >= last.x ? "start" : "end"}
      >
        {relation.to.min}..{relation.to.max === "many" ? "*" : relation.to.max}
      </text>
    </g>
  );
}

/** All relation paths remain independently selectable, including parallel and self edges. */
export function ModelEdges({
  layout,
  selection,
  onSelect,
}: {
  layout: ModelLayout;
  selection: ModelSelection;
  onSelect: (selection: ModelSelection) => void;
}): React.JSX.Element {
  return (
    <svg
      className={styles.edges}
      width={layout.width}
      height={layout.height}
      aria-label={COPY.relationships}
    >
      {layout.edges.map((edge) => (
        <Edge
          key={edge.relationship.id}
          edge={edge}
          active={
            selection?.kind === "relationship"
              ? selection.id === edge.relationship.id
              : selection?.kind === "entity" &&
                [edge.relationship.from.entity, edge.relationship.to.entity].includes(selection.id)
          }
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}
