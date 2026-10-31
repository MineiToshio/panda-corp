/** Native proposal memo, preserving authored content through the shared report primitives. */

import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { projectMetaChips } from "@/components/modules/IdeaCard/IdeaCard";
import { DigestHero } from "@/components/modules/ReportBand/DigestHero";
import { ReportBand } from "@/components/modules/ReportBand/ReportBand";
import { t } from "@/lib/copy/copy";
import type { BadgeTone } from "@/lib/pitch/pitch";
import {
  type DeepSection,
  type GlanceItem,
  parsePitch,
  parseRiskMitigation,
  type RiskMitigation,
} from "@/lib/pitch/pitch";
import { proposalSummary } from "@/lib/pitch/proposalSummary";
import styles from "./IdeaPitch.module.css";
import {
  ASK_STYLE,
  CHECK_OK_ICON_STYLE,
  CHECK_WARN_ICON_STYLE,
  CHECKITEM_STYLE,
  CONTAINER_STYLE,
  FEAT_DESC_STYLE,
  FEAT_STYLE,
  FEAT_TITLE_STYLE,
  FEATS_STYLE,
  INNER_STYLE,
  MOCK_BAR_STYLE,
  MOCK_DOT_STYLE,
  MOCK_STYLE,
  MOCK_URL_STYLE,
  PREMORTEM_STYLE,
  QUOTE_STYLE,
  RM_MIT_STYLE,
  RM_RISK_STYLE,
  RM_STYLE,
  ROW_KEY_COLD_STYLE,
  ROW_KEY_HOT_STYLE,
  ROW_STYLE,
  SCORE_LIST_STYLE,
  SUBPANEL_STYLE,
  SUBPANEL_TITLE_STYLE,
  TWOCOL_STYLE,
  VISION_FRAME_STYLE,
} from "./IdeaPitch.styles";
import { EffortChart, Evidence, ScoreBar } from "./PitchDecision";

const PREMORTEM_RE = /red team|pre.?mortem/i;
const ASK_RE = /\bask\b/i;
const LEGAL_RE = /legal/i;
const EVIDENCE_RE = /evidencia|evidence|fuentes/i;
const FEATURE_RE = /^[-*]\s+\*\*(.+?)\*\*\s*[—:–-]*\s*(.*)$/;
const CHECK_RE = /^[-*]\s+(✓|✔|☑|✅|!|⚠|✗|✕)\s+(.*)$/;
const PREVIEW_RE = /vista previa|preview/i;

export interface IdeaPitchProps {
  body: string;
  title: string;
  /** App type (web / mobile / api …) — a "qué es" chip replacing the opaque verdict badge. */
  projectType?: string;
  /** Web target platform (desktop / mobile / responsive) — a "qué es" chip. */
  targetPlatforms?: string;
  resolveLink?: LinkResolver;
}

interface Feature {
  title: string;
  desc: string;
}
interface CheckItem {
  ok: boolean;
  text: string;
}

function parseFeatures(markdown: string): Feature[] {
  const feats: Feature[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(FEATURE_RE);
    if (m?.[1] != null) feats.push({ title: m[1].trim(), desc: (m[2] ?? "").trim() });
  }
  return feats;
}

function parseChecks(markdown: string): CheckItem[] {
  const items: CheckItem[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(CHECK_RE);
    if (m?.[2] != null) items.push({ ok: /[✓✔☑✅]/.test(m[1] ?? ""), text: m[2].trim() });
  }
  return items;
}

/** Split a markdown value into prose lines and `>` blockquote lines (for the problema quote). */
function splitQuote(markdown: string): { prose: string; quote: string } {
  const lines = markdown.split("\n");
  const prose = lines
    .filter((l) => !l.trimStart().startsWith(">"))
    .join("\n")
    .trim();
  const quote = lines
    .filter((l) => l.trimStart().startsWith(">"))
    .map((l) => l.replace(/^\s*>\s?/, ""))
    .join("\n")
    .trim();
  return { prose, quote };
}

/** Drop table lines (risk↔mitigation) so the section prose renders without the raw table. */
function stripTableLines(markdown: string): string {
  return markdown
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("|"))
    .join("\n")
    .trim();
}

/** The browser-framed checklist preview under "La visión" (HTML .mock). */
function VisionMock({
  checks,
  url,
}: {
  checks: CheckItem[];
  url: string | null;
}): React.JSX.Element {
  return (
    <div style={MOCK_STYLE} data-testid="pitch-mock">
      <div style={MOCK_BAR_STYLE}>
        <span style={MOCK_DOT_STYLE} />
        <span style={MOCK_DOT_STYLE} />
        <span style={MOCK_DOT_STYLE} />
        {url != null && <span style={MOCK_URL_STYLE}>{url}</span>}
      </div>
      {checks.map((c) => (
        <div key={c.text} style={CHECKITEM_STYLE}>
          <span style={c.ok ? CHECK_OK_ICON_STYLE : CHECK_WARN_ICON_STYLE}>{c.ok ? "✓" : "!"}</span>
          {c.text}
        </div>
      ))}
    </div>
  );
}

/** "La visión" → a feature grid + an optional checklist mock preview. */
function VisionContent({
  value,
  resolveLink,
}: {
  value: string;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  const feats = parseFeatures(value);
  const checks = parseChecks(value);
  const previewLine = value.split("\n").find((l) => PREVIEW_RE.test(l));
  const url =
    previewLine != null
      ? previewLine
          .replace(/\*\*/g, "")
          .replace(/^[-*>\s]+/, "")
          .trim()
      : null;
  if (feats.length < 2) {
    return (
      <div style={VISION_FRAME_STYLE} className="pitch-rowbody">
        <Markdown resolveLink={resolveLink}>{value}</Markdown>
      </div>
    );
  }
  return (
    <>
      <div style={FEATS_STYLE} className={styles.features}>
        {feats.map((f) => (
          <div key={f.title} style={FEAT_STYLE}>
            <span style={FEAT_TITLE_STYLE}>{f.title}</span>
            <p style={FEAT_DESC_STYLE}>{f.desc}</p>
          </div>
        ))}
      </div>
      {checks.length > 0 && <VisionMock checks={checks} url={url} />}
    </>
  );
}

/** A "De un vistazo" hot row (problema → prose + coloured quote; visión → grid + mock). */
function GlanceRow({
  item,
  resolveLink,
}: {
  item: GlanceItem;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  let content: React.JSX.Element;
  if (item.kind === "vision") {
    content = <VisionContent value={item.value} resolveLink={resolveLink} />;
  } else if (item.kind === "problema") {
    const { prose, quote } = splitQuote(item.value);
    content = (
      <>
        <Markdown resolveLink={resolveLink}>{prose}</Markdown>
        {quote.length > 0 && (
          <div style={QUOTE_STYLE} className="pitch-rowbody">
            <Markdown resolveLink={resolveLink}>{quote}</Markdown>
          </div>
        )}
      </>
    );
  } else {
    content = <Markdown resolveLink={resolveLink}>{item.value}</Markdown>;
  }
  return (
    <div style={ROW_STYLE} className="pitch-row" data-testid="pitch-glance-row">
      <div style={ROW_KEY_HOT_STYLE}>{item.label}</div>
      <div className="pitch-rowbody">{content}</div>
    </div>
  );
}

/** Risk↔mitigation cards: red risk label + a green "Mitigación" label, faithful to the HTML .rm. */
function RiskCards({
  pairs,
  resolveLink,
}: {
  pairs: RiskMitigation[];
  resolveLink?: LinkResolver;
}): React.JSX.Element[] {
  return pairs.map((p) => (
    <div key={p.risk} style={RM_STYLE} className={styles.risk} data-testid="pitch-rm">
      <div style={RM_RISK_STYLE} className="pitch-danger pitch-rowbody">
        <Markdown resolveLink={resolveLink}>{p.risk}</Markdown>
      </div>
      <div style={RM_MIT_STYLE} className="pitch-ok pitch-rowbody">
        <Markdown
          resolveLink={resolveLink}
        >{`**${t("idea.pitch.mitigation")}**\n\n${p.mitigation}`}</Markdown>
      </div>
    </div>
  ));
}

/** A "Profundizar" cold row (red team → pre-mortem; ask → box; gaps → risk↔mitigation; legal → green). */
function ColdRow({
  section,
  resolveLink,
}: {
  section: DeepSection;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  const rm = parseRiskMitigation(section.markdown);
  let content: React.JSX.Element;
  if (PREMORTEM_RE.test(section.heading)) {
    content = (
      <div style={PREMORTEM_STYLE} className="pitch-danger pitch-rowbody">
        <Markdown resolveLink={resolveLink}>{section.markdown}</Markdown>
      </div>
    );
  } else if (ASK_RE.test(section.heading)) {
    content = (
      <div style={ASK_STYLE} className="pitch-ask pitch-rowbody">
        <Markdown resolveLink={resolveLink}>{section.markdown}</Markdown>
      </div>
    );
  } else if (rm.length > 0) {
    content = (
      <div>
        <div className="pitch-ok">
          <Markdown resolveLink={resolveLink}>{stripTableLines(section.markdown)}</Markdown>
        </div>
        <RiskCards pairs={rm} resolveLink={resolveLink} />
      </div>
    );
  } else {
    content = <Markdown resolveLink={resolveLink}>{section.markdown}</Markdown>;
  }
  const tone = LEGAL_RE.test(section.heading) ? "pitch-ok pitch-rowbody" : "pitch-rowbody";
  return (
    <div style={ROW_STYLE} className="pitch-row" data-testid="pitch-cold-row">
      <div style={ROW_KEY_COLD_STYLE}>{section.heading}</div>
      <div className={tone}>{content}</div>
    </div>
  );
}

const BADGE_TONES = {
  build: "teal",
  warn: "amber",
  info: "blue",
  pain: "coral",
  neutral: "slate",
} satisfies Record<BadgeTone, Tone>;

/** Render the source memo with shared report primitives and its authored evidence. */
export function IdeaPitch({
  body,
  title,
  projectType,
  targetPlatforms,
  resolveLink,
}: IdeaPitchProps): React.JSX.Element {
  const pitch = parsePitch(body);
  const summary = proposalSummary(body);
  const metaChips = projectMetaChips(projectType, targetPlatforms);
  // Drop the opaque "build" verdict badge — the "qué es" meta chips replace it (owner rule).
  const badges = pitch.badges.filter((b) => b.tone !== "build");
  const evidence = pitch.deepDive.find((s) => EVIDENCE_RE.test(s.heading));
  const coldRows = pitch.deepDive.filter((s) => s !== evidence);

  return (
    <article
      data-testid="card-detail-pitch"
      style={CONTAINER_STYLE}
      className={styles.pitch}
      aria-label={t("idea.tabs.propuesta")}
    >
      <DigestHero
        eyebrow={t("idea.pitch.eyebrow")}
        title={pitch.hasStructured ? "" : title}
        chips={
          <>
            {metaChips.map((chip, index) => (
              <span data-testid="pitch-meta-chip" key={chip.label}>
                <Chip
                  tone="slate"
                  variant="plain"
                  icon={projectType && index === 0 ? "cube" : "columns"}
                >
                  {chip.label}
                </Chip>
              </span>
            ))}
            {badges.map((badge) => (
              <Chip
                key={badge.label}
                tone={BADGE_TONES[badge.tone]}
                variant={badge.tone === "neutral" ? "plain" : "tint"}
              >
                {badge.label}
              </Chip>
            ))}
          </>
        }
      />

      {!pitch.hasStructured && (
        <div className={styles.paper}>
          {summary ? (
            <Markdown resolveLink={resolveLink}>{summary}</Markdown>
          ) : (
            <p role="status">{t("idea.pitch.empty")}</p>
          )}
        </div>
      )}

      {pitch.glance.length > 0 && (
        <ReportBand title={t("idea.pitch.glance")} tone="teal" icon="flame" level={2}>
          {pitch.glance.map((item) => (
            <GlanceRow key={item.label} item={item} resolveLink={resolveLink} />
          ))}
        </ReportBand>
      )}
      {coldRows.length > 0 && (
        <ReportBand title={t("idea.pitch.deep")} tone="blue" icon="layers" level={2}>
          {coldRows.map((section) => (
            <ColdRow key={section.heading} section={section} resolveLink={resolveLink} />
          ))}
        </ReportBand>
      )}
      {(pitch.scorecard.length > 0 || evidence != null) && (
        <ReportBand
          title={t("idea.pitch.board")}
          tone="violet"
          icon="gauge"
          level={pitch.hasStructured ? 2 : 3}
        >
          <div style={INNER_STYLE}>
            {pitch.scorecard.length > 0 && (
              <div style={TWOCOL_STYLE} className={styles.panels}>
                <div style={SUBPANEL_STYLE}>
                  <h3 style={SUBPANEL_TITLE_STYLE}>{t("idea.pitch.scorecard")}</h3>
                  <div style={SCORE_LIST_STYLE}>
                    {pitch.scorecard.map((axis) => (
                      <ScoreBar key={axis.axis} axis={axis} />
                    ))}
                  </div>
                </div>
                <div style={SUBPANEL_STYLE}>
                  <h3 style={SUBPANEL_TITLE_STYLE}>{t("idea.pitch.effortValue")}</h3>
                  <EffortChart scorecard={pitch.scorecard} />
                </div>
              </div>
            )}
            {evidence != null && <Evidence section={evidence} resolveLink={resolveLink} />}
          </div>
        </ReportBand>
      )}
    </article>
  );
}
