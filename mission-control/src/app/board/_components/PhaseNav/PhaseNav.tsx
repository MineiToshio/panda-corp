import { Chip } from "@/components/core/Chip/Chip";
import { t } from "@/lib/copy/copy";
import styles from "./PhaseNav.module.css";

interface Phase {
  id: string;
  step: number;
  label: string;
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
      {phases.map((phase) => (
        <button type="button" key={phase.id} onClick={() => jump(phase.id)}>
          {phase.step} {phase.label}{" "}
          <Chip tone="slate" variant="plain">
            {phase.cards.length}
          </Chip>
        </button>
      ))}
    </nav>
  );
}
