import { Chip } from "@/components/core/Chip/Chip";
import { statePresentation } from "@/components/core/Chip/vocabulary";
import { StackBar } from "@/components/core/ProgressBar/StackBar";
import { t } from "@/lib/copy/copy";
import type { DependencyFrd, FrdBox } from "@/lib/deps-layout/types";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import styles from "./DependencyMap.module.css";
/** Compound FRD head with live state counts, at a fixed structure-derived position. */
export function DependencyFrdBox({
  box,
  frd,
  orders,
  onOpen,
}: {
  box: FrdBox;
  frd: DependencyFrd;
  orders: readonly WorkOrder[];
  onOpen: () => void;
}): React.JSX.Element {
  const states = ["todo", "in_progress", "review", "done", "fail"];
  return (
    <div
      className={`fdag-box ${styles.box}`}
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <button
        type="button"
        className={`fdag-head ${styles.boxHead}`}
        data-dag-frd={frd.slug}
        onClick={onOpen}
        title={t("workspace.observabilidad.dag.headTitle", { code: frd.code })}
      >
        <Chip tone="violet">{frd.code}</Chip>
        <span className={styles.title}>{frd.title}</span>
        <span>
          {orders.filter((order) => order.state === "done").length}/{orders.length}
        </span>
      </button>
      <div className={styles.bar}>
        <StackBar
          segments={states.map((state) => {
            const presentation = statePresentation(state === "fail" ? "blocked" : state);
            return {
              label: t(presentation.labelKey),
              count: orders.filter((order) => order.state === state).length,
              tone: presentation.tone,
            };
          })}
        />
      </div>
    </div>
  );
}
