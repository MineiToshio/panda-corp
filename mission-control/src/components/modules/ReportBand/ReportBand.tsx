import type { ReactNode } from "react";
import type { Tone } from "@/components/core/Chip/vocabulary";
import styles from "./reportBand.module.css";

export interface ReportRow {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}
/** Shared tinted report band; supplied rows use a fixed label column and preserve authored content. */
export function ReportBand({
  title,
  tone = "slate",
  rows = [],
  children,
  testId,
}: {
  readonly title: string;
  readonly tone?: Tone;
  readonly rows?: readonly ReportRow[];
  readonly children?: ReactNode;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <section className={`band ${styles.band}`} data-tone={tone} data-testid={testId}>
      <header className={styles.head}>
        <h3>{title}</h3>
      </header>
      {rows.map((row) => (
        <div className={`brow ${styles.row}`} key={row.id}>
          <div className={styles.label}>{row.label}</div>
          <div className={styles.body}>{row.content}</div>
        </div>
      ))}
      {children}
    </section>
  );
}
