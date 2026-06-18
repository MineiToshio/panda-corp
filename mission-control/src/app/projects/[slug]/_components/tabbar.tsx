"use client";
/**
 * WO-04-004 — TabBar (CMP-04-tabbar)
 *
 * Client Component ("use client"): tab selection for the project workspace.
 *   - Five tabs in exact order: Summary · Work orders · Party · Documents · Commands (AC-04-001.1).
 *   - URL-driven selection: receives activeTab prop (derived from ?tab= search param by page.tsx).
 *   - role="tablist" with aria-selected on the active tab (AC-04-001.1, a11y).
 *   - Each tab is an anchor link with href="?tab=<id>" so the server can read the param.
 *   - Spanish labels (architecture §7 — UI copy in Spanish).
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid="tabbar" on the container; data-testid="tab-<id>" on each tab.
 *
 * NOTE: Only CMP-04-tabbar is "use client". All other workspace components are
 * Server Components (blueprint §4, WO-04-004 Definition of Done).
 *
 * Traceability:
 *   CMP-04-tabbar → REQ-04-001
 *   AC-04-001.1 — exactly five tabs in order
 *   AC-04-001.2 — default Summary; reflects ?tab= param
 */

// ---------------------------------------------------------------------------
// Tab definitions (AC-04-001.1 — five tabs in exact order)
// ---------------------------------------------------------------------------

export type TabId = "summary" | "work-orders" | "party" | "documents" | "commands";

interface TabDef {
  id: TabId;
  label: string; // Spanish label (architecture §7)
}

const TABS: TabDef[] = [
  { id: "summary", label: "Resumen" },
  { id: "work-orders", label: "Work orders" },
  { id: "party", label: "Party" },
  { id: "documents", label: "Documentos" },
  { id: "commands", label: "Comandos" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TabBarProps {
  /**
   * The currently active tab id.
   * Derived by page.tsx from the ?tab= search param; defaults to "summary"
   * when the param is absent or invalid (AC-04-001.2).
   */
  activeTab: TabId;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const TABLIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: 0,
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
  overflowX: "auto",
  scrollbarWidth: "none",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 5)",
    fontSize: "0.8125rem",
    fontWeight: active ? 600 : 400,
    color: active
      ? "var(--color-accent, oklch(0.65 0.18 250))"
      : "var(--color-text-muted, currentColor)",
    textDecoration: "none",
    borderBottom: active
      ? "2px solid var(--color-accent, oklch(0.65 0.18 250))"
      : "2px solid transparent",
    marginBottom: "-1px", // overlap the container border-bottom
    background: "none",
    border: "none",
    borderBottomColor: active ? "var(--color-accent, oklch(0.65 0.18 250))" : "transparent",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition:
      "color var(--duration-fast, 150ms) var(--easing-standard, ease), border-color var(--duration-fast, 150ms) var(--easing-standard, ease)",
    outline: "none",
  };
}

// ---------------------------------------------------------------------------
// TabBar component
// ---------------------------------------------------------------------------

/**
 * CMP-04-tabbar — URL-driven tab bar for the project workspace.
 *
 * "use client" directive is at the top of this file. All other workspace shell
 * components (header, objectives bar, page) are Server Components.
 *
 * Tab navigation is URL-driven via href="?tab=<id>"; no client-side state.
 * The active tab is determined server-side from the ?tab= search param and
 * passed in as the `activeTab` prop.
 */
export function TabBar({ activeTab }: TabBarProps): React.JSX.Element {
  return (
    <nav data-testid="tabbar" aria-label="Pestañas del espacio de trabajo" style={TABLIST_STYLE}>
      <div role="tablist" style={{ display: "contents" }}>
        {TABS.map(({ id, label }) => {
          const isActive = id === activeTab;
          return (
            <a
              key={id}
              href={`?tab=${id}`}
              role="tab"
              data-testid={`tab-${id}`}
              data-tab={id}
              aria-selected={isActive ? "true" : "false"}
              tabIndex={isActive ? 0 : -1}
              style={tabStyle(isActive)}
            >
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
