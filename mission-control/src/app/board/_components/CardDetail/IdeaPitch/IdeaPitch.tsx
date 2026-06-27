/**
 * IdeaPitch (CMP-02-idea-pitch) — the native "Propuesta" memo of an idea card.
 *
 * A FAITHFUL port of the owner-approved HTML (docs/proposals/10b-sample-idea-memo.html), re-themed to
 * the Atelier tokens. Full-width tinted blocks; both "De un vistazo" and "Profundizar" render as
 * label|content rows. Driven by `parsePitch(body)` — the card `.md` is the source of truth. Prose flows
 * through the shared <Markdown>; critical-text colour (red risk / green ok / amber ask) is applied via
 * the `.pitch-*` helper classes in globals.css (the inline-styled Markdown can't colour bold itself).
 *
 * Traceability: CMP-02-idea-pitch → REQ-02-009 (AC-02-009.1/.5).
 */

import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import {
  type DeepSection,
  type GlanceItem,
  parsePitch,
  parseRiskMitigation,
  type RiskMitigation,
  type ScorecardAxis,
} from "@/lib/pitch/pitch";
import {
  ASK_STYLE,
  BADGES_ROW_STYLE,
  BLABEL_BOARD_STYLE,
  BLABEL_COLD_STYLE,
  BLABEL_HOT_STYLE,
  BLOCK_COLD_STYLE,
  BLOCK_HOT_STYLE,
  BLOCK_PLAIN_STYLE,
  badgeStyle,
  CHECK_OK_ICON_STYLE,
  CHECK_WARN_ICON_STYLE,
  CHECKITEM_STYLE,
  CONTAINER_STYLE,
  DETAILS_STYLE,
  EVIDENCE_BODY_STYLE,
  EVIDENCE_LINK_STYLE,
  EVIDENCE_SRC_STYLE,
  EYEBROW_STYLE,
  FEAT_DESC_STYLE,
  FEAT_STYLE,
  FEAT_TITLE_STYLE,
  FEATS_STYLE,
  HERO_STYLE,
  INNER_STYLE,
  MOCK_BAR_STYLE,
  MOCK_DOT_STYLE,
  MOCK_STYLE,
  MOCK_URL_STYLE,
  ONE_LINER_STYLE,
  PREMORTEM_STYLE,
  QUOTE_STYLE,
  RM_MIT_STYLE,
  RM_RISK_STYLE,
  RM_STYLE,
  ROW_KEY_COLD_STYLE,
  ROW_KEY_HOT_STYLE,
  ROW_STYLE,
  SCORE_LIST_STYLE,
  SCORE_NAME_STYLE,
  SCORE_ROW_STYLE,
  SCORE_TRACK_STYLE,
  SCORE_VAL_STYLE,
  SUBPANEL_STYLE,
  SUBPANEL_TITLE_STYLE,
  SUMMARY_STYLE,
  scoreFillStyle,
  TITLE_STYLE,
  TWOCOL_STYLE,
  VISION_FRAME_STYLE,
} from "./IdeaPitch.styles";

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
      <div style={FEATS_STYLE}>
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
    <div key={p.risk} style={RM_STYLE} data-testid="pitch-rm">
      <div style={RM_RISK_STYLE} className="pitch-danger pitch-rowbody">
        <Markdown resolveLink={resolveLink}>{p.risk}</Markdown>
      </div>
      <div style={RM_MIT_STYLE} className="pitch-ok pitch-rowbody">
        <Markdown resolveLink={resolveLink}>{`**Mitigación** — ${p.mitigation}`}</Markdown>
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
      <div className="pitch-ok">
        <Markdown resolveLink={resolveLink}>{stripTableLines(section.markdown)}</Markdown>
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

/** One scorecard axis as a labelled bar (the cell text is the honest caption). */
function ScoreBar({ axis }: { axis: ScorecardAxis }): React.JSX.Element {
  return (
    <div style={SCORE_ROW_STYLE} data-testid="pitch-score-bar">
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
function EffortChart({ scorecard }: { scorecard: ScorecardAxis[] }): React.JSX.Element {
  const x = 44 + effortPos(scorecard) * (360 - 44);
  const y = 14 + (1 - valuePos(scorecard)) * (180 - 14);
  return (
    <svg
      viewBox="0 0 380 220"
      width="100%"
      fontFamily="ui-monospace, monospace"
      fontSize="11"
      style={{ marginTop: "8px" }}
      role="img"
      aria-label="Esfuerzo vs valor"
      data-testid="pitch-chart"
    >
      <rect x="44" y="14" width="150" height="92" fill="var(--color-ok-bg)" opacity="0.5" />
      <line x1="44" y1="14" x2="44" y2="180" stroke="var(--color-border)" />
      <line x1="44" y1="180" x2="360" y2="180" stroke="var(--color-border)" />
      <text x="120" y="198" fill="var(--color-text3)" textAnchor="middle">
        MICRO
      </text>
      <text x="240" y="198" fill="var(--color-text3)" textAnchor="middle">
        PEQUEÑA
      </text>
      <text x="330" y="198" fill="var(--color-text3)" textAnchor="middle">
        GRANDE
      </text>
      <text x="200" y="214" fill="var(--color-accent-text)" textAnchor="middle">
        ← más fácil · esfuerzo · más complejo →
      </text>
      <text
        x="14"
        y="100"
        fill="var(--color-accent-text)"
        textAnchor="middle"
        transform="rotate(-90 14 100)"
      >
        valor →
      </text>
      <text x="60" y="30" fill="var(--color-ok)" opacity="0.8" fontSize="10">
        ★ sweet spot
      </text>
      <circle cx={x} cy={y} r="9" fill="var(--color-accent)" />
      <text x={x + 14} y={y + 4} fill="var(--color-text)">
        esta idea
      </text>
    </svg>
  );
}

const EVIDENCE_ITEM_RE = /^(.*?)\s*[—–-]\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;

/** One evidence source: plain "descripción — link" (NOT Markdown, so it's tight and only the source is a link). */
function EvidenceSrc({ item }: { item: string }): React.JSX.Element {
  const m = item.match(EVIDENCE_ITEM_RE);
  return (
    <div className="pitch-src" style={EVIDENCE_SRC_STYLE} data-testid="pitch-src">
      {m?.[2] != null && m[3] != null ? (
        <>
          {m[1]} —{" "}
          <a href={m[3]} style={EVIDENCE_LINK_STYLE} target="_blank" rel="noreferrer noopener">
            {m[2]}
          </a>
        </>
      ) : (
        item
      )}
    </div>
  );
}

/** The collapsible Evidencia section (HTML: details/summary + .src rows). */
function Evidence({ section }: { section: DeepSection }): React.JSX.Element {
  const items = section.markdown
    .split("\n")
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("|") && !l.startsWith("("));
  return (
    <details style={DETAILS_STYLE} data-testid="pitch-evidence">
      <summary style={SUMMARY_STYLE}>Evidencia y fuentes (lo que sostiene este memo)</summary>
      <div style={EVIDENCE_BODY_STYLE}>
        {items.map((it) => (
          <EvidenceSrc key={it} item={it} />
        ))}
      </div>
    </details>
  );
}

export function IdeaPitch({ body, title, resolveLink }: IdeaPitchProps): React.JSX.Element {
  const pitch = parsePitch(body);
  const evidence = pitch.deepDive.find((s) => EVIDENCE_RE.test(s.heading));
  const coldRows = pitch.deepDive.filter((s) => s !== evidence);

  return (
    <article
      data-testid="card-detail-pitch"
      style={CONTAINER_STYLE}
      aria-label="Propuesta de la idea"
    >
      <header style={HERO_STYLE}>
        <div style={INNER_STYLE}>
          <p style={EYEBROW_STYLE}>Memo-pitch de idea</p>
          <h3 style={TITLE_STYLE}>{title}</h3>
          {pitch.laApuesta != null && <p style={ONE_LINER_STYLE}>{pitch.laApuesta}</p>}
          {pitch.badges.length > 0 && (
            <div style={BADGES_ROW_STYLE}>
              {pitch.badges.map((b) => (
                <span key={b.label} style={badgeStyle(b.tone)}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {!pitch.hasStructured && (
        <div style={INNER_STYLE}>
          <div style={{ paddingTop: "18px" }}>
            <Markdown resolveLink={resolveLink}>{body}</Markdown>
          </div>
        </div>
      )}

      {pitch.glance.length > 0 && (
        <section className="pitch-block" style={BLOCK_HOT_STYLE}>
          <div style={INNER_STYLE}>
            <p style={BLABEL_HOT_STYLE}>🔥 De un vistazo · el sueño</p>
            {pitch.glance.map((item) => (
              <GlanceRow key={item.label} item={item} resolveLink={resolveLink} />
            ))}
          </div>
        </section>
      )}

      {coldRows.length > 0 && (
        <section className="pitch-block" style={BLOCK_COLD_STYLE}>
          <div style={INNER_STYLE}>
            <p style={BLABEL_COLD_STYLE}>❄️ Profundizar · el criterio</p>
            {coldRows.map((section) => (
              <ColdRow key={section.heading} section={section} resolveLink={resolveLink} />
            ))}
          </div>
        </section>
      )}

      {(pitch.scorecard.length > 0 || evidence != null) && (
        <section className="pitch-block" style={BLOCK_PLAIN_STYLE}>
          <div style={INNER_STYLE}>
            <p style={BLABEL_BOARD_STYLE}>📊 El tablero de decisión</p>
            {pitch.scorecard.length > 0 && (
              <div style={TWOCOL_STYLE}>
                <div style={SUBPANEL_STYLE}>
                  <b style={SUBPANEL_TITLE_STYLE}>Scorecard</b>
                  <div style={SCORE_LIST_STYLE}>
                    {pitch.scorecard.map((axis) => (
                      <ScoreBar key={axis.axis} axis={axis} />
                    ))}
                  </div>
                </div>
                <div style={SUBPANEL_STYLE}>
                  <b style={SUBPANEL_TITLE_STYLE}>Esfuerzo vs. valor</b>
                  <EffortChart scorecard={pitch.scorecard} />
                </div>
              </div>
            )}
            {evidence != null && <Evidence section={evidence} />}
          </div>
        </section>
      )}
    </article>
  );
}
