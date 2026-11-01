import { Card, CardHeader } from "@/components/core/Card/Card";
import { computeChains, metricLevel } from "@/lib/achievements/achievements";
import { neverRecorded, recordedKinds } from "@/lib/achievements/report/statProvenance";
import type { ReportScalars } from "@/lib/achievements/report/types";
import { computeStats, type ReaderData } from "@/lib/achievements/stats";
import { t } from "@/lib/copy/copy";
import { statIcon } from "../../_utils/statIcons";
import { attributesFor } from "../../_utils/viewRules";
import { RadarChart } from "../charts/RadarChart";
import { LedgerCard, type LedgerEntry } from "./LedgerCard";
import { RecordTile } from "./RecordTile";
import styles from "./Stats.module.css";
import type { StatsRecords } from "./types";

const COLUMNS = [
  {
    title: "production",
    tone: "gold",
    icon: "factory",
    keys: ["shipped", "workorders", "phases", "builds", "subagents"],
  },
  {
    title: "quality",
    tone: "teal",
    icon: "shield",
    keys: ["flawless", "gates", "reviews", "findings", "prds", "adrs"],
  },
  {
    title: "rhythm",
    tone: "violet",
    icon: "activity",
    keys: ["streak", "activedays", "speed", "ideas", "agents", "modes", "discarded", "iterations"],
  },
] as const;

/** Character sheet composed from existing engine formulas, with provenance-aware empty states. */
export function CharacterSheet({
  readerData,
  scalars,
  records,
  counterKinds,
}: {
  readonly readerData: ReaderData;
  readonly scalars?: ReportScalars;
  readonly records?: StatsRecords;
  readonly counterKinds?: readonly string[];
}): React.JSX.Element {
  const stats = computeStats(readerData);
  const byKey = new Map(stats.map((stat) => [stat.key, stat]));
  const kinds = new Set(counterKinds ?? recordedKinds(readerData));
  const value = (key: string): number => byKey.get(key)?.value ?? 0;
  const axes = attributesFor(stats, computeChains(stats));
  const recordRows = [
    {
      key: "shipped",
      label: "shipped",
      value: value("shipped"),
      level: metricLevel("shipped", value("shipped")),
    },
    { key: "streak", label: "streak", value: value("streak") },
    { key: "speed", label: "speed", value: value("speed") },
    { key: "peak", label: "peak", value: records?.peakWeek ?? null },
    { key: "lessons", label: "lessons", value: records?.capturedLessons ?? null },
    { key: "subagents", label: "subagents", value: records?.subagents ?? value("subagents") },
  ] as const;
  const extras: Record<string, LedgerEntry[]> = {
    production: (["frds", "commits", "projects"] as const).map((key) => ({
      key,
      label: t(`logros.stats.ledger.${key}`),
      value: scalars?.[key] ?? null,
    })),
    quality: [
      {
        key: "testsPassing",
        label: t("logros.stats.ledger.testsPassing"),
        value: scalars?.testsPassing ?? null,
      },
      {
        key: "decisions",
        label: t("logros.stats.ledger.decisions"),
        value: scalars?.decisions ?? null,
      },
    ],
  };
  return (
    <section
      aria-label={t("logros.stats.attributes")}
      data-testid="stats-panel"
      className={styles.band}
    >
      <div className={`stats-top ${styles.top}`}>
        <Card tone="gold">
          <CardHeader title={t("logros.stats.attributes")} icon="radar" level={2} />
          <RadarChart axes={axes} />
        </Card>
        <div className={`hstats ${styles.records}`}>
          {recordRows.map((row) => (
            <RecordTile
              key={row.key}
              icon={statIcon(row.key)}
              label={t(`logros.stats.hero.${row.label}`)}
              sub={t(`logros.stats.hero.${row.label}Sub`)}
              value={row.value}
              level={"level" in row ? row.level : undefined}
              noData={row.value !== null && neverRecorded(row.key, row.value, kinds)}
            />
          ))}
        </div>
      </div>
      <p className={styles.insight}>{t("logros.stats.noDataNote")}</p>
      <div className={`ledgers ${styles.ledgers}`}>
        {COLUMNS.map((column) => (
          <LedgerCard
            key={column.title}
            title={t(`logros.stats.ledger.${column.title}`)}
            tone={column.tone}
            icon={column.icon}
            rows={[
              ...column.keys.map((key) => ({
                key,
                label: byKey.get(key)?.label ?? key,
                value: value(key),
                level: metricLevel(key, value(key)),
                noData: neverRecorded(key, value(key), kinds),
              })),
              ...(extras[column.title] ?? []),
            ]}
          />
        ))}
      </div>
    </section>
  );
}
