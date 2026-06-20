/**
 * WO-04-005 — TabDocuments (CMP-04-tab-documents)
 *
 * Server Component: two-pane layout for the Documents tab.
 * Re-painted to prototype projDocs() on FRD-13 foundation (DR-054/056).
 *
 * Components used (components.md, DR-057):
 *   Panel → nav pane + body pane (prototype: .panel on each column)
 *
 * Design:
 *   - Left pane: grouped nav from DocNode[] (IF-04-docs, lib/docs.ts).
 *     Prototype: 200px .panel with .navitem rows grouped by label.
 *   - Right pane: rendered markdown body (react-markdown) in a .panel.doc.
 *   - Empty state when nodes is [] (AC-04-006.3).
 *
 * Selection is URL-driven (caller passes selectedId + content derived from
 * the ?doc=<id> search param); this component is purely presentational —
 * no client state, no "use client".
 *
 * Traceability:
 *   CMP-04-tab-documents → REQ-04-006
 *   AC-04-006.1 — feature-centric nav tree
 *   AC-04-006.2 — rendered markdown body (first doc default)
 *   AC-04-006.3 — graceful empty state
 *   IF-04-docs (lib/docs.ts, WO-04-001)
 */

import Markdown from "react-markdown";
import { Panel } from "@/components/core/Panel/Panel";
import type { DocNode } from "@/lib/docs/tree";

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
  display: "grid",
  gridTemplateColumns: "200px 1fr",
  gap: "14px",
  alignItems: "start",
  padding: "14px 16px",
};

const NAV_PANEL_STYLE: React.CSSProperties = {
  padding: "10px",
};

const NAV_GROUP_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  padding: "4px 6px",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  marginTop: "8px",
  marginBottom: "2px",
};

const NAV_ITEM_BASE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  padding: "7px 10px",
  borderRadius: "var(--radius-sm, 8px)",
  cursor: "pointer",
  fontSize: "13px",
  color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
  textDecoration: "none",
  transition: "background var(--duration-fast, 80ms) ease",
};

const NAV_ITEM_SELECTED_STYLE: React.CSSProperties = {
  ...NAV_ITEM_BASE_STYLE,
  background: "var(--color-accent-bg, var(--color-status-info-bg, #14303d))",
  color: "var(--color-accent-text, var(--color-accent, #33b6d1))",
  boxShadow: "inset 0 0 0 1px var(--color-accent, #33b6d1)",
};

const BODY_STYLE: React.CSSProperties = {
  padding: "16px 18px",
};

const PROSE_STYLE: React.CSSProperties = {
  maxWidth: "72ch",
  fontSize: "15px",
  lineHeight: 1.7,
  color: "var(--color-text)",
};

const LOADING_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 24px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  fontSize: "14px",
  opacity: 0.7,
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "48px 32px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  textAlign: "center",
};

const RAIL_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  padding: "0 6px 6px",
  marginBottom: "4px",
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
 * Re-painted to prototype projDocs() on FRD-13 Panel foundation (WO-04-005).
 * This is a Server Component (no "use client"). All interactivity is URL-driven:
 * the parent page reads the ?doc=<id> search param and passes down selectedId and content.
 *
 * Prototype: projDocs(i) → grid-template-columns:200px 1fr; nav .panel + body .panel.doc
 */
export function TabDocuments({ nodes, selectedId, content }: TabDocumentsProps): React.JSX.Element {
  // AC-04-006.3 — empty state when no docs are available
  if (nodes.length === 0) {
    return (
      <div
        data-testid="documents-empty"
        aria-label="Sin documentos disponibles"
        role="status"
        style={{ padding: "14px 16px" }}
      >
        <div style={EMPTY_STYLE}>
          <span aria-hidden="true" style={{ fontSize: "2rem" }}>
            📄
          </span>
          <p style={{ margin: 0, fontSize: "14px" }}>Sin documentos disponibles</p>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
            Los documentos del proyecto aparecerán aquí cuando estén generados
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupNodes(nodes);

  return (
    <section aria-label="Documentos del proyecto" style={ROOT_STYLE}>
      {/* Left pane: nav tree panel (AC-04-006.1) — prototype: .panel padding:10px */}
      <Panel>
        <div style={NAV_PANEL_STYLE}>
          <span style={RAIL_LABEL_STYLE}>DOCUMENTOS</span>
          <nav data-testid="documents-nav" aria-label="Árbol de documentos">
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
                      <span
                        aria-hidden="true"
                        className="ti ti-file-text"
                        style={{ fontSize: "13px", flexShrink: 0 }}
                      />
                      {node.label}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </Panel>

      {/* Right pane: markdown body (AC-04-006.2) or loading state */}
      {content !== null ? (
        <Panel>
          <div data-testid="documents-body" style={BODY_STYLE}>
            <article aria-label="Contenido del documento" className="doc" style={PROSE_STYLE}>
              <Markdown>{content}</Markdown>
            </article>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div
            data-testid="documents-loading"
            role="status"
            aria-label="Cargando documento"
            style={LOADING_STYLE}
          >
            <span>Cargando documento…</span>
          </div>
        </Panel>
      )}
    </section>
  );
}
