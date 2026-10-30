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

import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Chip.module.css";
import { isTone, type Tone } from "./vocabulary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type V1ChipTone = "ok" | "warn" | "danger" | "info" | "accent" | "secondary";
/** A v1 tone (existing consumers) or one of the nine Órbita hues (new code). */
export type ChipTone = V1ChipTone | Tone;
type ChipVariant = "tint" | "outline" | "plain" | "dashed";

export interface ChipProps {
  /** Visual tone — all colors via CSS custom properties only. */
  tone: ChipTone;
  /** Text content (alternative to children). */
  label?: string;
  /** Text content. */
  children?: React.ReactNode;
  /** Órbita hues only: the shape (tinted, outlined, neutral or dashed illustrative). Defaults to tinted. */
  variant?: ChipVariant;
  /** Órbita hues only: a leading icon. A hue always travels with text or an icon (AC-13-010.1). */
  icon?: IconName;
}

// ---------------------------------------------------------------------------
// Token map: tone → CSS variable names (no hardcoded hex)
// ---------------------------------------------------------------------------

const CHIP_VARS: Record<V1ChipTone, { fg: string; bg: string }> = {
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
export function Chip({
  tone,
  label,
  children,
  variant = "tint",
  icon,
}: ChipProps): React.JSX.Element {
  if (isTone(tone)) {
    const className = [styles.chip, variant === "tint" ? "" : styles[variant]]
      .filter(Boolean)
      .join(" ");
    return (
      <span data-testid="chip" data-tone={tone} className={`chip ${className}`}>
        {icon ? <Icon name={icon} size="sm" /> : null}
        {children ?? label}
      </span>
    );
  }
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
