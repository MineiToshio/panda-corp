import type { ReactNode } from "react";
import styles from "./reportBand.module.css";

/** Shared report introduction with authored lead and caller-owned metadata chips. */
export function DigestHero({
  eyebrow,
  title,
  lead,
  chips,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly lead?: ReactNode;
  readonly chips?: ReactNode;
}): React.JSX.Element {
  return (
    <header className={`dhero ${styles.hero}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      {title && <h2>{title}</h2>}
      {lead && <div className={styles.lead}>{lead}</div>}
      <div className={styles.chips}>{chips}</div>
    </header>
  );
}
