import { Chip } from "@/components/core/Chip/Chip";
import { StackBar } from "@/components/core/ProgressBar/StackBar";
import { ORDER_STATES } from "@/components/modules/ReportBand/PlanMosaic";
import styles from "@/components/modules/ReportBand/reportBand.module.css";
import { t } from "@/lib/copy/copy";
import { frdKind } from "@/lib/spec/frdKind";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

/** Whole-area FRD activation, with live progress shown only after construction starts. */
export function FrdCard({
  frd,
  workOrders = [],
  started = false,
  onOpen,
  testId,
}: {
  readonly frd: {
    id: string;
    title: string;
    tag?: string | null;
    ui?: string | boolean;
    summary?: string;
  };
  readonly workOrders?: readonly WorkOrder[];
  readonly started?: boolean;
  readonly onOpen: () => void;
  readonly testId?: string;
}): React.JSX.Element {
  const kind = frdKind(frd.tag, frd.ui);
  const segments = (Object.keys(ORDER_STATES) as WorkOrderState[]).map((state) => ({
    ...ORDER_STATES[state],
    count: workOrders.filter((order) => order.state === state).length,
  }));
  return (
    <button
      type="button"
      className={`frdc ${styles.frd}`}
      onClick={onOpen}
      data-testid={testId}
      aria-label={`${frd.id} ${frd.title}`}
    >
      <span className={styles.chips}>
        <code>{frd.id}</code>
        <Chip tone={kind.tone}>{kind.label}</Chip>
      </span>
      <b>{frd.title}</b>
      {frd.summary && <span>{frd.summary}</span>}
      {started ? (
        workOrders.length > 0 ? (
          <StackBar segments={segments} />
        ) : (
          <span>{t("workspace.hero.stats.noPlan")}</span>
        )
      ) : (
        <span>{t("workspace.spec.frdCard.ordersPlanned", { count: workOrders.length })}</span>
      )}
    </button>
  );
}
