"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Tabs, type TabsProps } from "@/components/core/Tabs/Tabs";
import { t } from "@/lib/copy/copy";
import { navigationHref } from "@/lib/navigation/urls";
import type { WorkspaceProject } from "../_panels/workspaceProject";

export type TabId =
  | "summary"
  | "spec"
  | "observability"
  | "architecture"
  | "accounts"
  | "changes"
  | "documents"
  | "commands";
const WORKSPACE_TABS = [
  { id: "summary", label: t("common.workspaceTabs.resumen"), icon: "home", tone: "violet" },
  { id: "spec", label: t("common.workspaceTabs.spec"), icon: "book", tone: "blue" },
  {
    id: "observability",
    label: t("common.workspaceTabs.observabilidad"),
    icon: "activity",
    tone: "green",
  },
  {
    id: "architecture",
    label: t("common.workspaceTabs.arquitectura"),
    icon: "cube",
    tone: "amber",
  },
  { id: "accounts", label: t("common.workspaceTabs.cuentas"), icon: "users", tone: "teal" },
  { id: "changes", label: t("common.workspaceTabs.cambios"), icon: "branch", tone: "pink" },
  { id: "documents", label: t("common.workspaceTabs.documentos"), icon: "file", tone: "teal" },
  { id: "commands", label: t("common.workspaceTabs.comandos"), icon: "terminal", tone: "violet" },
] as const satisfies TabsProps["tabs"];
export interface TabBarProps {
  activeTab: TabId | "unknown";
  navigationBaseHref?: string;
  projectName?: string;
  counts?: WorkspaceProject["counts"];
}
export function TabBar({
  activeTab,
  navigationBaseHref,
  projectName = "",
  counts,
}: TabBarProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wrapper = useRef<HTMLElement>(null);
  const badges = {
    observability: counts?.orders,
    accounts: counts?.services,
    changes: counts?.openChanges,
    documents: counts?.documents,
  };
  const tabs = WORKSPACE_TABS.map((tab) => {
    const count = tab.id in badges ? badges[tab.id as keyof typeof badges] : null;
    return { ...tab, count: count != null && count > 0 ? count : undefined };
  });
  useEffect(() => {
    for (const button of wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ??
      []) {
      button.dataset.tabkey = "tab";
      const id = button.dataset.testid?.replace(/^tab-/, "");
      button.dataset.tabval = WORKSPACE_TABS.find((tab) => tab.id === id)?.label ?? "";
    }
  }, []);
  function handleTabChange(id: string): void {
    const patch = {
      tab: id,
      doc: null,
      wo: null,
      wotab: null,
      woview: null,
      specFrd: null,
      architectureFrd: null,
      adr: null,
      raw: null,
    };
    const liveHref = `${window.location.pathname}${window.location.search}`;
    const base = /^\/(portfolio|projects)\//.test(liveHref) ? liveHref : navigationBaseHref;
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.push(base ? navigationHref(base, patch) : `?${next}`);
  }
  return (
    <nav
      ref={wrapper}
      data-testid="tabbar"
      aria-label={t("portafolio.tabsAria", { project: projectName })}
      style={{ minWidth: 0 }}
    >
      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={handleTabChange}
        ariaLabel={t("portafolio.tabsAria", { project: projectName })}
        tabIdPrefix="workspace-tab-"
        panelIdPrefix="workspace-panel-"
      />
    </nav>
  );
}
