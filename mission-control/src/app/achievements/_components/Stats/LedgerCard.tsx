import { Card, CardHeader } from "@/components/core/Card/Card";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { tierColor } from "@/lib/achievements/tiers";
import { t } from "@/lib/copy/copy";
import styles from "./Stats.module.css";

/** One ledger observation; null means there is no wired source. */
export interface LedgerEntry {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly level?: number;
  readonly noData?: boolean;
}

/** One aligned eight-row ledger, preserving unbounded numeric levels and their band pips. */
export function LedgerCard({
  title,
  tone,
  rows,
}: {
  readonly title: string;
  readonly tone: Tone;
  readonly rows: readonly LedgerEntry[];
}): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className={`ledger ${styles.ledger}`}
      data-testid="stat-ledger-column"
      data-tone={tone}
    >
      <Card tone={tone}>
        <CardHeader title={title} level={3} />
        <ul>
          {rows.map((row) => (
            <li
              aria-label={row.label}
              data-testid="stat-ledger-row"
              key={row.key}
              className={row.noData ? "nodata" : ""}
            >
              <span className={styles.grow}>{row.label}</span>
              {row.level !== undefined && !row.noData ? (
                <span className={`nv ${styles.level}`}>
                  <span
                    className={styles.pip}
                    data-band={Math.floor(row.level / 5)}
                    style={{ background: tierColor(Math.min(4, Math.floor(row.level / 5))) }}
                    aria-hidden="true"
                  />
                  {row.level === 0
                    ? t("logros.stats.noLevel")
                    : t("logros.stats.level", { level: row.level })}
                </span>
              ) : null}
              <b>
                {row.value === null ? (
                  <>
                    — <small>{t("logros.stats.notWired")}</small>
                  </>
                ) : row.noData ? (
                  t("logros.stats.noData")
                ) : (
                  row.value
                )}
              </b>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
