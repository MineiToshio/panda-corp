"use client";

/** URL-driven workspace navigation shared by Portfolio and standalone project routes. */

import { useRouter, useSearchParams } from "next/navigation";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import { servicesCopy } from "@/components/modules/ServicesDirectory/copy";
import { navigationHref } from "@/lib/navigation/urls";

export type TabId =
  | "summary"
  | "spec"
  | "architecture"
  | "changes"
  | "observabilidad"
  | "documents"
  | "commands"
  | "accounts";

/** Ordered list fed into the shared SubTabs primitive. */
const WORKSPACE_TABS = [
  { id: "summary", label: "Resumen" },
  { id: "spec", label: "Spec" },
  { id: "observabilidad", label: "Observabilidad" },
  { id: "architecture", label: "Arquitectura" },
  { id: "accounts", label: servicesCopy.accountsTab },
  { id: "changes", label: "Cambios" },
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
  navigationBaseHref?: string;
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
export function TabBar({ activeTab, navigationBaseHref }: TabBarProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabChange(id: string) {
    // Merge into the CURRENT query so the embedding context survives (e.g. ?project= in Portfolio);
    // reset the per-tab sub-selection (doc/wo) when switching tabs.
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", id);
    next.delete("doc");
    next.delete("wo");
    next.delete("wotab");
    next.delete("woview");
    const liveHref = `${window.location.pathname}${window.location.search}`;
    const baseHref = /^\/(portfolio|projects)\//.test(liveHref) ? liveHref : navigationBaseHref;
    router.push(
      baseHref
        ? navigationHref(baseHref, {
            tab: id,
            doc: null,
            wo: null,
            wotab: null,
            woview: null,
          })
        : `?${next.toString()}`,
    );
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
