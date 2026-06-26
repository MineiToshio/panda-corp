/**
 * RankEmblem — the guild rank's pixel-art emblem (a self-framed medal sprite).
 *
 * Renders `/ranks/<sprite>.png` at a fixed square size. Falls back to the rank's
 * Tabler icon when the sprite slug is missing (older GuildLevel objects / tests).
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
  /** Tabler icon class used as a fallback when there is no sprite. */
  icon?: string;
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
  icon?: string;
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
    <i
      className={`ti ${icon ?? "ti-medal"}`}
      aria-hidden="true"
      style={{ fontSize: `${Math.round(size * 0.78)}px`, color: "var(--color-accent-text)" }}
    />
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
          right: "-3px",
          bottom: "-3px",
          fontFamily: "var(--font-pixel)",
          fontSize: `${Math.max(8, Math.round(size * 0.3))}px`,
          lineHeight: 1,
          color: "var(--color-on-accent)",
          background: "var(--color-accent)",
          border: "1px solid var(--color-base)",
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
