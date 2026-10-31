import { Card, CardFoot, CardHeader } from "@/components/core/Card/Card";
import {
  WORK_ORDER_STACK_STATES,
  WORK_ORDER_STATE_PRESENTATION,
} from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import { StackBar } from "@/components/core/ProgressBar/StackBar";
import { t } from "@/lib/copy/copy";
import type { ProjectFrd } from "@/lib/frds/frd-index";
import { navigationHref } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import styles from "./tab-summary.module.css";

/** Shared FRD identities with live order state stacks, unfinished first, capped at eight. */
export function FrdProgress({
  frds,
  orders,
  navigationBaseHref,
  error,
  issues,
}: {
  readonly frds: readonly ProjectFrd[];
  readonly orders: readonly WorkOrder[];
  readonly navigationBaseHref: string;
  readonly error?: React.ReactNode;
  readonly issues?: React.ReactNode;
}): React.JSX.Element {
  const rows = frds
    .map((frd) => {
      const children = orders.filter((order) => order.frd === frd.slug);
      const done = children.filter((order) => order.state === "done").length;
      return { ...frd, children, done, complete: children.length > 0 && done === children.length };
    })
    .sort((a, b) => Number(a.complete) - Number(b.complete) || a.code.localeCompare(b.code));
  return (
    <Card tone="violet">
      <CardHeader
        title={t("workspace.resumen.frdProgress.title")}
        count={error ? undefined : frds.length}
        icon="clipboard"
      />
      {issues}
      {error ??
        (rows.length ? (
          <>
            <p className={styles.meta}>{t("workspace.resumen.frdProgress.intro")}</p>
            <ul className={styles.frds}>
              {rows.slice(0, 8).map((frd) => (
                <li key={frd.slug}>
                  <a
                    className={styles.frdRow}
                    href={navigationHref(navigationBaseHref, {
                      tab: "observability",
                      frd: frd.code,
                    })}
                  >
                    <div className={styles.grow}>
                      <strong>
                        <code>{frd.code}</code> {frd.title}
                      </strong>
                      <StackBar
                        segments={WORK_ORDER_STACK_STATES.map((state) => ({
                          label: t(WORK_ORDER_STATE_PRESENTATION[state].labelKey),
                          tone: WORK_ORDER_STATE_PRESENTATION[state].tone,
                          count: frd.children.filter(
                            (order) => (order.state === "fail" ? "blocked" : order.state) === state,
                          ).length,
                        }))}
                      />
                    </div>
                    <span className={styles.meta}>
                      {frd.done}/{frd.children.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {rows.length > 8 && (
              <CardFoot>
                <span className={styles.meta}>
                  {t("workspace.resumen.frdProgress.total", { count: frds.length })}
                </span>
                <a
                  className={styles.seeAll}
                  href={navigationHref(navigationBaseHref, { tab: "observability", frd: null })}
                >
                  {t("workspace.resumen.frdProgress.seeAll")}
                  <Icon name="arrow" size="sm" />
                </a>
              </CardFoot>
            )}
          </>
        ) : !issues ? (
          <p className={styles.empty}>{t("workspace.resumen.frdProgress.empty")}</p>
        ) : null)}
    </Card>
  );
}
