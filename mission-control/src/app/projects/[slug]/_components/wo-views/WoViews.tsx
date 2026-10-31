"use client";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { Icon } from "@/components/core/Icon/Icon";
import { Segmented } from "@/components/core/Segmented/Segmented";
import { t } from "@/lib/copy/copy";
import type { FrdDriftResult } from "@/lib/frds/frd-drift";
import type { ProjectFrd } from "@/lib/frds/frd-index";
import { useNavigationRouter } from "@/lib/navigation/NavigationProvider";
import { type NavigationPatch, type NavigationState, navigationHref } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderBoard } from "../wo-board/wo-board";
import { WoFrdFilter } from "../wo-frd-filter/wo-frd-filter";
import { WoStateFilter } from "../wo-state-filter/wo-state-filter";
import { filterOrders, parseStates, selectedFrd } from "./selection";
import styles from "./views.module.css";
import { WoByFrd } from "./WoByFrd";
/** URL-owned toolbar and presentational views over the single server-supplied order set. */
export function WoViews({
  orders,
  frds,
  drifts,
  href,
  state,
  children,
}: {
  orders: WorkOrder[];
  frds: readonly ProjectFrd[];
  drifts: Record<string, FrdDriftResult>;
  href: string;
  state: NavigationState;
  children?: React.ReactNode;
}): React.JSX.Element {
  const router = useNavigationRouter();
  const view = state.view === "tablero" || state.view === "deps" ? state.view : "frd";
  const frd = selectedFrd(frds, state.frd),
    states = parseStates(state.state);
  const scoped = filterOrders(orders, frd, []),
    visible = filterOrders(scoped, "", states);
  const indexed = frds.filter((frd) => orders.some((order) => order.frd === frd.slug));
  function navigate(patch: NavigationPatch) {
    const liveHref = `${window.location.pathname}${window.location.search}`;
    const base = /^\/(portfolio|projects)\//.test(liveHref) ? liveHref : href;
    router.push(navigationHref(base, { wo: null, woview: null, ...patch }));
  }
  return (
    <div className={styles.wrap}>
      <div className={`frd-tools ${styles.toolbar}`}>
        <div className={styles.viewSwitch}>
          <Icon name={view === "frd" ? "list" : view === "tablero" ? "columns" : "link"} />
          <Segmented
            label={t("workspace.observabilidad.views.aria")}
            value={view}
            options={[
              { value: "frd", label: t("workspace.observabilidad.views.byFrd") },
              { value: "tablero", label: t("workspace.observabilidad.views.board") },
              { value: "deps", label: t("workspace.observabilidad.views.deps") },
            ]}
            onChange={(value) => navigate({ view: value === "frd" ? null : value })}
          />
        </div>
        {view !== "deps" && (
          <WoFrdFilter
            frds={indexed.map((frd) => frd.code)}
            index={indexed}
            selected={frds.find((item) => item.slug === frd)?.code ?? null}
            onSelect={(frd) => navigate({ frd })}
          />
        )}
        <span className={styles.count}>
          {t("workspace.observabilidad.filters.count", { count: visible.length })}
        </span>
      </div>
      {view === "deps" ? (
        children
      ) : (
        <>
          <WoStateFilter
            selected={null}
            states={states}
            orders={scoped}
            hasFailures={orders.some((order) => order.state === "fail")}
            onSelect={() => {}}
            onStatesChange={(states) =>
              navigate({ state: states.length ? states.join(",") : null })
            }
          />
          {!visible.length ? (
            <EmptyState icon="search">{t("workspace.observabilidad.filters.noMatches")}</EmptyState>
          ) : view === "tablero" ? (
            <WorkOrderBoard
              orders={visible}
              navigationBaseHref={href}
              hasFailures={orders.some((order) => order.state === "fail")}
            />
          ) : (
            <WoByFrd
              key={`${frd}:${states.join(",")}`}
              orders={visible}
              allOrders={orders}
              frds={frds}
              drifts={drifts}
              href={href}
              filtered={!!frd || !!states.length}
            />
          )}
        </>
      )}
    </div>
  );
}
