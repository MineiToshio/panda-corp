import type { ReactNode } from "react";
import { CardHeader } from "@/components/core/Card/Card";
import type { Tone } from "@/components/core/Chip/vocabulary";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./reportBand.module.css";

export interface ReportRow {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}
/** Shared tinted report band; supplied rows use a fixed label column and preserve authored content. */
export function ReportBand({
  title,
  level = 3,
  icon,
  action,
  tone = "slate",
  rows = [],
  children,
  testId,
}: {
  readonly title: string;
  readonly level?: 2 | 3 | 4;
  readonly icon?: IconName;
  readonly action?: ReactNode;
  readonly tone?: Tone;
  readonly rows?: readonly ReportRow[];
  readonly children?: ReactNode;
  readonly testId?: string;
}): React.JSX.Element {
  return (
    <section className={`band ${styles.band}`} data-tone={tone} data-testid={testId}>
      <div className={`band-head ${styles.head}`}>
        <CardHeader title={title} level={level} icon={icon} action={action} />
      </div>
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
