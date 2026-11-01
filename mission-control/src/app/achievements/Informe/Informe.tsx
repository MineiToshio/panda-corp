import { Card, CardHeader } from "@/components/core/Card/Card";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Notice } from "@/components/core/Notice/Notice";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { t } from "@/lib/copy/copy";
import type { EventSourceHealth } from "@/lib/events/eventSourceHealth";
import { StatKpi } from "../_components/Stats/StatKpi";
import styles from "../_components/Stats/Stats.module.css";
import type { InformeData } from "./informeData";
import { FlowBand, HealthBand, TimeBand, UsageBand } from "./ReportBands";

/** Report inputs, assembled by the server loader; never read local files in this view. */
export interface InformeProps {
  readonly data: InformeData;
  readonly usageHealth?: EventSourceHealth;
}

/** A catalogue heading shared by the six operator report bands. */
function BandHeading({
  title,
  sub,
}: {
  readonly title: string;
  readonly sub?: string;
}): React.JSX.Element {
  return (
    <div className={styles.heading}>
      <h2>{title}</h2>
      <span className={styles.headingLine} aria-hidden="true" />
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

/** Executive verdict and four observed or explicitly unwired KPIs. */
export function InformePulse({ data }: InformeProps): React.JSX.Element {
  const { pulse } = data;
  const readable = data.weeklyFlow.ok;
  return (
    <section data-testid="informe-pulse">
      <SectionHead label={t("logros.stats.executive")} rightHtml={t("logros.stats.executiveSub")} />
      <Card tone="teal">
        <CardHeader title={t("logros.stats.pulse")} icon="activity" />
        <p className={`verdict ${styles.verdict}`}>{data.verdict}</p>
        <div className={`kpis ${styles.kpis}`}>
          <StatKpi
            label={t("logros.stats.kpiWeek")}
            value={readable ? pulse.woPerWeek : "—"}
            unit={t("logros.stats.kpiWeekUnit")}
            tone="teal"
            foot={
              readable
                ? t("logros.stats.kpiWeekFoot", {
                    arrow: pulse.woPerWeek >= pulse.woPrevWeek ? "↑" : "↓",
                    current: pulse.woPerWeek,
                    previous: pulse.woPrevWeek,
                  })
                : t("logros.stats.notWired")
            }
          />
          <StatKpi
            label={t("logros.stats.kpiActive")}
            value={pulse.wip}
            unit={t("logros.stats.kpiActiveUnit")}
            tone="violet"
            foot={pulse.wipLabel}
          />
          <StatKpi
            label={t("logros.stats.kpiConversion")}
            value={pulse.conversionPct}
            unit={t("logros.stats.kpiConversionUnit")}
            tone="blue"
            foot={t("logros.stats.kpiConversionFoot", {
              count: pulse.launched,
              launched: pulse.launched,
              total: pulse.totalIdeas,
            })}
          />
          <StatKpi
            label={t("logros.stats.kpiLeadTime")}
            value="—"
            unit={t("logros.stats.kpiLeadTimeUnit")}
            tone="teal"
            foot={t("logros.stats.notWired")}
          />
        </div>
      </Card>
    </section>
  );
}

/** Time, usage, flow, health and one copy-only next action. */
export function InformeBands({ data, usageHealth }: InformeProps): React.JSX.Element {
  const action = data.actions[0];
  return (
    <>
      <section className={styles.band} data-testid="informe-time">
        <BandHeading title={t("logros.stats.time")} sub={t("logros.stats.timeSub")} />
        <TimeBand flow={data.weeklyFlow} />
      </section>
      <section className={styles.band} data-testid="informe-usage">
        <BandHeading title={t("logros.stats.usage")} sub={t("logros.stats.usageSub")} />
        <UsageBand usage={data.usage} health={usageHealth} />
      </section>
      <section className={styles.band} data-testid="informe-funnel">
        <BandHeading title={t("logros.stats.flow")} sub={t("logros.stats.flowSub")} />
        <FlowBand data={data} />
      </section>
      <section className={styles.band} data-testid="informe-health">
        <BandHeading title={t("logros.stats.health")} sub={t("logros.stats.healthSub")} />
        <HealthBand data={data} />
      </section>
      <section className={styles.band} data-testid="informe-actions">
        <BandHeading title={t("logros.stats.moveNow")} sub={t("logros.stats.moveNowSub")} />
        {action ? (
          <Card tone="violet">
            <div className={styles.action}>
              <span>{action.label}</span>
              <CmdRow
                variant="box"
                command={action.command}
                copyLabel={t("common.copy.command", { command: action.command })}
              />
            </div>
          </Card>
        ) : (
          <Notice icon="alert">{t("common.noContent")}</Notice>
        )}
      </section>
    </>
  );
}
