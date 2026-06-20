"use client";

/**
 * WO-04-004 — TabBar (CMP-04-tabbar)
 *
 * Client Component ("use client"): tab selection for the project workspace.
 *   - Six tabs in exact order: Resumen · Work orders · Party · Observabilidad ·
 *     Documentos · Comandos (AC-04-001.1, WO-04-004 re-anchor).
 *   - URL-driven selection: receives activeTab prop (derived from ?tab= search
 *     param by page.tsx). On change, pushes the new ?tab= to the URL.
 *   - Built on the shared SubTabs primitive (DR-062 / WO-13-006) — no ad-hoc
 *     tab switcher. Uses testIdPrefix="tab-" so test-ids stay "tab-<id>".
 *   - Spanish labels (architecture §7 — UI copy in Spanish).
 *   - ZERO hardcoded colors — CSS custom properties only (via SubTabs tokens).
 *   - data-testid="tabbar" on the container.
 *
 * NOTE: Only CMP-04-tabbar is "use client". All other workspace components are
 * Server Components (blueprint §4, WO-04-004 Definition of Done).
 *
 * Traceability:
 *   CMP-04-tabbar → REQ-04-001
 *   AC-04-001.1 — exactly six tabs in order (WO-04-004: Observabilidad added)
 *   AC-04-001.2 — default Summary; reflects ?tab= param
 */

import { useRouter } from "next/navigation";
import { SubTabs } from "@/components/core/Tabs/Tabs";

// ---------------------------------------------------------------------------
// Tab definitions (AC-04-001.1 — six tabs in exact order per prototype
// projectPane() line 897 of docs/design/prototype/index.html)
// ---------------------------------------------------------------------------

export type TabId =
  | "summary"
  | "work-orders"
  | "party"
  | "observabilidad"
  | "documents"
  | "commands";

/** Ordered list fed into the shared SubTabs primitive. */
const WORKSPACE_TABS = [
  { id: "summary", label: "Resumen" },
  { id: "work-orders", label: "Work orders" },
  { id: "party", label: "Party" },
  { id: "observabilidad", label: "Observabilidad" },
  { id: "documents", label: "Documentos" },
  { id: "commands", label: "Comandos" },
] as const satisfies ReadonlyArray<{ id: TabId; label: string }>;

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
// Container style — only for positioning; SubTabs handles the pill visuals.
// ---------------------------------------------------------------------------

const WRAPPER_STYLE: React.CSSProperties = {
  padding: "0 14px 10px",
};

// ---------------------------------------------------------------------------
// TabBar component
// ---------------------------------------------------------------------------

/**
 * CMP-04-tabbar — URL-driven tab bar for the project workspace.
 *
 * "use client" directive is at the top of this file. All other workspace shell
 * components (header, objectives bar, page) are Server Components.
 *
 * Tab navigation is URL-driven: onChange calls router.push("?tab=<id>") so
 * the server re-reads the ?tab= search param and renders the right tab body.
 * The active tab is determined server-side and passed in as the `activeTab` prop.
 *
 * Uses the shared SubTabs primitive (DR-062 — the one tab pattern, level="sub").
 */
export function TabBar({ activeTab }: TabBarProps): React.JSX.Element {
  const router = useRouter();

  function handleTabChange(id: string) {
    router.push(`?tab=${id}`);
  }

  return (
    <nav data-testid="tabbar" aria-label="Pestañas del espacio de trabajo">
      <div style={WRAPPER_STYLE}>
        <SubTabs
          tabs={WORKSPACE_TABS as unknown as Array<{ id: string; label: string }>}
          active={activeTab}
          onChange={handleTabChange}
          ariaLabel="Pestañas del espacio de trabajo"
          testIdPrefix="tab-"
        />
      </div>
    </nav>
  );
}
