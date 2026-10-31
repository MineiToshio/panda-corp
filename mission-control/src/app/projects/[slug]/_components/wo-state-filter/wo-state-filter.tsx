"use client";
import { StateTile } from "@/components/core/StateTile/StateTile";
import { t } from "@/lib/copy/copy";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { presentation, STATES } from "../wo-views/selection";
import styles from "../wo-views/views.module.css";
export interface WoStateFilterProps {
  selected: WorkOrderState | null;
  onSelect: (state: WorkOrderState | null) => void;
  states?: readonly WorkOrderState[];
  onStatesChange?: (states: WorkOrderState[]) => void;
  orders?: readonly WorkOrder[];
  hasFailures?: boolean;
}
/** Combinable state tiles; counts reflect the FRD-scoped set before the state union. */
export function WoStateFilter({
  selected,
  onSelect,
  states,
  orders = [],
  onStatesChange,
  hasFailures = orders.some((order) => order.state === "fail"),
}: WoStateFilterProps): React.JSX.Element {
  const active = states ?? (selected ? [selected] : []);
  function toggle(state: WorkOrderState) {
    const next = STATES.filter((item) =>
      item === state ? !active.includes(item) : active.includes(item),
    );
    if (onStatesChange) onStatesChange(next);
    else onSelect(next.at(-1) ?? null);
  }
  return (
    <fieldset
      className={`state-strip ${styles.strip}`}
      aria-label={t("workspace.observabilidad.filters.stateAria")}
    >
      {STATES.filter((state) => state !== "fail" || hasFailures || active.includes(state)).map(
        (state) => {
          const count = orders.filter((order) => order.state === state).length;
          const meta = presentation(state);
          return (
            <StateTile
              key={state}
              label={t(meta.labelKey)}
              tone={meta.tone}
              count={count}
              progress={orders.length ? (count / orders.length) * 100 : 0}
              pressed={active.includes(state)}
              onClick={() => toggle(state)}
            />
          );
        },
      )}
    </fieldset>
  );
}
