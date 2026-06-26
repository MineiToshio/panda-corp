/**
 * IdeaPitch (CMP-02-idea-pitch) — the native "Propuesta" memo of an idea card.
 *
 * Faithful to the owner-approved HTML (docs/proposals/10b-sample-idea-memo.html), re-themed to
 * the Atelier tokens: a hero (eyebrow · title · la apuesta one-liner · badges), a HOT block
 * ("🔥 De un vistazo" — la apuesta, problema as a quote callout, por qué tú, la visión framed) and
 * a COLD block ("❄️ Profundizar" — mercado · distribución · gaps+riesgos · red team · el ask), plus
 * the scorecard as bars. Driven by `parsePitch(body)` — the card `.md` is the source of truth.
 *
 * When the body has no memo skeleton (an old/odd card), it falls back to rendering the raw body via
 * the shared <Markdown> so nothing is lost. All prose flows through <Markdown> (XSS-safe, no raw HTML).
 *
 * Traceability: CMP-02-idea-pitch → REQ-02-009 (AC-02-009.1/.5).
 */

import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import {
  type DeepSection,
  type GlanceItem,
  parsePitch,
  type ScorecardAxis,
} from "@/lib/pitch/pitch";
import {
  BADGES_ROW_STYLE,
  BLABEL_COLD_STYLE,
  BLABEL_HOT_STYLE,
  BLOCK_COLD_STYLE,
  BLOCK_HOT_STYLE,
  BOARD_STYLE,
  badgeStyle,
  CONTAINER_STYLE,
  DEEP_HEADING_STYLE,
  deepCardStyle,
  EYEBROW_STYLE,
  HERO_STYLE,
  ONE_LINER_STYLE,
  QUOTE_STYLE,
  ROW_KEY_HOT_STYLE,
  ROW_STYLE,
  SCORE_NAME_STYLE,
  SCORE_ROW_STYLE,
  SCORE_TRACK_STYLE,
  SCORE_VAL_STYLE,
  scoreFillStyle,
  TITLE_STYLE,
  VISION_FRAME_STYLE,
} from "./IdeaPitch.styles";

const DANGER_HEADING_RE = /gap|riesgo|red team|legal/i;

export interface IdeaPitchProps {
  /** The card's memo body (frontmatter already stripped). */
  body: string;
  /** The idea title (the hero heading). */
  title: string;
  /** In-doc/external link resolver shared with the card detail (evidence links). */
  resolveLink?: LinkResolver;
}

/** One "De un vistazo" bullet, with special framing for problema (quote) and visión (prize). */
function GlanceRow({
  item,
  resolveLink,
}: {
  item: GlanceItem;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  const value = <Markdown resolveLink={resolveLink}>{item.value}</Markdown>;
  let content = value;
  if (item.kind === "problema") content = <div style={QUOTE_STYLE}>{value}</div>;
  else if (item.kind === "vision") content = <div style={VISION_FRAME_STYLE}>{value}</div>;
  return (
    <div style={ROW_STYLE} data-testid="pitch-glance-row">
      <div style={ROW_KEY_HOT_STYLE}>{item.label}</div>
      <div>{content}</div>
    </div>
  );
}

/** One "Profundizar" subsection as a framed card (danger-tinted for gaps/risks/legal/red-team). */
function DeepCard({
  section,
  resolveLink,
}: {
  section: DeepSection;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  return (
    <div
      style={deepCardStyle(DANGER_HEADING_RE.test(section.heading))}
      data-testid="pitch-deep-card"
    >
      <p style={DEEP_HEADING_STYLE}>{section.heading}</p>
      <Markdown resolveLink={resolveLink}>{section.markdown}</Markdown>
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

/**
 * IdeaPitch — pure presentational; the parent CardDetail owns the interactive state.
 */
export function IdeaPitch({ body, title, resolveLink }: IdeaPitchProps): React.JSX.Element {
  const pitch = parsePitch(body);

  return (
    <article
      data-testid="card-detail-pitch"
      style={CONTAINER_STYLE}
      aria-label="Propuesta de la idea"
    >
      <header style={HERO_STYLE}>
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
      </header>

      {/* Fallback: an old/odd card with no memo skeleton → render the raw body verbatim. */}
      {!pitch.hasStructured && (
        <div style={{ paddingTop: "18px" }}>
          <Markdown resolveLink={resolveLink}>{body}</Markdown>
        </div>
      )}

      {pitch.glance.length > 0 && (
        <section style={BLOCK_HOT_STYLE}>
          <p style={BLABEL_HOT_STYLE}>🔥 De un vistazo · el sueño</p>
          {pitch.glance.map((item) => (
            <GlanceRow key={item.label} item={item} resolveLink={resolveLink} />
          ))}
        </section>
      )}

      {pitch.deepDive.length > 0 && (
        <section style={BLOCK_COLD_STYLE}>
          <p style={BLABEL_COLD_STYLE}>❄️ Profundizar · el criterio</p>
          {pitch.deepDive.map((section) => (
            <DeepCard key={section.heading} section={section} resolveLink={resolveLink} />
          ))}
        </section>
      )}

      {pitch.scorecard.length > 0 && (
        <section style={BOARD_STYLE}>
          <p style={BLABEL_COLD_STYLE}>📊 Scorecard</p>
          {pitch.scorecard.map((axis) => (
            <ScoreBar key={axis.axis} axis={axis} />
          ))}
        </section>
      )}
    </article>
  );
}
