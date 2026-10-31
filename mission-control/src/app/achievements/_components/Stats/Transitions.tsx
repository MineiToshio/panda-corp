"use client";
import { useState } from "react";
import { MoreBar, pagedReveal } from "@/components/core/MoreBar/MoreBar";
import type { PhaseTransition } from "@/lib/achievements/report/types";
import { t } from "@/lib/copy/copy";
import { keyTransitions } from "../../Informe/informeData";
import styles from "./Stats.module.css";
import { TransitionRow } from "./TransitionRow";

/** Reveal ten observations per press; never render hidden duplicate rows. */
export function Transitions({
  rows,
}: {
  readonly rows: readonly PhaseTransition[];
}): React.JSX.Element {
  const [pressed, setPressed] = useState(0);
  const state = pagedReveal(rows.length, pressed, 10, 10);
  function handleMore(): void {
    setPressed((value) => value + 1);
  }
  if (!rows.length) return <p>{t("logros.stats.transitionsEmpty")}</p>;
  return (
    <>
      <ul className={`trans ${styles.list}`} aria-label={t("logros.stats.transitions")}>
        {keyTransitions(rows)
          .slice(0, state.visible)
          .map(({ key, transition }) => (
            <TransitionRow key={key} transition={transition} />
          ))}
      </ul>
      {state.remaining ? (
        <MoreBar
          label={t("propuestas.showMore", { count: state.next, remaining: state.remaining })}
          onClick={handleMore}
        />
      ) : null}
    </>
  );
}
