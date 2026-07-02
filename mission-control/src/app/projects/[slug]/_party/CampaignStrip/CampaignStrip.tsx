/**
 * CampaignStrip (CMP-06-campaign, REQ-06-019 — La Fragua v2 global scene).
 *
 * One chip per FRD with its REAL state, derived from the work-order frontmatter
 * (the same `listWorkOrders` source as the board, DR-092): with the global-wave
 * engine (BL-0021) several features genuinely burn at once, and this strip is
 * the map — the scene below is the live view. Pure presentational; no I/O.
 *
 * State vocabulary (never color alone — icon + text, accessibility.md):
 *   verified → trophy · building → flame + done/total · in_review → scales
 *   (en sesión / en fila) · blocked → warning · pending → dimmed.
 */

import type { CampaignFrd } from "../fragua-snapshot/fragua-snapshot";

const STRIP_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "var(--color-surface-raised, transparent)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  color: "var(--color-text-muted, currentColor)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const CHIP_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.5rem)",
  fontSize: "0.6875rem",
  fontVariantNumeric: "tabular-nums",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  color: "var(--color-text, currentColor)",
};

/** Spanish state glyph + label for a campaign chip (icon + text, never color alone). */
const STATE_BADGE: Record<CampaignFrd["state"], { glyph: string; label: string }> = {
  pending: { glyph: "·", label: "pendiente" },
  building: { glyph: "🔥", label: "en la fragua" },
  in_review: { glyph: "⚖️", label: "en el tribunal" },
  verified: { glyph: "🏆", label: "verificado" },
  blocked: { glyph: "⛔", label: "bloqueado" },
};

/** Compact chip id from the FRD folder slug: "frd-06-party" → "F-06". */
function shortFrdId(frd: string): string {
  const match = /^frd-(\d+)/.exec(frd);
  return match ? `F-${match[1]}` : frd;
}

export interface CampaignStripProps {
  /** All FRDs with their real state, in file order (snapshot.campaign). */
  campaign: readonly CampaignFrd[];
  /** The FRD currently under judgment (highlights its chip), if any. */
  judging?: string | null;
}

/**
 * The Campaña — every FRD's real state at a glance above the scene.
 *
 * @param props.campaign - Per-FRD states from the snapshot.
 * @param props.judging  - FRD in tribunal session (chip gains emphasis).
 */
export function CampaignStrip({ campaign, judging }: CampaignStripProps): React.JSX.Element {
  return (
    <ul
      data-testid="campaign-strip"
      aria-label="La Campaña — estado de cada feature"
      style={{ ...STRIP_STYLE, listStyle: "none", margin: 0 }}
    >
      <span style={LABEL_STYLE}>Campaña</span>
      {campaign.map((c) => {
        const badge = STATE_BADGE[c.state];
        const inSession = judging === c.frd;
        const dim = c.state === "pending";
        return (
          <li
            key={c.frd}
            data-testid={`campaign-chip-${c.frd}`}
            data-state={c.state}
            data-judging={inSession ? "true" : undefined}
            title={`${c.title} — ${badge.label}${inSession ? " (en sesión)" : ""} · ${c.done}/${c.total} WO`}
            style={{
              ...CHIP_BASE,
              borderColor: dim ? undefined : `var(${c.colorKey})`,
              opacity: dim ? 0.55 : 1,
              boxShadow: inSession ? `inset 0 0 0 1px var(${c.colorKey})` : undefined,
            }}
          >
            <span aria-hidden="true" style={{ color: `var(${c.colorKey})` }}>
              ●
            </span>
            {shortFrdId(c.frd)}
            <span aria-hidden="true">{badge.glyph}</span>
            <span style={{ color: "var(--color-text-muted, currentColor)" }}>
              {c.done}/{c.total}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
