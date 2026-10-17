"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/core/Button/Button";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import type { DataModel, DataModelResult } from "@/lib/architecture/data-model/types";
import { COPY } from "./copy.es";
import { DiagramControls } from "./DiagramControls";
import type { ModelLayout, ModelSelection } from "./layout";
import { ModelDiagram } from "./ModelDiagram";
import { ModelSchema } from "./ModelSchema";
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

function ReadyViewer({
  model,
  source,
  layout,
}: {
  model: DataModel;
  source: string;
  layout: ModelLayout;
}) {
  const [mode, setMode] = useState("diagram");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<ModelSelection>(null);
  const [isExpanded, setExpanded] = useState(false);
  const viewport = useViewport(layout, isExpanded, mode);
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandButtonRef = useRef<HTMLSpanElement>(null);
  const matches = model.entities
    .filter((entity) =>
      [
        entity.name,
        entity.id,
        ...entity.attributes.flatMap((attribute) => [attribute.name, attribute.id]),
      ].some((text) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
    )
    .map((entity) => entity.id);
  useEffect(() => {
    if (!isExpanded) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-testid="model-close"]')?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      expandButtonRef.current?.querySelector("button")?.focus();
    };
  }, [isExpanded]);
  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    if (!next.trim()) return;
    const match = layout.nodes.find((node) =>
      [
        node.entity.name,
        node.entity.id,
        ...node.entity.attributes.flatMap((attribute) => [attribute.name, attribute.id]),
      ].some((text) => text.toLocaleLowerCase().includes(next.trim().toLocaleLowerCase())),
    );
    if (match) {
      setSelection({ kind: "entity", id: match.entity.id });
      viewport.focusNode(match);
    }
  }
  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setExpanded(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input,[tabindex="0"]',
      ),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
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
        onSelect={setSelection}
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
          <span ref={expandButtonRef}>
            <Button size="sm" onClick={() => setExpanded(true)}>
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
            <>
              <DiagramControls viewport={viewport} />
              {renderDiagram(false)}
            </>
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
            ref={dialogRef}
            className={`${styles.dialog} ${styles.viewer}`}
            aria-label={COPY.title}
            onCancel={() => setExpanded(false)}
            onKeyDown={handleDialogKeyDown}
          >
            {renderDiagram(true)}
            <div className={styles.expandedToolbar}>
              <Button size="sm" data-testid="model-close" onClick={() => setExpanded(false)}>
                {COPY.close}
              </Button>
              {renderSearch()}
              {query && (
                <p className={styles.searchStatus} role="status">
                  {matches.length ? COPY.matches(matches.length) : COPY.noResults}
                </p>
              )}
            </div>
            <div className={styles.expandedControls}>
              <DiagramControls viewport={viewport} />
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
