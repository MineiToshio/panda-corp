import { Button } from "@/components/core/Button/Button";
import type { DataModel } from "@/lib/architecture/data-model/types";
import { COPY } from "./copy.es";
import { EntityCard } from "./EntityCard";
import type { ModelLayout } from "./layout";
import { ModelEdges } from "./ModelEdges";
import type { ModelSelection } from "./ModelInspector";
import type { useViewport } from "./useViewport";
import styles from "./viewer.module.css";

/** Scrollbar-free diagram with explicit click controls as an alternative to dragging. */
export function ModelDiagram({
  model,
  layout,
  selection,
  onSelect,
  matches,
  query,
  viewport,
  helpId,
}: {
  model: DataModel;
  layout: ModelLayout;
  selection: ModelSelection;
  onSelect: (selection: ModelSelection) => void;
  matches: readonly string[];
  query: string;
  viewport: ReturnType<typeof useViewport>;
  helpId: string;
}): React.JSX.Element {
  const related = new Set(
    model.relationships
      .filter((relation) =>
        selection?.kind === "relationship"
          ? relation.id === selection.id
          : selection?.kind === "entity" &&
            [relation.from.entity, relation.to.entity].includes(selection.id),
      )
      .flatMap((relation) => [relation.from.entity, relation.to.entity]),
  );
  function selectEntity(id: string) {
    onSelect({ kind: "entity", id });
  }
  return (
    <>
      <div className={styles.diagramControls}>
        <div className={styles.controlsGroup}>
          <Button size="sm" ariaLabel={COPY.zoomOut} onClick={() => viewport.zoomBy(1 / 1.2)}>
            −
          </Button>
          <output aria-label={COPY.zoom}>{Math.round(viewport.view.zoom * 100)}%</output>
          <Button size="sm" ariaLabel={COPY.zoomIn} onClick={() => viewport.zoomBy(1.2)}>
            +
          </Button>
          <Button size="sm" onClick={viewport.fit}>
            {COPY.fit}
          </Button>
          <Button size="sm" onClick={viewport.reset}>
            {COPY.reset}
          </Button>
        </div>
        <div className={styles.controlsGroup}>
          <Button size="sm" ariaLabel={COPY.left} onClick={() => viewport.pan(64, 0)}>
            ←
          </Button>
          <Button size="sm" ariaLabel={COPY.up} onClick={() => viewport.pan(0, 64)}>
            ↑
          </Button>
          <Button size="sm" ariaLabel={COPY.down} onClick={() => viewport.pan(0, -64)}>
            ↓
          </Button>
          <Button size="sm" ariaLabel={COPY.right} onClick={() => viewport.pan(-64, 0)}>
            →
          </Button>
        </div>
      </div>
      <div
        ref={viewport.canvasRef}
        data-testid="model-viewport"
        className={styles.canvas}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Arrow-key pan requires a focusable graph viewport.
        tabIndex={0}
        role="application"
        aria-label={COPY.canvas}
        aria-describedby={helpId}
        {...viewport.handlers}
      >
        <div
          className={styles.stage}
          data-testid="model-stage"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${viewport.view.x}px, ${viewport.view.y}px) scale(${viewport.view.zoom})`,
          }}
        >
          <ModelEdges layout={layout} selection={selection} onSelect={onSelect} />
          {layout.nodes.map((node) => (
            <EntityCard
              key={node.entity.id}
              node={node}
              selected={selection?.kind === "entity" && selection.id === node.entity.id}
              related={related.has(node.entity.id)}
              matching={Boolean(query) && matches.includes(node.entity.id)}
              onSelect={selectEntity}
            />
          ))}
        </div>
      </div>
      <p id={helpId} className={styles.help}>
        {COPY.help}
      </p>
    </>
  );
}
