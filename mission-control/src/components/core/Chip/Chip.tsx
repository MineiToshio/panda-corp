/**
 * WO-13-007 — Chip (CMP-13-chip)
 *
 * The ONE pill primitive (.chip). Tones: ok/warn/danger/info/accent/secondary.
 * frd/verde/live are tone presets — NOT new components.
 *
 * Tokens only. Light+dark first-class. WCAG AA contrast.
 * tabular-nums applied globally (html rule in globals.css).
 *
 * Traceability: CMP-13-chip, AC-13-006.x.
 * Consumers: CountBadge (preset), ProposalsBadge, StatusChips, ProposalsChip.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChipTone = "ok" | "warn" | "danger" | "info" | "accent" | "secondary";

export interface ChipProps {
  /** Visual tone — all colors via CSS custom properties only. */
  tone: ChipTone;
  /** Text content (alternative to children). */
  label?: string;
  /** Text content. */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Token map: tone → CSS variable names (no hardcoded hex)
// ---------------------------------------------------------------------------

const CHIP_VARS: Record<ChipTone, { fg: string; bg: string }> = {
  ok: { fg: "var(--color-ok)", bg: "var(--color-ok-bg)" },
  warn: { fg: "var(--color-warn)", bg: "var(--color-warn-bg)" },
  danger: { fg: "var(--color-danger)", bg: "var(--color-danger-bg)" },
  info: { fg: "var(--color-info)", bg: "var(--color-info-bg)" },
  accent: { fg: "var(--color-accent-text)", bg: "var(--color-accent-bg)" },
  secondary: { fg: "var(--color-text2)", bg: "var(--color-card2, var(--color-panel))" },
} as const;

// ---------------------------------------------------------------------------
// Chip component
// ---------------------------------------------------------------------------

/**
 * Chip — the one pill primitive.
 *
 * Usage: `<Chip tone="warn">Plugin drift</Chip>`
 * Presets (aliases, NOT new components):
 *   - frd: `<Chip tone="accent" label="FRD-13" />`
 *   - verde: `<Chip tone="ok" label="en vivo" />`
 *   - live: `<Chip tone="ok" label="live" />`
 */
export function Chip({ tone, label, children }: ChipProps): React.JSX.Element {
  const vars = CHIP_VARS[tone];

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "var(--radius-sm, 8px)",
    fontWeight: 500,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
    color: vars.fg,
    background: vars.bg,
  };

  return (
    <span data-testid="chip" data-tone={tone} style={style}>
      {children ?? label}
    </span>
  );
}
