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

export type RankEmblemProps = {
  /** Rank-family sprite slug → /ranks/<slug>.png. */
  sprite?: string;
  /** Tabler icon class used as a fallback when there is no sprite. */
  icon?: string;
  /** Square size in px. */
  size: number;
  /** Accessible alt text (rank name). Empty = decorative. */
  alt?: string;
};

export function RankEmblem({ sprite, icon, size, alt = "" }: RankEmblemProps): React.JSX.Element {
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
        style={{ display: "block", flexShrink: 0, objectFit: "contain" }}
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
