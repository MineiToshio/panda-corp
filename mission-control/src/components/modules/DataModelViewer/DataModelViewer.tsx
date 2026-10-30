"use client";

import type { ChangeEvent } from "react";
import { useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/core/Button/Button";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import type { DataModel, DataModelResult } from "@/lib/architecture/data-model/types";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { COPY } from "./copy.es";
import { DiagramControls } from "./DiagramControls";
import type { ModelLayout, ModelSelection } from "./layout";
import { ModelDiagram } from "./ModelDiagram";
import { ModelSchema } from "./ModelSchema";
import { useModelExpansion } from "./useModelExpansion";
import { useModelLayout } from "./useModelLayout";
import { useViewport } from "./useViewport";
import styles from "./viewer.module.css";

/** One read-only model: content-sized diagram and schema, with a diagram-only full-window view. */
export function DataModelViewer({
  result,
}: {
  readonly result: DataModelResult;
}): React.JSX.Element {
  switch (result.kind) {
    case "missing":
      return <p className={styles.state}>{COPY.missing}</p>;
    case "none":
      return <p className={styles.state}>{COPY.none}</p>;
    case "error":
      return (
        <div className={styles.state} role="alert">
          <p>{COPY.error}</p>
          <code>{result.message}</code>
        </div>
      );
    case "ready":
      return result.model.entities.length ? (
        <LayoutViewer model={result.model} source={result.source} />
      ) : (
        <p className={styles.state}>{COPY.empty}</p>
      );
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function LayoutViewer({ model, source }: { model: DataModel; source: string }) {
  const result = useModelLayout(model);
  if (result.kind === "loading")
    return (
      <p className={styles.state} role="status">
        {COPY.loading}
      </p>
    );
  if (result.kind === "error")
    return (
      <p className={styles.state} role="alert">
        {COPY.layoutError}
      </p>
    );
  return <ReadyViewer model={model} source={source} layout={result.layout} />;
}

function hasUnavailableSelection(
  model: DataModel,
  entityIds: string[],
  relationshipId: string,
): boolean {
  return (
    entityIds.some((id) => id !== "" && !model.entities.some((entity) => entity.id === id)) ||
    (relationshipId !== "" &&
      !model.relationships.some((relation) => relation.id === relationshipId))
  );
}

function ReadyViewer({
  model,
  source,
  layout,
}: {
  model: DataModel;
  source: string;
  layout: ModelLayout;
}) {
  const [modelMode, setModelMode] = useUrlState("model", "Diagrama");
  const mode = ["schema", "Esquema"].includes(modelMode) ? "schema" : "diagram";
  function setMode(next: string) {
    setModelMode(next === "schema" ? "Esquema" : "Diagrama");
  }
  const [query, setQuery] = useUrlState("modelQuery", "");
  const [entityId] = useUrlState("entity", "");
  const [relationshipId] = useUrlState("relationship", "");
  const [schemaTable] = useUrlState("schemaTable", "");
  const unavailableSelection = hasUnavailableSelection(
    model,
    [entityId, schemaTable],
    relationshipId,
  );
  const selection: ModelSelection = model.entities.some((entity) => entity.id === entityId)
    ? { kind: "entity", id: entityId }
    : model.relationships.some((relation) => relation.id === relationshipId)
      ? { kind: "relationship", id: relationshipId }
      : null;
  const setSelection = useCallback((next: ModelSelection, replace = false) => {
    updateNavigation(
      {
        entity: next?.kind === "entity" ? next.id : null,
        relationship: next?.kind === "relationship" ? next.id : null,
      },
      { replace },
    );
  }, []);
  const select = useCallback(
    (next: ModelSelection) => {
      setSelection(next?.kind === "relationship" && relationshipId === next.id ? null : next);
    },
    [relationshipId, setSelection],
  );
  const expansion = useModelExpansion();
  const isExpanded = expansion.expanded;
  const viewport = useViewport(layout, isExpanded, mode);
  const id = useId();
  const matches = model.entities
    .filter((entity) =>
      [
        entity.name,
        entity.id,
        ...entity.attributes.flatMap((attribute) => [attribute.name, attribute.id]),
      ].some((text) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
    )
    .map((entity) => entity.id);
  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next, true);
    if (!next.trim()) return;
    const match = layout.nodes.find((node) =>
      [
        node.entity.name,
        node.entity.id,
        ...node.entity.attributes.flatMap((attribute) => [attribute.name, attribute.id]),
      ].some((text) => text.toLocaleLowerCase().includes(next.trim().toLocaleLowerCase())),
    );
    if (match) {
      setSelection({ kind: "entity", id: match.entity.id }, true);
      viewport.focusNode(match);
    }
  }
  function renderSearch() {
    return (
      <label className={styles.search}>
        <span className={styles.srOnly}>{COPY.search}</span>
        <input type="search" value={query} onChange={handleSearch} placeholder={COPY.search} />
      </label>
    );
  }
  function renderDiagram(expanded: boolean) {
    return (
      <ModelDiagram
        model={model}
        layout={layout}
        selection={selection}
        onSelect={select}
        matches={matches}
        query={query}
        viewport={viewport}
        helpId={`${id}-${expanded ? "expanded" : "inline"}-help`}
        expanded={expanded}
      />
    );
  }
  return (
    <>
      <div className={styles.viewer} data-testid="data-model-viewer">
        <div className={styles.provenance}>
          <span>{COPY.source}</span>
          <code>{source}</code>
          <span>{model.persistence === "relational" ? COPY.relational : COPY.document}</span>
        </div>
        {unavailableSelection && <p role="status">{COPY.unavailableSelection}</p>}
        <div className={styles.toolbar}>
          <SubTabs
            tabs={[
              { id: "diagram", label: COPY.diagram },
              { id: "schema", label: COPY.schema },
            ]}
            active={mode}
            onChange={setMode}
            ariaLabel={COPY.views}
            tabIdPrefix={`${id}-tab-`}
          />
          {!isExpanded && renderSearch()}
          <span ref={expansion.triggerRef}>
            <Button size="sm" onClick={expansion.open}>
              {COPY.expand}
            </Button>
          </span>
        </div>
        {query && (
          <p className={styles.searchStatus} role="status">
            {matches.length ? COPY.matches(matches.length) : COPY.noResults}
          </p>
        )}
        <div role="tabpanel" aria-labelledby={`${id}-tab-${mode}`}>
          {isExpanded ? (
            <div className={styles.expandedPlaceholder} />
          ) : mode === "diagram" ? (
            <div className={styles.surface} ref={expansion.surfaceRef}>
              {renderDiagram(false)}
              <DiagramControls
                viewport={viewport}
                expanded={false}
                onToggleFullscreen={expansion.open}
              />
            </div>
          ) : (
            <ModelSchema
              model={model}
              matches={matches}
              onSelect={(entityId) => setSelection({ kind: "entity", id: entityId })}
            />
          )}
        </div>
      </div>
      {isExpanded &&
        createPortal(
          <dialog
            ref={expansion.dialogRef}
            className={`${styles.dialog} ${styles.viewer}`}
            aria-label={COPY.title}
            onCancel={expansion.close}
            onKeyDown={expansion.onKeyDown}
          >
            <div
              ref={expansion.surfaceRef}
              className={`${styles.surface} ${styles.expandedSurface}`}
            >
              {renderDiagram(true)}
              <DiagramControls viewport={viewport} expanded onToggleFullscreen={expansion.close} />
              <div className={styles.expandedSearch}>
                {renderSearch()}
                {query && (
                  <p className={styles.searchStatus} role="status">
                    {matches.length ? COPY.matches(matches.length) : COPY.noResults}
                  </p>
                )}
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
