"use client";

import { useCallback, useId, useSyncExternalStore } from "react";
import { SearchField } from "@/components/core/Field/Field";
import { Notice } from "@/components/core/Notice/Notice";
import { Segmented } from "@/components/core/Segmented/Segmented";
import {
  DATA_MODEL_SOURCE,
  type DataModel,
  type DataModelResult,
} from "@/lib/architecture/data-model/types";
import { t, tRich } from "@/lib/copy/copy";
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
        <Notice icon="alert" kind="error">
          <p>{COPY.error}</p>
          <code>{DATA_MODEL_SOURCE}</code>: {result.message}
          <p>{t("workspace.arquitectura.dataModel.errorNoDiagram")}</p>
        </Notice>
      );
    case "ready":
      return result.model.entities.length ? (
        <LayoutViewer
          key={JSON.stringify(result.model)}
          model={result.model}
          source={result.source}
        />
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
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const [modelMode, setModelMode] = useUrlState("model", phone ? "Esquema" : "Diagrama");
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
      setSelection(
        next &&
          ((next.kind === "relationship" && relationshipId === next.id) ||
            (next.kind === "entity" && entityId === next.id))
          ? null
          : next,
      );
    },
    [entityId, relationshipId, setSelection],
  );
  const expansion = useModelExpansion();
  const isExpanded = expansion.expanded;
  const viewport = useViewport(layout, isExpanded, mode, entityId);
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
  function handleSearch(next: string) {
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
      <SearchField
        label={COPY.search}
        placeholder={t("workspace.arquitectura.dataModel.searchPlaceholder")}
        value={query}
        onChange={handleSearch}
      />
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
    <div className={styles.viewer} data-testid="data-model-viewer">
      <p className={styles.provenance}>{COPY.source}</p>
      <p className={styles.provenance} title={source}>
        {tRich("workspace.arquitectura.dataModel.counts", {
          entities: model.entities.length,
          relationships: model.relationships.length,
        })}
      </p>
      {unavailableSelection && <p role="status">{COPY.unavailableSelection}</p>}
      <div className={styles.toolbar}>
        {renderSearch()}
        <Segmented
          label={COPY.views}
          options={[
            { value: "diagram", label: COPY.diagram },
            { value: "schema", label: COPY.schema },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Fullscreen host traps bubbled keyboard navigation for its interactive descendants. */}
      <div ref={expansion.surfaceRef} className={styles.surface} onKeyDown={expansion.onKeyDown}>
        {isExpanded && (
          <div className={styles.expandedSearch}>
            {renderSearch()}
            {query && (
              <p className={styles.searchStatus} role="status">
                {matches.length ? COPY.matches(matches.length) : COPY.noResults}
              </p>
            )}
          </div>
        )}
        {!isExpanded && query && (
          <p className={styles.searchStatus} role="status">
            {matches.length ? COPY.matches(matches.length) : COPY.noResults}
          </p>
        )}
        {mode === "diagram" || isExpanded ? (
          <>
            {renderDiagram(isExpanded)}
            <DiagramControls
              viewport={viewport}
              expanded={isExpanded}
              onToggleFullscreen={expansion.open}
            />
          </>
        ) : (
          <ModelSchema
            model={model}
            matches={matches}
            onSelect={(id) => setSelection({ kind: "entity", id })}
          />
        )}
      </div>
      <p>{t("workspace.arquitectura.dataModel.diagramHint")}</p>
      <details className={styles.relations}>
        <summary>
          {COPY.relationships} {model.relationships.length}
        </summary>
        {model.relationships.map((relation) => (
          <button
            type="button"
            className="rel-row"
            key={relation.id}
            aria-label={`${COPY.relation} ${relation.name ?? relation.id}`}
            aria-pressed={selection?.kind === "relationship" && selection.id === relation.id}
            onClick={() => select({ kind: "relationship", id: relation.id })}
          >
            {relation.name ?? relation.id}:{" "}
            {model.entities.find((entity) => entity.id === relation.from.entity)?.name}{" "}
            {relation.from.min}..{relation.from.max === "many" ? "*" : relation.from.max} →{" "}
            {model.entities.find((entity) => entity.id === relation.to.entity)?.name}{" "}
            {relation.to.min}..{relation.to.max === "many" ? "*" : relation.to.max}
          </button>
        ))}
      </details>
    </div>
  );
}

function isPhone(): boolean {
  return window.matchMedia?.("(max-width: 759px)").matches ?? false;
}
function subscribePhone(listener: () => void): () => void {
  const media = window.matchMedia?.("(max-width: 759px)");
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}
