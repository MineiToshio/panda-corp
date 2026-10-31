import { Chip } from "@/components/core/Chip/Chip";
import { statePresentation } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import { t, tRich } from "@/lib/copy/copy";
import type { WorkOrderState } from "@/lib/work-orders/work-orders";
import styles from "./detail.module.css";

const STEPS = ["todo", "in_progress", "review", "done"] as const;
const NOW = {
  todo: "todo",
  in_progress: "inProgress",
  review: "review",
  done: "done",
  fail: "blocked",
} as const;
/** Flow header with one current step, or an explicit blocker instead of a false flow. */
export function WoSteps({ state }: { state: WorkOrderState }): React.JSX.Element {
  const current = (STEPS as readonly WorkOrderState[]).indexOf(state);
  const presentation = statePresentation(state === "fail" ? "blocked" : state);
  return (
    <div className={styles.flow}>
      {state === "fail" ? (
        <Chip tone="coral" icon="alert">
          {t(presentation.labelKey)}
        </Chip>
      ) : (
        <ol
          className={`wo-steps ${styles.steps}`}
          aria-label={t("workspace.observabilidad.detail.stepsAria")}
        >
          {STEPS.map((step, i) => (
            <li
              key={step}
              aria-current={i === current ? "step" : undefined}
              data-tone={statePresentation(step).tone}
            >
              <span className={`wo-step-dot ${styles.stepDot}`}>
                <Icon name={i < current ? "check" : statePresentation(step).icon} />
              </span>
              {t(statePresentation(step).labelKey)}
            </li>
          ))}
        </ol>
      )}
      <p className="wo-now">
        {tRich("workspace.observabilidad.detail.now", {
          text: t(`workspace.observabilidad.now.${NOW[state]}`),
        })}
      </p>
    </div>
  );
}
