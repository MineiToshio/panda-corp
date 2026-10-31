import { statePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { DependencyPosition } from "@/lib/deps-layout/types";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import styles from "./DependencyMap.module.css";
/** Strip the redundant code prefix; the id has its own visible field. */
export function dependencyTitle(order: WorkOrder): string {
  return order.title.replace(/^WO-\d+-\d+\s*[—–:.-]?\s*/, "");
}
/** Natural-size work-order node. State changes presentation only, never position. */
export function DependencyNode({
  order,
  position,
  focus,
  chain,
  mini = false,
  onActivate,
  onHover,
}: {
  order: WorkOrder;
  position?: DependencyPosition;
  focus?: boolean;
  chain?: "on" | "dim";
  mini?: boolean;
  onActivate: () => void;
  onHover?: (id: string) => void;
}): React.JSX.Element {
  const presentation = statePresentation(order.state === "fail" ? "blocked" : order.state);
  const title = dependencyTitle(order);
  const name = t("workspace.observabilidad.dag.nodeTitle", {
    id: order.id,
    title,
    state: t(presentation.labelKey),
  });
  return (
    <button
      type="button"
      className={`dag-node ${styles.node} ${mini ? styles.mini : ""} ${position ? styles.positioned : styles.row}`}
      style={position ? { left: position.x, top: position.y } : undefined}
      data-wo={order.id}
      data-tone={presentation.tone}
      data-chain={chain}
      data-out={position?.outOfScope || undefined}
      aria-pressed={focus}
      aria-label={name}
      title={name}
      onClick={onActivate}
      onMouseEnter={() => onHover?.(order.id)}
      onMouseLeave={() => onHover?.("")}
      onFocus={() => onHover?.(order.id)}
      onBlur={() => onHover?.("")}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.id}>{order.id}</span>
      <span className={`dag-t ${styles.title}`}>{title}</span>
    </button>
  );
}
