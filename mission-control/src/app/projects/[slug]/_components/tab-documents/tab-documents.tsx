/**
 * WO-04-006 — TabDocuments (CMP-04-tab-documents)
 *
 * Server Component: two-pane layout for the Documents tab.
 *   - Left pane: grouped nav from `DocNode[]` (IF-04-docs, lib/docs.ts).
 *   - Right pane: rendered markdown body of the selected doc (react-markdown).
 *   - Empty state when nodes is [] (AC-04-006.3).
 *   - Loading state when nodes are present but content is null.
 *
 * Selection is URL-driven (caller passes selectedId + content derived from
 * the `?doc=<id>` search param); this component is purely presentational —
 * no client state, no `"use client"`.
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive/significant element.
 *   - Spanish aria-labels and empty state copy.
 *
 * Traceability:
 *   CMP-04-tab-documents → REQ-04-006
 *   AC-04-006.1 — feature-centric nav tree
 *   AC-04-006.2 — raw markdown body via react-markdown (first doc default)
 *   AC-04-006.3 — graceful empty state
 *   IF-04-docs (lib/docs.ts, docs/api.md WO-04-001)
 */

import Markdown from "react-markdown";
import type { DocNode } from "@/lib/docs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TabDocumentsProps {
  /** Flat DocNode[] from listProjectDocs. Empty array → empty state (AC-04-006.3). */
  nodes: DocNode[];
  /** The id of the currently selected document (null when no doc is selected). */
  selectedId: string | null;
  /** Raw markdown of the selected document, or null when loading/unavailable. */
  content: string | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  height: "100%",
  overflow: "hidden",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const NAV_STYLE: React.CSSProperties = {
  width: "220px",
  flexShrink: 0,
  borderRight: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  overflowY: "auto",
  padding: "calc(var(--spacing, 0.25rem) * 3) 0",
};

const NAV_GROUP_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 4)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  marginTop: "calc(var(--spacing, 0.25rem) * 2)",
};

const NAV_ITEM_BASE_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "calc(var(--spacing, 0.25rem) * 1.5) calc(var(--spacing, 0.25rem) * 4)",
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  textDecoration: "none",
  borderRadius: 0,
  transition: "background var(--motion-duration-fast, 80ms) var(--motion-easing-default, ease)",
};

const NAV_ITEM_SELECTED_STYLE: React.CSSProperties = {
  ...NAV_ITEM_BASE_STYLE,
  background: "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.15))",
  color: "var(--color-accent, oklch(0.65 0.18 250))",
  fontWeight: 600,
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
};

const PROSE_STYLE: React.CSSProperties = {
  maxWidth: "72ch",
  fontSize: "0.9375rem",
  lineHeight: 1.7,
  color: "var(--color-text, currentColor)",
};

const LOADING_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.5,
  fontSize: "0.875rem",
};

const EMPTY_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 12)",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group DocNode[] by their `group` field, preserving insertion order.
 * Returns a Map<groupName, DocNode[]> with stable order (Product → Feature → Global).
 */
function groupNodes(nodes: DocNode[]): Map<string, DocNode[]> {
  const map = new Map<string, DocNode[]>();
  for (const node of nodes) {
    const existing = map.get(node.group);
    if (existing) {
      existing.push(node);
    } else {
      map.set(node.group, [node]);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// TabDocuments component
// ---------------------------------------------------------------------------

/**
 * Documents tab — two-pane layout: grouped nav + rendered markdown body.
 *
 * This is a Server Component (no `"use client"`). All interactivity is
 * URL-driven: the parent page reads the `?doc=<id>` search param and passes
 * down `selectedId` and `content`.
 */
export function TabDocuments({ nodes, selectedId, content }: TabDocumentsProps): React.JSX.Element {
  // AC-04-006.3 — empty state when no docs are available
  if (nodes.length === 0) {
    return (
      <section
        data-testid="documents-empty"
        aria-label="Sin documentos disponibles"
        role="status"
        style={ROOT_STYLE}
      >
        <div style={EMPTY_STYLE}>
          <span aria-hidden="true" style={{ fontSize: "2rem" }}>
            📄
          </span>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin documentos disponibles</p>
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>
            Los documentos del proyecto aparecerán aquí cuando estén generados
          </p>
        </div>
      </section>
    );
  }

  const grouped = groupNodes(nodes);

  return (
    <section aria-label="Documentos del proyecto" style={ROOT_STYLE}>
      {/* Left pane: nav tree (AC-04-006.1) */}
      <nav data-testid="documents-nav" aria-label="Árbol de documentos" style={NAV_STYLE}>
        {[...grouped.entries()].map(([group, groupNodes]) => (
          <div key={group}>
            <span style={NAV_GROUP_LABEL_STYLE}>{group}</span>
            {groupNodes.map((node) => {
              const isSelected = node.id === selectedId;
              return (
                <a
                  key={node.id}
                  href={`?doc=${encodeURIComponent(node.id)}`}
                  data-testid="doc-nav-item"
                  aria-current={isSelected ? "page" : undefined}
                  aria-label={`Abrir ${node.label} del grupo ${group}`}
                  style={isSelected ? NAV_ITEM_SELECTED_STYLE : NAV_ITEM_BASE_STYLE}
                >
                  {node.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Right pane: markdown body (AC-04-006.2) or loading state */}
      {content !== null ? (
        <div data-testid="documents-body" style={BODY_STYLE}>
          <article aria-label="Contenido del documento" style={PROSE_STYLE}>
            <Markdown>{content}</Markdown>
          </article>
        </div>
      ) : (
        <div
          data-testid="documents-loading"
          role="status"
          aria-label="Cargando documento"
          style={LOADING_STYLE}
        >
          <span>Cargando documento…</span>
        </div>
      )}
    </section>
  );
}
