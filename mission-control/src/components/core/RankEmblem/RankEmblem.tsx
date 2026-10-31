import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";

/**
 * RankEmblem — the guild rank's pixel-art emblem (a self-framed medal sprite).
 *
 * Renders `/ranks/<sprite>.png` at a fixed square size. Falls back to the rank's
 * Órbita icon when the sprite slug is missing (older GuildLevel objects / tests).
 *
 * The sprite already IS the medal (its own circular frame + glow), so callers
 * render it directly — no extra bordered container around it.
 *
 * Traceability: FRD-09 — guild rank ladder, custom emblems (phase 4).
 */

const ROMAN = ["", "I", "II", "III"] as const;

export type RankEmblemProps = {
  /** Rank-family sprite slug → /ranks/<slug>.png. */
  sprite?: string;
  /** Órbita icon used as a fallback when there is no sprite. */
  icon?: IconName;
  /** Square size in px. */
  size: number;
  /** Sub-grade 1/2/3 (I·II·III) → a small roman-numeral badge; 0 = none. */
  grade?: number;
  /** Accessible alt text (rank name). Empty = decorative. */
  alt?: string;
};

function EmblemImage({
  sprite,
  icon,
  size,
  alt,
}: {
  sprite?: string;
  icon?: IconName;
  size: number;
  alt: string;
}): React.JSX.Element {
  if (sprite !== undefined && sprite !== "") {
    return (
      // biome-ignore lint/performance/noImgElement: static public asset at a fixed small size (same pattern as Avatar); next/image adds no value here.
      <img
        src={`/ranks/${sprite}.png`}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ display: "block", objectFit: "contain" }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ fontSize: `${Math.round(size * 0.78)}px`, color: "var(--violet)" }}
    >
      <Icon name={icon ?? "trophy"} size="sm" />
    </span>
  );
}

export function RankEmblem({
  sprite,
  icon,
  size,
  grade = 0,
  alt = "",
}: RankEmblemProps): React.JSX.Element {
  const img = <EmblemImage sprite={sprite} icon={icon} size={size} alt={alt} />;
  if (grade < 1 || grade > 3) return img;

  // Wrap with a small roman-numeral badge in the corner (distinguishes I·II·III
  // within a shared family emblem — DR for rank bands).
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {img}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "-4px",
          bottom: "-4px",
          fontFamily: "var(--font-display)",
          fontSize: `${Math.max(10, Math.round(size * 0.42))}px`,
          lineHeight: 1,
          color: "var(--primary-fg)",
          background: "var(--violet)",
          border: "1px solid var(--bg)",
          borderRadius: "4px",
          padding: "1px 3px",
          letterSpacing: "0.02em",
        }}
      >
        {ROMAN[grade]}
      </span>
    </span>
  );
}
