"use client";
import { Tabs } from "@/components/core/Tabs/Tabs";
import { t } from "@/lib/copy/copy";
import { useNavigationRouter } from "@/lib/navigation/NavigationProvider";
import { navigationHref } from "@/lib/navigation/urls";
/** Small URL-owned island; document markdown stays on the server. */
export function DetailTabs({ active, href }: { active: string; href: string }): React.JSX.Element {
  const router = useNavigationRouter();
  return (
    <Tabs
      level="sub"
      active={active}
      ariaLabel={t("workspace.observabilidad.detail.viewAria")}
      tabIdPrefix="wo-detail-tab-"
      panelIdPrefix="wo-pane-"
      testIdPrefix="wo-detail-tab-"
      tabs={[
        { id: "summary", label: t("workspace.observabilidad.detail.viewSummary") },
        { id: "full", label: t("workspace.observabilidad.detail.viewFull") },
      ]}
      onChange={(id) =>
        router.push(navigationHref(href, { woview: id === "full" ? "full" : null }))
      }
    />
  );
}
