"use client";
import { useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { MoreBar } from "@/components/core/MoreBar/MoreBar";
import { t } from "@/lib/copy/copy";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { presentation } from "../wo-views/selection";
import styles from "./board.module.css";
import { WorkOrderCard } from "./WorkOrderCard";
/** CSS picks the 8/4 cap before paint; browser state only controls reveal-all. */
export function WorkOrderColumn({
  state,
  orders,
  href,
}: {
  state: WorkOrderState;
  orders: WorkOrder[];
  href: string;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false),
    meta = presentation(state);
  return (
    <section
      className={`kcol ${styles.column}`}
      data-tone={meta.tone}
      data-testid={`wo-column-${state}`}
      aria-label={t("workspace.observabilidad.kanban.columnAria", {
        state: t(meta.labelKey),
        count: orders.length,
      })}
    >
      <header>
        <Icon name={meta.icon} />
        <h3>{t(meta.labelKey)}</h3>
        <Chip tone={meta.tone}>{orders.length}</Chip>
      </header>
      {!orders.length ? (
        <p className={`kempty ${styles.empty}`}>{t("workspace.observabilidad.kanban.empty")}</p>
      ) : (
        <>
          <div className={styles.cards} data-expanded={expanded}>
            {orders.map((order) => (
              <WorkOrderCard key={order.id} order={order} href={href} />
            ))}
          </div>
          {expanded ? (
            <MoreBar
              label={t("workspace.observabilidad.kanban.showLess")}
              onClick={() => setExpanded(false)}
            />
          ) : (
            <>
              {orders.length > 8 && (
                <div className={styles.desktop}>
                  <MoreBar
                    label={t("workspace.observabilidad.kanban.showMore", {
                      count: orders.length - 8,
                    })}
                    onClick={() => setExpanded(true)}
                  />
                </div>
              )}
              {orders.length > 4 && (
                <div className={styles.phone}>
                  <MoreBar
                    label={t("workspace.observabilidad.kanban.showMore", {
                      count: orders.length - 4,
                    })}
                    onClick={() => setExpanded(true)}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
