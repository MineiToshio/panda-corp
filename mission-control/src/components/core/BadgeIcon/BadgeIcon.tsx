import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./BadgeIcon.module.css";

export interface BadgeIconProps {
  readonly icon: IconName;
  readonly tone?: Tone;
  readonly size?: "sm" | "md" | "lg";
  /** Spanish name when the badge stands alone; omit when a visible title already names it (decorative). */
  readonly label?: string;
}

/** Tinted icon tile: the hue colours the glyph; the glyph itself is the meaning. */
export function BadgeIcon({ icon, tone, size = "md", label }: BadgeIconProps): React.JSX.Element {
  const sizeClass = size === "md" ? "" : ` ${size} ${styles[size]}`;
  return (
    <span className={`badge-icon${sizeClass} ${styles.badge}`} data-tone={tone}>
      <Icon name={icon} size={size === "lg" ? "lg" : size === "sm" ? "sm" : "md"} label={label} />
    </span>
  );
}
