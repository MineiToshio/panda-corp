import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { t } from "@/lib/copy/copy";
import type { DeepSection, ScorecardAxis } from "@/lib/pitch/pitch";
import styles from "./IdeaPitch.module.css";
import {
  DETAILS_STYLE,
  EVIDENCE_BODY_STYLE,
  SCORE_NAME_STYLE,
  SCORE_ROW_STYLE,
  SCORE_TRACK_STYLE,
  SCORE_VAL_STYLE,
  SUMMARY_STYLE,
  scoreFillStyle,
} from "./IdeaPitch.styles";

/** One scorecard axis as a labelled bar (the cell text is the honest caption). */
export function ScoreBar({ axis }: { axis: ScorecardAxis }): React.JSX.Element {
  return (
    <div style={SCORE_ROW_STYLE} className={styles.score} data-testid="pitch-score-bar">
      <span style={SCORE_NAME_STYLE}>{axis.axis}</span>
      <span style={SCORE_TRACK_STYLE}>
        <i style={scoreFillStyle(axis.level)} />
      </span>
      <span style={SCORE_VAL_STYLE}>{axis.value}</span>
    </div>
  );
}

const LEVEL_VALUE: Record<string, number> = { high: 1, mid: 0.55, low: 0.25 };

function effortPos(scorecard: ScorecardAxis[]): number {
  const e = scorecard.find((a) => /esfuerzo/i.test(a.axis));
  if (!e) return 0.5;
  const t = e.value.toLowerCase();
  if (/micro/.test(t)) return 0.22;
  if (/peque|small|1-2|semana/.test(t)) return 0.5;
  if (/grande|large|mes/.test(t)) return 0.82;
  return 0.5;
}

function valuePos(scorecard: ScorecardAxis[]): number {
  const axes = scorecard.filter((a) => /founder-fit|demanda|retorno/i.test(a.axis));
  if (axes.length === 0) return 0.55;
  const sum = axes.reduce((s, a) => s + (LEVEL_VALUE[a.level] ?? 0.55), 0);
  return sum / axes.length;
}

/** Esfuerzo-vs-valor quadrant chart (HTML: the second .panel). */
export function EffortChart({ scorecard }: { scorecard: ScorecardAxis[] }): React.JSX.Element {
  const x = 44 + effortPos(scorecard) * (360 - 44);
  const y = 14 + (1 - valuePos(scorecard)) * (180 - 14);
  return (
    <svg
      viewBox="0 0 380 220"
      width="100%"
      className={styles.chart}
      style={{ marginTop: "var(--s2)" }}
      role="img"
      aria-label={t("idea.pitch.chartAria", {
        effort: Math.round(effortPos(scorecard) * 100),
        value: Math.round(valuePos(scorecard) * 100),
      })}
      data-testid="pitch-chart"
    >
      <rect
        x="44"
        y="14"
        width="150"
        height="80"
        rx="6"
        fill="color-mix(in srgb, var(--green) 14%, transparent)"
      />
      <line x1="44" y1="14" x2="44" y2="180" stroke="var(--line-strong)" strokeWidth="1.5" />
      <line x1="44" y1="180" x2="360" y2="180" stroke="var(--line-strong)" strokeWidth="1.5" />
      <text x="70" y="198" className={styles.tick}>
        {t("idea.pitch.tickMicro")}
      </text>
      <text x="180" y="198" className={styles.tick}>
        {t("idea.pitch.tickSmall")}
      </text>
      <text x="300" y="198" className={styles.tick}>
        {t("idea.pitch.tickLarge")}
      </text>
      <text x="200" y="214" className={styles.cap}>
        {t("idea.pitch.axisEffort")}
      </text>
      <text x="20" y="110" className={styles.cap} transform="rotate(-90 20 110)">
        {t("idea.pitch.axisValue")}
      </text>
      <text x="54" y="32" className={styles.sweetText}>
        {t("idea.pitch.sweetSpot")}
      </text>
      <circle cx={x} cy={y} r="9" fill="var(--teal)" />
      <text x={x + 14} y={y + 5} className={styles.ideaText}>
        {t("idea.pitch.thisIdea")}
      </text>
    </svg>
  );
}

/** Evidence preserves authored Markdown links and the shared link safety policy. */
export function Evidence({
  section,
  resolveLink,
}: {
  section: DeepSection;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  return (
    <details style={DETAILS_STYLE} className={styles.evidence} data-testid="pitch-evidence">
      <summary style={SUMMARY_STYLE}>{t("idea.pitch.evidence")}</summary>
      <div style={EVIDENCE_BODY_STYLE}>
        <Markdown resolveLink={resolveLink}>{section.markdown}</Markdown>
      </div>
    </details>
  );
}
