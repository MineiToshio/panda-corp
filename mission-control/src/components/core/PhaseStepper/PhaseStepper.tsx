import { PHASE_PRESENTATION, PHASES, type Phase } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import styles from "./PhaseStepper.module.css";

export interface PhaseStepperProps {
  /** Current phase id; an unknown or absent phase leaves every segment pending. */
  readonly phase: string | undefined;
  readonly compact?: boolean;
}

type StepState = "past" | "current" | "next";

function stateOf(index: number, current: number): StepState {
  if (index < current) return "past";
  return index === current ? "current" : "next";
}

/** Six-segment phase progress: past, current and pending are told by text (screen readers, tooltip) as well as hue. */
export function PhaseStepper({ phase, compact = false }: PhaseStepperProps): React.JSX.Element {
  const current = PHASES.indexOf(phase as Phase);
  const currentId = PHASES[current];
  const currentLabel = t(currentId ? PHASE_PRESENTATION[currentId].labelKey : "common.phases.none");
  return (
    <ol
      className={["stepper", styles.stepper, compact && "compact", compact && styles.compact]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("common.phaseSteps.aria", { phase: currentLabel })}
    >
      {PHASES.map((id, index) => {
        const { tone, labelKey } = PHASE_PRESENTATION[id];
        const state = stateOf(index, current);
        const status = t(`common.phaseSteps.${state}`);
        const label = t(labelKey);
        const tip = t("common.phaseSteps.tip", { index: index + 1, phase: label, status });
        return (
          <li key={id} className={styles.step} data-state={state} data-tone={tone} data-tip={tip}>
            <span className={styles.line} aria-hidden="true" />
            <span className={styles.label} aria-hidden="true">
              {label}
            </span>
            <span className="sr-only">
              {t("common.phaseSteps.srLabel", { phase: label, status })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
