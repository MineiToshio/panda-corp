"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/core/Button/Button";
import { Icon } from "@/components/core/Icon/Icon";
import { StackBar } from "@/components/core/ProgressBar/StackBar";
import { t } from "@/lib/copy/copy";
import type { FrdDriftResult } from "@/lib/frds/frd-drift";
import type { ProjectFrd } from "@/lib/frds/frd-index";
import { aggregateProgress } from "@/lib/work-orders/progress";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { DriftNote } from "../../_observability/FrdDriftBadge/DriftNote";
import { FrdDriftBadge } from "../../_observability/FrdDriftBadge/FrdDriftBadge";
import { presentation, STATES } from "./selection";
import styles from "./views.module.css";
import { WorkOrderRow } from "./WorkOrderRow";
/** Native FRD groups with filter-open defaults and one browser-local expand-all action. */
export function WoByFrd({
  orders,
  allOrders = orders,
  frds,
  drifts,
  href,
  filtered,
}: {
  orders: WorkOrder[];
  allOrders?: WorkOrder[];
  frds: readonly ProjectFrd[];
  drifts: Record<string, FrdDriftResult>;
  href: string;
  filtered: boolean;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(filtered);
  const root = useRef<HTMLDivElement>(null);
  function toggleAll() {
    const next = !expanded;
    root.current?.querySelectorAll("details").forEach((row) => {
      row.open = next;
    });
    setExpanded(next);
  }
  return (
    <div ref={root}>
      <div className={styles.tools}>
        <Button size="sm" icon={expanded ? "minus" : "plus"} onClick={toggleAll}>
          {t(
            expanded
              ? "workspace.observabilidad.frdRows.collapseAll"
              : "workspace.observabilidad.frdRows.expandAll",
          )}
        </Button>
      </div>
      <div className={`frd-rows ${styles.groups}`}>
        {frds
          .filter((frd) => orders.some((order) => order.frd === frd.slug))
          .map((frd) => {
            const group = orders.filter((order) => order.frd === frd.slug),
              progress = aggregateProgress(group);
            const state = allOrders
              .filter((order) => order.frd === frd.slug)
              .every((order) => order.state === "done")
              ? "done"
              : "todo";
            return (
              <details
                className={`frd-row ${styles.group}`}
                key={frd.slug}
                open={filtered || undefined}
              >
                <summary>
                  <Icon name="chevR" size="sm" />
                  <span className={styles.name}>
                    <code>{frd.code}</code>
                    <strong>{frd.title}</strong>
                    <FrdDriftBadge
                      frdId={frd.slug}
                      state={state}
                      drift={drifts[frd.slug]}
                      project=""
                      navigationBaseHref={href}
                    />
                  </span>
                  <StackBar
                    segments={[...STATES].reverse().map((state) => ({
                      label: t(presentation(state).labelKey),
                      tone: presentation(state).tone,
                      count: group.filter((order) => order.state === state).length,
                    }))}
                  />
                  <span>
                    {progress.done}/{progress.total}
                  </span>
                  <b>{Math.round(progress.pct)}%</b>
                </summary>
                <DriftNote frdId={frd.slug} state={state} drift={drifts[frd.slug]} href={href} />
                <div className={`wo-list ${styles.list}`}>
                  {group.map((order) => (
                    <WorkOrderRow key={order.id} order={order} href={href} />
                  ))}
                </div>
              </details>
            );
          })}
      </div>
    </div>
  );
}
