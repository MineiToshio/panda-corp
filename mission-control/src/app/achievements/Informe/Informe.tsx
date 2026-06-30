/**
 * CMP-10-informe — the "Informe operativo" sober six-band operator report (WO-10-015).
 *
 * Renders the Estadísticas tab's report (additive, sitting ABOVE the existing radar /
 * records / ledger which stay in StatsPanel). Six bands matching the approved prototype
 * (`docs/design/prototype/informe-del-gremio.html`, owner sign-off 2026-06-29):
 *   1. El pulso de la fábrica   — verdict + KPI row (WO/week+delta, WIP, conversion, lead-time)
 *   2. En el tiempo, de verdad  — WO-verified + ideas-captured per ISO week (bar series)
 *   3. Cómo usas la fábrica      — most-used workflows + effort mix
 *   4. Embudo y flujo            — ideas→launched funnel + per-project phase transitions (reopen flag)
 *   5. Estado y salud del proceso — projects-by-phase + process signals
 *   6. Qué mover ahora           — next-actions, each carrying its command
 *
 * Honesty contract (DR-078, REQ-10-020): every unwired figure renders "—" with a
 * "no cableado" label; each git-backed series renders an explicit error band on
 * `ReportResult.ok === false` (never a silent empty band).
 *
 * Sober register (AC-10-015.8, DR-062): same tokens / card style / section-header idiom
 * as the rest of the Hall, NO RPG lore/levels/glow — calm, legible, Spanish labels + aria.
 * Tokens only (inline `var(--…)`, the established pattern on this surface). Server Component.
 *
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import type {
  PhaseTransition,
  ReportResult,
  UsageMix,
  WeeklyBucket,
  WeeklyFlow,
} from "@/lib/achievements/report/types";
import type { NextAction } from "@/lib/achievements/report/verdict";
import type {
  InformeData,
  InformePulse as InformePulseData,
  InformeSignals,
  ProjectPhase,
} from "./informeData";

// ── Shared card / band style (matches the Hall rpgpanel + sibling tabs, DR-062) ──

const CARD: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05),inset 0 -2px 0 rgba(0,0,0,.22),0 2px 0 var(--color-base)",
};

const PANEL_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: "11px",
  color: "var(--color-text3)",
  letterSpacing: ".05em",
  padding: "0 2px 10px",
};

const INSIGHT_ROW: React.CSSProperties = {
  display: "flex",
  gap: "7px",
  alignItems: "flex-start",
  marginTop: "10px",
  fontSize: "12.5px",
  color: "var(--color-text2)",
  lineHeight: 1.45,
};

const NO_CABLEADO_LABEL = "no cableado";

// ── Section divider (between bands) ───────────────────────────────────────────

function BandHeader({ title, sub }: { title: string; sub: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", margin: "24px 2px 12px" }}>
      <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text)" }}>{title}</span>
      <span style={{ fontSize: "12.5px", color: "var(--color-text3)" }}>{sub}</span>
      <div style={{ flex: 1, height: "1px", background: "var(--color-border)" }} />
    </div>
  );
}

/** A small pixel-font panel label with an accent icon (the band's inner heading). */
function PanelLabel({ icon, text }: { icon: string; text: string }): React.JSX.Element {
  return (
    <div style={PANEL_LABEL}>
      <i
        className={`ti ${icon}`}
        aria-hidden="true"
        style={{ fontSize: "13px", verticalAlign: "-2px", color: "var(--color-accent-text)" }}
      />
      {` ${text}`}
    </div>
  );
}

/** The accent arrow + one-line takeaway under a band. */
function Insight({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={INSIGHT_ROW}>
      <i
        className="ti ti-arrow-right"
        aria-hidden="true"
        style={{ color: "var(--color-accent-text)", fontSize: "13px", marginTop: "2px" }}
      />
      <span>{children}</span>
    </div>
  );
}

/** A "—" value with a "no cableado" caption (honesty contract). */
function NotWired({ caption }: { caption: string }): React.JSX.Element {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: "7px" }}>
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "30px",
            lineHeight: 1,
            color: "var(--color-text)",
          }}
        >
          —
        </span>
        <span style={{ fontSize: "11px", color: "var(--color-text3)" }}>{caption}</span>
      </div>
      <div style={{ marginTop: "7px", fontSize: "11.5px", color: "var(--color-text3)" }}>
        {NO_CABLEADO_LABEL}
      </div>
    </>
  );
}

// ── Band 1 — pulse ────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  unit,
  footer,
  footerTone,
  footerIcon,
  testId,
}: {
  label: string;
  value: number;
  unit: string;
  footer: string;
  footerTone: "warn" | "muted";
  footerIcon?: string;
  testId?: string;
}): React.JSX.Element {
  const footerColor = footerTone === "warn" ? "var(--color-warn)" : "var(--color-text3)";
  return (
    <div data-testid={testId} style={{ ...CARD, padding: "13px 14px", flex: 1, minWidth: "130px" }}>
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "10.5px",
          color: "var(--color-text3)",
          letterSpacing: ".04em",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "7px" }}>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "30px",
            lineHeight: 1,
            color: "var(--color-text)",
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: "11px", color: "var(--color-text3)" }}>{unit}</span>
      </div>
      <div
        style={{
          marginTop: "7px",
          fontSize: "11.5px",
          color: footerColor,
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {footerIcon !== undefined && <i className={`ti ${footerIcon}`} aria-hidden="true" />}
        {footer}
      </div>
    </div>
  );
}

function PulseBand({
  verdict,
  pulse,
}: {
  verdict: string;
  pulse: InformePulseData;
}): React.JSX.Element {
  const delta = pulse.woPerWeek - pulse.woPrevWeek;
  const deltaTone = delta < 0 ? "warn" : "muted";
  const deltaIcon = delta < 0 ? "ti-arrow-down-right" : delta > 0 ? "ti-arrow-up-right" : undefined;
  return (
    <section
      data-testid="informe-pulse"
      aria-label="El pulso de la fábrica"
      style={{ ...CARD, padding: "16px 18px", marginBottom: "6px" }}
    >
      <PanelLabel icon="ti-activity-heartbeat" text="EL PULSO DE LA FÁBRICA" />
      <div
        style={{
          fontSize: "19px",
          lineHeight: 1.4,
          color: "var(--color-text)",
          fontWeight: 500,
          marginBottom: "16px",
        }}
      >
        {verdict}
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Kpi
          label="WO VERIF. / SEM"
          value={pulse.woPerWeek}
          unit="últ. sem"
          footer={`${pulse.woPerWeek} vs ${pulse.woPrevWeek} la previa`}
          footerTone={deltaTone}
          {...(deltaIcon !== undefined ? { footerIcon: deltaIcon } : {})}
        />
        <Kpi
          label="PROYECTOS ACTIVOS"
          value={pulse.wip}
          unit="en curso"
          footer={pulse.wipLabel}
          footerTone="muted"
        />
        <Kpi
          label="CONVERSIÓN"
          value={pulse.conversionPct}
          unit="% idea→lanzado"
          footer={`${pulse.launched} lanzada de ${pulse.totalIdeas}`}
          footerTone="warn"
          footerIcon="ti-alert-triangle"
        />
        {/* Lead time — always "no cableado" (never a fabricated zero), AC-10-015.1 */}
        <div
          data-testid="informe-lead-time"
          style={{ ...CARD, padding: "13px 14px", flex: 1, minWidth: "130px" }}
        >
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "10.5px",
              color: "var(--color-text3)",
              letterSpacing: ".04em",
              marginBottom: "6px",
            }}
          >
            LEAD TIME
          </div>
          <NotWired caption="idea→release" />
        </div>
      </div>
    </section>
  );
}

// ── Band 2 — time series (bar charts) ─────────────────────────────────────────

function BarSeries({
  buckets,
  axisLabel,
  barColor,
}: {
  buckets: readonly WeeklyBucket[];
  axisLabel: string;
  barColor: string;
}): React.JSX.Element {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "14px",
        height: "88px",
        padding: "4px 2px 0",
      }}
    >
      {buckets.map((b) => {
        const pct = Math.round((b.count / max) * 100);
        const week = b.isoWeek.split("-").at(-1) ?? b.isoWeek;
        const hasValue = b.count > 0;
        return (
          <div
            key={b.isoWeek}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "5px",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <span
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "12px",
                color: "var(--color-text2)",
              }}
            >
              {b.count}
            </span>
            <div
              style={{
                width: "100%",
                maxWidth: "42px",
                height: `${pct}%`,
                minHeight: "3px",
                background: hasValue ? barColor : "var(--color-border-strong)",
                borderRadius: "4px 4px 0 0",
                boxShadow: "inset 0 -2px 0 rgba(0,0,0,.22)",
              }}
            />
            <span style={{ fontSize: "9.5px", color: "var(--color-text3)" }}>{`sem ${week}`}</span>
          </div>
        );
      })}
      <div
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: "9px",
          color: "var(--color-text3)",
          letterSpacing: ".04em",
          alignSelf: "center",
        }}
      >
        {axisLabel}
      </div>
    </div>
  );
}

function TimeBand({ weeklyFlow }: { weeklyFlow: ReportResult<WeeklyFlow> }): React.JSX.Element {
  return (
    <div
      data-testid="informe-time"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
    >
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-chart-bar" text="WORK ORDERS VERIFICADOS / SEMANA" />
        {weeklyFlow.ok ? (
          <>
            <BarSeries
              buckets={weeklyFlow.value.woVerified}
              axisLabel="work orders"
              barColor="var(--color-accent)"
            />
            <Insight>
              Reemplaza el conteo de eventos antiguo (puro ruido): mide entrega real por semana.
            </Insight>
          </>
        ) : (
          <p style={{ fontSize: "12.5px", color: "var(--color-text3)", margin: "8px 2px 0" }}>
            Serie {NO_CABLEADO_LABEL} — el historial de git no está disponible.
          </p>
        )}
      </section>
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-bulb" text="IDEAS CAPTURADAS / SEMANA" />
        {weeklyFlow.ok ? (
          <>
            <BarSeries
              buckets={weeklyFlow.value.ideasCaptured}
              axisLabel="ideas"
              barColor="var(--color-tier-4)"
            />
            <Insight>Capturas a ráfagas, no de forma continua.</Insight>
          </>
        ) : (
          <p style={{ fontSize: "12.5px", color: "var(--color-text3)", margin: "8px 2px 0" }}>
            Serie {NO_CABLEADO_LABEL} — el historial de git no está disponible.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Band 3 — usage ────────────────────────────────────────────────────────────

const USAGE_BAR_COLORS = [
  "var(--color-accent)",
  "var(--color-tier-3)",
  "var(--color-tier-4)",
  "var(--color-tier-5)",
  "var(--color-border-strong)",
] as const;

function UsageBar({
  name,
  count,
  pct,
  color,
}: {
  name: string;
  count: number;
  pct: number;
  color: string;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: "8px", fontSize: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "3px",
          color: "var(--color-text2)",
        }}
      >
        <span>{name}</span>
        <b
          className="tabular-nums"
          style={{ fontFamily: "var(--font-pixel)", fontSize: "13px", color: "var(--color-text)" }}
        >
          {count}
        </b>
      </div>
      <div
        style={{
          height: "7px",
          background: "var(--color-base)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
}

function UsageBars({
  rows,
}: {
  rows: readonly { name: string; count: number }[];
}): React.JSX.Element {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <>
      {rows.map((r, i) => (
        <UsageBar
          key={r.name}
          name={r.name}
          count={r.count}
          pct={Math.round((r.count / max) * 100)}
          color={USAGE_BAR_COLORS[i] ?? "var(--color-border-strong)"}
        />
      ))}
    </>
  );
}

function UsageBand({ usage }: { usage: ReportResult<UsageMix> }): React.JSX.Element {
  if (!usage.ok) {
    return (
      <div
        data-testid="informe-usage"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <section style={{ ...CARD, padding: "16px 18px" }}>
          <PanelLabel icon="ti-stack-2" text="WORKFLOWS / SKILLS MÁS USADOS" />
          <p style={{ fontSize: "12.5px", color: "var(--color-text3)", margin: "8px 2px 0" }}>
            Uso {NO_CABLEADO_LABEL} — el flujo de eventos no se pudo leer.
          </p>
        </section>
        <section style={{ ...CARD, padding: "16px 18px" }}>
          <PanelLabel icon="ti-bolt" text="ESFUERZO DE LOS AGENTES" />
          <p style={{ fontSize: "12.5px", color: "var(--color-text3)", margin: "8px 2px 0" }}>
            Esfuerzo {NO_CABLEADO_LABEL} — el flujo de eventos no se pudo leer.
          </p>
        </section>
      </div>
    );
  }
  const { workflows, effort } = usage.value;
  return (
    <div
      data-testid="informe-usage"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
    >
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-stack-2" text="WORKFLOWS / SKILLS MÁS USADOS" />
        <UsageBars rows={workflows} />
        <Insight>Te apoyas mucho en investigación y auditoría respecto a construir.</Insight>
      </section>
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-bolt" text="ESFUERZO DE LOS AGENTES" />
        <UsageBars rows={effort.map((e) => ({ name: e.level, count: e.count }))} />
        <Insight>Casi todo a esfuerzo alto: margen de ahorro en lo mecánico.</Insight>
      </section>
    </div>
  );
}

// ── Band 4 — funnel + transitions ─────────────────────────────────────────────

const FUNNEL_COLORS = [
  "var(--color-accent)",
  "var(--color-tier-3)",
  "var(--color-tier-4)",
  "var(--color-tier-2)",
] as const;

function FunnelRow({
  count,
  label,
  pct,
  color,
}: {
  count: number;
  label: string;
  pct: number;
  color: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "12px",
        color: "var(--color-text2)",
      }}
    >
      <div
        style={{
          height: "22px",
          width: `${pct}%`,
          minWidth: "26px",
          background: color,
          borderRadius: "5px",
          boxShadow: "inset 0 -2px 0 rgba(0,0,0,.22)",
        }}
      />
      <span>
        <b
          className="tabular-nums"
          style={{ fontFamily: "var(--font-pixel)", color: "var(--color-text)" }}
        >
          {count}
        </b>
        {` ${label}`}
      </span>
    </div>
  );
}

function TransitionRow({ t }: { t: PhaseTransition }): React.JSX.Element {
  const day = t.date.slice(8);
  const monthIdx = Number.parseInt(t.date.slice(5, 7), 10) - 1;
  const MONTHS = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const dateLabel = `${day} ${MONTHS[monthIdx] ?? ""}`.trim();
  const arrowColor = t.isReopen ? "var(--color-warn)" : "var(--color-text3)";
  const toColor = t.isReopen ? "var(--color-warn)" : "var(--color-text)";
  return (
    <div
      data-testid={t.isReopen ? "transition-reopen" : "transition-row"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        fontSize: "11.5px",
        padding: "7px 2px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <span
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "10px",
          color: "var(--color-text3)",
          width: "42px",
        }}
      >
        {dateLabel}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          color: "var(--color-accent-text)",
          width: "104px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {t.project}
      </span>
      <span style={{ color: "var(--color-text2)" }}>{t.from}</span>
      {t.isReopen ? (
        <i
          className="ti ti-rotate-2"
          role="img"
          aria-label="Reapertura"
          title="Reapertura"
          style={{ fontSize: "12px", color: arrowColor }}
        />
      ) : (
        <i
          className="ti ti-arrow-right"
          aria-hidden="true"
          style={{ fontSize: "12px", color: arrowColor }}
        />
      )}
      <span style={{ color: toColor }}>{t.to}</span>
      {t.isReopen && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: "10px",
            color: "var(--color-warn)",
            background: "var(--color-warn-bg)",
            padding: "1px 6px",
            borderRadius: "5px",
          }}
        >
          Reapertura
        </span>
      )}
    </div>
  );
}

function FunnelBand({
  data,
}: {
  data: Pick<InformeData, "funnel" | "transitions">;
}): React.JSX.Element {
  const { funnel, transitions } = data;
  const inPipeline = funnel.byStatus["in-pipeline"];
  const alive = funnel.totalIdeas - funnel.byStatus.discarded;
  const steps = [
    { count: funnel.totalIdeas, label: "capturadas" },
    { count: alive, label: "vivas" },
    { count: inPipeline, label: "en pipeline" },
    { count: funnel.launched, label: "lanzada" },
  ];
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div
      data-testid="informe-funnel"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
    >
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-filter" text="EMBUDO IDEAS → LANZADO" />
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {steps.map((s, i) => (
            <FunnelRow
              key={s.label}
              count={s.count}
              label={s.label}
              pct={Math.round((s.count / max) * 100)}
              color={FUNNEL_COLORS[i] ?? "var(--color-accent)"}
            />
          ))}
        </div>
        <Insight>El cuello está en decidir y arrancar: pocas ideas entran al pipeline.</Insight>
      </section>
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-arrows-transfer-up" text="TRANSICIONES DE FASE · POR PROYECTO" />
        {transitions.ok ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {transitions.value.map((t) => (
              <TransitionRow key={`${t.project}-${t.date}-${t.from}-${t.to}`} t={t} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12.5px", color: "var(--color-text3)", margin: "8px 2px 0" }}>
            Transiciones {NO_CABLEADO_LABEL} — el historial de git no está disponible.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Band 5 — health ───────────────────────────────────────────────────────────

const PHASE_TONE: Record<string, string> = {
  release: "var(--color-ok)",
  implementation: "var(--color-accent-text)",
  architecture: "var(--color-tier-4)",
  design: "var(--color-info)",
  product: "var(--color-text3)",
};

function ProjectPhaseRow({ row }: { row: ProjectPhase }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "12.5px",
        padding: "9px 2px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <span
        style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: "12px" }}
      >
        {row.project}
      </span>
      <span
        style={{
          fontSize: "10.5px",
          color: PHASE_TONE[row.phase] ?? "var(--color-text3)",
          background: "var(--color-base)",
          border: "1px solid var(--color-border-strong)",
          padding: "2px 8px",
          borderRadius: "6px",
        }}
      >
        {row.phase}
      </span>
    </div>
  );
}

function SignalRow({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone: "warn" | "muted";
  testId?: string;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "12px",
        color: "var(--color-text2)",
        padding: "9px 2px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <span>{label}</span>
      <span
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "14px",
          color: tone === "warn" ? "var(--color-warn)" : "var(--color-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function HealthBand({
  projectsByPhase,
  signals,
}: {
  projectsByPhase: readonly ProjectPhase[];
  signals: InformeSignals;
}): React.JSX.Element {
  const lessonValue =
    signals.distilledLessons !== null && signals.capturedLessons !== null
      ? `${signals.distilledLessons} / ${signals.capturedLessons}`
      : NO_CABLEADO_LABEL;
  return (
    <div
      data-testid="informe-health"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
    >
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-folders" text="PROYECTOS POR ESTADO" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {projectsByPhase.map((row) => (
            <ProjectPhaseRow key={row.project} row={row} />
          ))}
        </div>
      </section>
      <section style={{ ...CARD, padding: "16px 18px" }}>
        <PanelLabel icon="ti-shield-half" text="SEÑALES DEL PROCESO" />
        <SignalRow
          label="Lecciones destiladas"
          value={lessonValue}
          tone="warn"
          testId="signal-lessons"
        />
        <SignalRow
          label="Relanzamientos de build"
          value={String(signals.relaunches)}
          tone="muted"
        />
        <SignalRow
          label="Descartes sin razón estructurada"
          value={String(signals.discardsWithoutReason)}
          tone="warn"
        />
        {/* Quality telemetry — always "no cableado" (never a zero), AC-10-015.5 */}
        <SignalRow
          label="Telemetría de calidad"
          value={NO_CABLEADO_LABEL}
          tone="warn"
          testId="signal-quality-telemetry"
        />
      </section>
    </div>
  );
}

// ── Band 6 — next actions ─────────────────────────────────────────────────────

function ActionRow({ action }: { action: NextAction }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "13.5px",
        color: "var(--color-text)",
        padding: "11px 2px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          color: "var(--color-accent-text)",
          fontSize: "15px",
        }}
        aria-hidden="true"
      >
        ▸
      </span>
      <div style={{ flex: 1 }}>
        <div>{action.label}</div>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-accent-text)",
          background: "var(--color-accent-bg)",
          border: "1px solid var(--color-border-strong)",
          padding: "3px 9px",
          borderRadius: "7px",
          whiteSpace: "nowrap",
        }}
      >
        {action.command}
      </span>
    </div>
  );
}

function ActionsBand({ actions }: { actions: readonly NextAction[] }): React.JSX.Element {
  return (
    <section
      data-testid="informe-actions"
      aria-label="Qué mover ahora"
      style={{
        ...CARD,
        border: "1px solid var(--color-accent-text)",
        boxShadow:
          "inset 0 0 0 1px var(--color-accent-bg),inset 0 1px 0 rgba(255,255,255,.05),inset 0 -2px 0 rgba(0,0,0,.22),0 2px 0 var(--color-base)",
        padding: "16px 18px",
      }}
    >
      {actions.map((a) => (
        <ActionRow key={`${a.command}-${a.label}`} action={a} />
      ))}
    </section>
  );
}

// ── Informe (main export) ─────────────────────────────────────────────────────

export type InformeProps = {
  data: InformeData;
};

/**
 * InformePulse — band 1 alone (the executive verdict + KPI row).
 *
 * Rendered ABOVE the StatsPanel so the report follows the approved prototype's
 * interleaved order: pulse → StatsPanel (radar/records/ledger) → bands 2-6.
 */
export function InformePulse({ data }: InformeProps): React.JSX.Element {
  return <PulseBand verdict={data.verdict} pulse={data.pulse} />;
}

/**
 * InformeBands — bands 2-6 (time-series, usage, funnel+flow, health, next-actions).
 *
 * Rendered BELOW the StatsPanel (records/ledger), completing the interleaved layout.
 */
export function InformeBands({ data }: InformeProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <BandHeader title="En el tiempo, de verdad" sub="¿Cómo voy semana a semana?" />
      <TimeBand weeklyFlow={data.weeklyFlow} />
      <BandHeader title="Cómo usas la fábrica" sub="¿En qué me apoyo y a qué coste?" />
      <UsageBand usage={data.usage} />
      <BandHeader title="Embudo y flujo" sub="¿Dónde se atascan las ideas y los proyectos?" />
      <FunnelBand data={data} />
      <BandHeader
        title="Estado y salud del proceso"
        sub="¿Qué proyectos hay y qué señales vigilar?"
      />
      <HealthBand projectsByPhase={data.projectsByPhase} signals={data.signals} />
      <BandHeader title="Qué mover ahora" sub="La conclusión, con su comando" />
      <ActionsBand actions={data.actions} />
    </div>
  );
}

/**
 * CMP-10-informe — the sober six-band operator report (the WHOLE report in order).
 *
 * Pure presentational Server Component: receives the pre-assembled `InformeData`
 * (built by `buildInformeData` in the page from the WO-10-014 readers). The Estadísticas
 * tab composes the interleaved layout with `<InformePulse>` + StatsPanel + `<InformeBands>`;
 * this combined export renders all six bands contiguously (used in unit tests + as a fallback).
 */
export function Informe({ data }: InformeProps): React.JSX.Element {
  return (
    <div data-testid="informe-report" style={{ display: "flex", flexDirection: "column" }}>
      <InformePulse data={data} />
      <InformeBands data={data} />
    </div>
  );
}
