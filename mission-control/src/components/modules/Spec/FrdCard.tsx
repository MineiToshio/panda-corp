import { Chip } from "@/components/core/Chip/Chip";
import {
  WORK_ORDER_STACK_STATES,
  WORK_ORDER_STATE_PRESENTATION,
} from "@/components/core/Chip/vocabulary";
import { StackBar } from "@/components/core/ProgressBar/StackBar";
import styles from "@/components/modules/ReportBand/reportBand.module.css";
import { t } from "@/lib/copy/copy";
import { frdKind } from "@/lib/spec/frdKind";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

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
  const title = frd.title.replace(/^FRD-\d+\s*(?:[—–:·-]\s*)?/iu, "");
  const done = workOrders.filter((order) => order.state === "done").length;
  const segments = WORK_ORDER_STACK_STATES.map((key) => {
    const state = key === "blocked" ? "fail" : key;
    return {
      label: t(WORK_ORDER_STATE_PRESENTATION[key].labelKey),
      tone: WORK_ORDER_STATE_PRESENTATION[key].tone,
      count: workOrders.filter((order) => order.state === state).length,
    };
  });
  return (
    <button
      type="button"
      className={`frdc ${styles.frd}`}
      onClick={onOpen}
      data-testid={testId}
      aria-label={`${frd.id} ${title}`}
    >
      <span className={styles.frdHead}>
        <code className={styles.fcode} data-tone="violet">
          {frd.id}
        </code>
        <Chip tone={kind.tone}>{kind.label}</Chip>
      </span>
      <b>{title}</b>
      {frd.summary && <span>{frd.summary}</span>}
      {started ? (
        workOrders.length > 0 ? (
          <div className={styles.frdProgress}>
            <StackBar segments={segments} />
            <span>
              {done}/{workOrders.length}
            </span>
          </div>
        ) : (
          <span>{t("workspace.hero.stats.noPlan")}</span>
        )
      ) : (
        <span>{t("workspace.spec.frdCard.ordersPlanned", { count: workOrders.length })}</span>
      )}
    </button>
  );
}
