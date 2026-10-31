"use client";
import { useState, useSyncExternalStore } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Paper } from "@/components/modules/DocumentReader/Paper";
import { t } from "@/lib/copy/copy";
import { workspaceCommands } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";
import styles from "./IdeaDocs.module.css";

interface Section {
  readonly heading: string;
  readonly items: readonly { readonly relPath: string; readonly label: string }[];
}
function subscribe(listener: () => void): () => void {
  if (!window.matchMedia) return () => {};
  const media = window.matchMedia("(min-width: 900px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function wide(): boolean {
  return window.matchMedia?.("(min-width: 900px)").matches ?? false;
}

/** Curated right-hand rail, folded on phones, and a shared document paper. */
export function IdeaDocs({
  sections,
  selectedDocKey,
  onSelectDoc,
  onSelectSummary,
  title,
  path,
  phase,
  children,
}: {
  readonly sections: readonly Section[];
  readonly selectedDocKey: string;
  readonly onSelectDoc: (key: string) => void;
  readonly onSelectSummary: () => void;
  readonly title: string;
  readonly path: string;
  readonly phase?: Phase;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const isWide = useSyncExternalStore(subscribe, wide, () => false);
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className={`docs-layout ${styles.layout}`}>
        <div data-testid="card-detail-doc-reader">
          <Paper type={title} path={path}>
            {children}
          </Paper>
        </div>
        <details
          className={`docs-rail ${styles.rail}`}
          data-tone="violet"
          open={isWide || expanded}
          onToggle={(event) => {
            if (!isWide) setExpanded(event.currentTarget.open);
          }}
        >
          <summary>
            {t("idea.docs.change", {
              count: sections.reduce((sum, section) => sum + section.items.length, 0),
            })}
          </summary>
          <nav aria-label={t("idea.docs.railAria")} data-testid="card-detail-docs-nav">
            <h2>{t("idea.docs.sectionDocuments")}</h2>
            <button
              type="button"
              aria-current={selectedDocKey === "summary" ? "true" : undefined}
              data-testid="card-detail-docs-nav-resumen"
              onClick={onSelectSummary}
            >
              {t("idea.docs.summary")}
            </button>
            {sections.map((section) => (
              <section key={section.heading}>
                <h3 data-testid="card-detail-docs-nav-section">{section.heading}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.relPath}>
                      <button
                        type="button"
                        data-testid="card-detail-docs-nav-item"
                        aria-current={selectedDocKey === item.relPath ? "true" : undefined}
                        onClick={() => onSelectDoc(item.relPath)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </details>
      </div>
      {(phase === "implementation" || phase === "release") && (
        <section>
          {workspaceCommands(phase).map((command) => (
            <CmdRow key={command.command} command={command.command} variant="box" />
          ))}
        </section>
      )}
    </>
  );
}
