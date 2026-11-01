import { FunnelRow } from "@/app/(dashboard)/_components/FunnelRow";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { Notice } from "@/components/core/Notice/Notice";
import type { ReportResult, UsageMix, WeeklyFlow } from "@/lib/achievements/report/types";
import { t, tRich } from "@/lib/copy/copy";
import type { EventSourceHealth } from "@/lib/events/eventSourceHealth";
import { ColumnChart } from "../_components/charts/ColumnChart";
import { LineChart } from "../_components/charts/LineChart";
import styles from "../_components/Stats/Stats.module.css";
import { Transitions } from "../_components/Stats/Transitions";
import type { InformeData } from "./informeData";

/** Both weekly charts retain explicit failures and value-bearing text alternatives. */
export function TimeBand({ flow }: { readonly flow: ReportResult<WeeklyFlow> }): React.JSX.Element {
  if (!flow.ok)
    return (
      <Notice kind="error" icon="alert">
        {t("logros.stats.weeklyError")}
      </Notice>
    );
  const orders = flow.value.woVerified.map((bucket) => ({
    label: t("logros.stats.week", { week: bucket.isoWeek }),
    value: bucket.count,
  }));
  const ideas = flow.value.ideasCaptured.map((bucket) => ({
    label: t("logros.stats.week", { week: bucket.isoWeek }),
    value: bucket.count,
  }));
  const alternative = (points: typeof orders, unit: string): string =>
    points
      .map((point) => t("logros.stats.chartAria", { week: point.label, count: point.value, unit }))
      .join(" · ");
  return (
    <div className={styles.pair}>
      <Card tone="teal">
        <CardHeader title={t("logros.stats.ordersPerWeek")} icon="chart" level={3} />
        {orders.length ? (
          <ColumnChart points={orders} label={alternative(orders, t("logros.stats.ordersUnit"))} />
        ) : (
          <p>{t("logros.stats.noData")}</p>
        )}
        <p className={styles.insight}>
          {t("logros.stats.ordersInsight", {
            peak: flow.value.peakWeek,
            last: orders.at(-1)?.value ?? 0,
          })}
        </p>
      </Card>
      <Card tone="violet">
        <CardHeader title={t("logros.stats.ideasPerWeek")} icon="bulb" level={3} />
        {ideas.length ? (
          <LineChart points={ideas} label={alternative(ideas, t("logros.stats.ideasUnit"))} />
        ) : (
          <p>{t("logros.stats.noData")}</p>
        )}
        <p className={styles.insight}>{t("logros.stats.ideasInsight")}</p>
        {flow.value.ideasWithoutCreated ? (
          <p>
            {t("logros.stats.ideasPerWeek")}: {flow.value.ideasWithoutCreated} ·{" "}
            {t("common.noDate")}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

/** Unpopulated usage bands stay calm; a failed source adds its own coral alert. */
export function UsageBand({
  usage,
  health,
}: {
  readonly usage: ReportResult<UsageMix>;
  readonly health?: EventSourceHealth;
}): React.JSX.Element {
  const failed = health?.ok === false || !usage.ok;
  const reason =
    health?.ok === false
      ? `${health.source} (${health.kind}${health.kind !== "missing" ? `: ${health.line}` : ""})`
      : "unavailable";
  return (
    <>
      {failed ? (
        <Notice kind="error" icon="alert">
          <b>{t("logros.stats.usageError")}</b>
          <p>{tRich("logros.stats.usageErrorBodyWithReason", { reason })}</p>
        </Notice>
      ) : null}
      <div className={styles.pair}>
        <Card>
          <CardHeader title={t("logros.stats.workflows")} icon="layers" level={3} />
          <p>{t(failed ? "logros.stats.workflowsErrorEmpty" : "logros.stats.workflowsEmpty")}</p>
        </Card>
        <Card>
          <CardHeader title={t("logros.stats.effort")} icon="bolt" level={3} />
          <p>{t(failed ? "logros.stats.workflowsErrorEmpty" : "logros.stats.effortEmpty")}</p>
        </Card>
      </div>
    </>
  );
}

/** Funnel uses Inicio's row primitive; phase observations page in groups of ten. */
export function FlowBand({ data }: { readonly data: InformeData }): React.JSX.Element {
  const { funnel } = data;
  return (
    <div className={styles.pair}>
      <Card tone="teal">
        <CardHeader title={t("logros.stats.funnel")} icon="target" level={3} />
        <FunnelRow
          phase="discovered"
          count={funnel.totalIdeas}
          max={funnel.totalIdeas}
          report={{ caption: t("logros.stats.funnelCaptured"), tone: "teal" }}
        />
        <FunnelRow
          report={{ caption: t("logros.stats.funnelAlive"), tone: "blue" }}
          phase="product"
          count={funnel.totalIdeas - funnel.byStatus.discarded}
          max={funnel.totalIdeas}
        />
        <FunnelRow
          report={{ caption: t("logros.stats.funnelPipeline"), tone: "violet" }}
          phase="implementation"
          count={funnel.byStatus["in-pipeline"]}
          max={funnel.totalIdeas}
        />
        <FunnelRow
          phase="release"
          count={funnel.launched}
          max={funnel.totalIdeas}
          report={{
            caption: t(
              funnel.launched === 1
                ? "logros.stats.funnelLaunchedOne"
                : "logros.stats.funnelLaunchedMany",
            ),
            tone: "green",
          }}
        />
        <p className={styles.insight}>{t("logros.stats.funnelInsight")}</p>
      </Card>
      <Card tone="blue">
        <CardHeader title={t("logros.stats.transitions")} icon="branch" level={3} />
        {data.transitions.ok ? (
          <Transitions rows={data.transitions.value} />
        ) : (
          <Notice kind="error" icon="alert">
            {t("logros.stats.notWired")}
          </Notice>
        )}
      </Card>
    </div>
  );
}

/** Project phases and real process signals, with unwired telemetry kept explicit. */
export function HealthBand({ data }: { readonly data: InformeData }): React.JSX.Element {
  const signals = data.signals;
  const rows = [
    {
      label: t("logros.stats.distilledLessons"),
      value:
        signals.distilledLessons === null || signals.capturedLessons === null
          ? t("logros.stats.notWired")
          : `${signals.distilledLessons} / ${signals.capturedLessons}`,
    },
    { label: t("logros.stats.relaunches"), value: signals.relaunches },
    { label: t("logros.stats.discardsNoReason"), value: signals.discardsWithoutReason },
    { label: t("logros.stats.qualityTelemetry"), value: <>— {t("logros.stats.notWired")}</> },
  ];
  return (
    <div className={styles.pair}>
      <Card>
        <CardHeader title={t("logros.stats.projectsByState")} icon="folder" level={3} />
        <ul className={`kvlist ${styles.list}`}>
          {data.projectsByPhase.map((row) => {
            const phase = phasePresentation(row.phase);
            return (
              <li key={row.project}>
                <span>{row.project}</span>
                <Chip tone={phase.tone}>{t(phase.labelKey)}</Chip>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t("logros.stats.signals")} icon="shield" level={3} />
        <ul className={`kvlist ${styles.list}`}>
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <b>{row.value}</b>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
