import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Chip.module.css";
import type { Tone } from "./vocabulary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChipTone = Tone;
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

/** Shared Órbita pill with optional icon and tint, outline, plain or dashed treatment. */
export function Chip({
  tone,
  label,
  children,
  variant = "tint",
  icon,
}: ChipProps): React.JSX.Element {
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
