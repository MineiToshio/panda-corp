"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/core/Button/Button";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import type { DataModel, DataModelResult } from "@/lib/architecture/data-model/types";
import { COPY } from "./copy.es";
import { layoutModel } from "./layout";
import { ModelDiagram } from "./ModelDiagram";
import type { ModelSelection } from "./ModelInspector";
import { ModelInspector } from "./ModelInspector";
import { ModelSchema } from "./ModelSchema";
import { useViewport } from "./useViewport";
import styles from "./viewer.module.css";

/** Read-only ERD and schema views of the published architecture artifact. */
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
        <ReadyViewer model={result.model} source={result.source} />
      ) : (
        <p className={styles.state}>{COPY.empty}</p>
      );
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function ReadyViewer({ model, source }: { model: DataModel; source: string }) {
  const [mode, setMode] = useState("diagram");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<ModelSelection>(null);
  const [isExpanded, setExpanded] = useState(false);
  const layout = useMemo(() => layoutModel(model), [model]);
  const viewport = useViewport(layout);
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const expandControlRef = useRef<HTMLSpanElement>(null);
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
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      dialog.close();
      const target = previousFocus.current?.isConnected
        ? previousFocus.current
        : expandControlRef.current?.querySelector("button");
      target?.focus();
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
  function handleExpand() {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setExpanded(true);
  }
  function handleClose() {
    setExpanded(false);
  }
  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input,[tabindex="0"]',
      ),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const content = (
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
        <label className={styles.search}>
          <span className={styles.srOnly}>{COPY.search}</span>
          <input type="search" value={query} onChange={handleSearch} placeholder={COPY.search} />
        </label>
        <span ref={expandControlRef}>
          <Button size="sm" onClick={isExpanded ? handleClose : handleExpand}>
            {isExpanded ? COPY.close : COPY.expand}
          </Button>
        </span>
      </div>
      {query && (
        <p className={styles.searchStatus} role="status">
          {matches.length ? COPY.matches(matches.length) : COPY.noResults}
        </p>
      )}
      <div role="tabpanel" aria-labelledby={`${id}-tab-${mode}`}>
        {mode === "diagram" ? (
          <ModelDiagram
            model={model}
            layout={layout}
            selection={selection}
            onSelect={setSelection}
            matches={matches}
            query={query}
            viewport={viewport}
            helpId={`${id}-help`}
          />
        ) : (
          <ModelSchema
            model={model}
            matches={matches}
            onSelect={(entityId) => setSelection({ kind: "entity", id: entityId })}
          />
        )}
      </div>
      <p className={styles.legend}>{COPY.keyLegend}</p>
      <ModelInspector model={model} selection={selection} onSelect={setSelection} />
    </div>
  );
  return isExpanded ? (
    <>
      <div className={styles.expandedPlaceholder} />
      {createPortal(
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-label={COPY.title}
          onCancel={handleClose}
          onKeyDown={handleDialogKeyDown}
        >
          {content}
        </dialog>,
        document.body,
      )}
    </>
  ) : (
    content
  );
}
