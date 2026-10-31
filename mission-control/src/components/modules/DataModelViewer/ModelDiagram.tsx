import { useCallback } from "react";
import type { DataModel } from "@/lib/architecture/data-model/types";
import { t } from "@/lib/copy/copy";
import { COPY } from "./copy.es";
import { EntityCard } from "./EntityCard";
import type { ModelLayout, ModelSelection } from "./layout";
import { ModelEdges } from "./ModelEdges";
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
  expanded = false,
}: {
  model: DataModel;
  layout: ModelLayout;
  selection: ModelSelection;
  onSelect: (selection: ModelSelection) => void;
  matches: readonly string[];
  query: string;
  viewport: ReturnType<typeof useViewport>;
  helpId: string;
  expanded?: boolean;
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
  const { focusNode } = viewport;
  const overview = viewport.view.zoom < 1;
  const selectEntity = useCallback(
    (id: string) => {
      onSelect({ kind: "entity", id });
      const node = layout.nodes.find((item) => item.entity.id === id);
      if (node && overview) focusNode(node);
    },
    [onSelect, layout.nodes, overview, focusNode],
  );
  return (
    <>
      <div
        ref={viewport.canvasRef}
        id="diagram"
        data-testid="model-viewport"
        data-scroll-x="intentional"
        className={`${styles.canvas} ${expanded ? styles.expandedCanvas : ""}`}
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
          data-overview={viewport.view.zoom < 1}
          style={
            {
              "--model-scale": viewport.view.zoom,
              width: layout.width,
              height: layout.height,
              transform: `translate(${viewport.view.x}px, ${viewport.view.y}px) scale(${viewport.view.zoom})`,
            } as React.CSSProperties
          }
        >
          <ModelEdges layout={layout} selection={selection} />
          {layout.nodes.map((node) => (
            <EntityCard
              key={node.entity.id}
              node={node}
              selected={selection?.kind === "entity" && selection.id === node.entity.id}
              related={related.has(node.entity.id)}
              matching={Boolean(query) && matches.includes(node.entity.id)}
              dimmed={
                selection !== null &&
                !(selection.kind === "entity" && selection.id === node.entity.id) &&
                !related.has(node.entity.id) &&
                !(query && matches.includes(node.entity.id))
              }
              onSelect={selectEntity}
            />
          ))}
        </div>
      </div>
      {viewport.isOverviewClipped && (
        <p role="status">{t("workspace.arquitectura.dataModel.mapDoesNotFit")}</p>
      )}
      <p id={helpId} className={styles.srOnly}>
        {COPY.help}
      </p>
    </>
  );
}
