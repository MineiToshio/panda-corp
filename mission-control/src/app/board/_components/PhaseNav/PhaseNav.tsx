import type { Tone } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import styles from "./PhaseNav.module.css";

interface Phase {
  id: string;
  step: number;
  label: string;
  tone: Tone;
  cards: readonly unknown[];
}
/** Jump to a visible column, respecting reduced motion. */
export function PhaseNav({ phases }: { phases: readonly Phase[] }): React.JSX.Element {
  function jump(id: string): void {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`phase-${id}`)?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: "nearest",
      inline: "start",
    });
  }
  return (
    <nav
      className={`phase-nav ${styles.nav}`}
      aria-label={t("tablero.phaseNavAria")}
      data-scroll-x="intentional"
    >
      {phases.map((phase, index) => (
        <button
          type="button"
          key={phase.id}
          data-tone={phase.tone}
          data-phase-jump={phase.id}
          aria-current={index === 0}
          aria-label={`${phase.step} ${phase.label} ${phase.cards.length}`}
          onClick={() => jump(phase.id)}
        >
          <span className="dot" aria-hidden="true" />
          {phase.label}
          <span className={styles.count}>{phase.cards.length}</span>
        </button>
      ))}
    </nav>
  );
}
