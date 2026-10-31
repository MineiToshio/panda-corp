"use client";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { Tabs } from "@/components/core/Tabs/Tabs";
import { t } from "@/lib/copy/copy";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
/** Public proposals tabs props contract. */
export interface ProposalsTabsProps {
  readonly summaryPanel: React.ReactNode;
  readonly memoryPanel: React.ReactNode;
  readonly backlogPanel: React.ReactNode;
  readonly backlogOpenCount?: number;
  readonly waitingCount?: number;
}
/** Three shared tabs keep their volatile panels mounted and preserve local state. */
export function ProposalsTabs({
  summaryPanel,
  memoryPanel,
  backlogPanel,
  backlogOpenCount,
  waitingCount,
}: ProposalsTabsProps): React.JSX.Element {
  const [value] = useUrlState("proposalsTab", "resumen");
  const active =
    value === "memory" || value === "memoria"
      ? "memoria"
      : value === "backlog"
        ? "backlog"
        : "resumen";
  const panels = { resumen: summaryPanel, memoria: memoryPanel, backlog: backlogPanel };
  return (
    <div>
      <Tabs
        ariaLabel={t("propuestas.tabs.aria")}
        active={active}
        onChange={(id) => updateNavigation({ proposalsTab: id })}
        testIdPrefix="proposals-tab-"
        tabIdPrefix="proposals-tab-id-"
        panelIdPrefix="proposals-panel-"
        tabs={[
          { id: "resumen", label: t("propuestas.tabs.resumen"), icon: "target", tone: "pink" },
          {
            id: "memoria",
            label: t("propuestas.tabs.memoria"),
            icon: "bulb",
            tone: "teal",
            count: waitingCount && waitingCount > 0 ? waitingCount : undefined,
          },
          {
            id: "backlog",
            label: t("propuestas.tabs.backlog"),
            icon: "list",
            tone: "blue",
            count: backlogOpenCount && backlogOpenCount > 0 ? backlogOpenCount : undefined,
          },
        ]}
      />
      {(Object.keys(panels) as (keyof typeof panels)[]).map((id) => (
        <div
          key={id}
          id={`proposals-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`proposals-tab-id-${id}`}
          hidden={active !== id}
          data-volatile
        >
          {panels[id]}
        </div>
      ))}
    </div>
  );
}

/** Tab links preserve the mounted panels through the tab strip's navigation path. */
export function ProposalsTabLink({
  href,
  className,
  children,
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    updateNavigation({ proposalsTab: href === "/proposals/memory" ? "memoria" : "backlog" });
  }
  return href === "/proposals/memory" || href === "/proposals/backlog" ? (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
