/**
 * WO-13-007 — Panel / RpgPanel (CMP-13-panel)
 *
 * The app-wide surface. Three variants:
 *   - 'panel': base surface (.panel) — RPG embossed pressed-pixel-tile signature
 *   - 'rpgpanel': explicit RPG embossed override (same as panel after re-anchor)
 *   - 'secondary': resting-tile (.secondary) — panel background, no emboss
 *
 * Optional: grid (rpggrid dot overlay), glow (warn/accent box-shadow).
 *
 * All visual properties via CSS custom properties only (tokens).
 * Light+dark first-class (tokens re-declared under [data-theme="light"]).
 *
 * Prototype reference (re-anchor, DR-054):
 *   .panel  → background:var(--card); border:1px solid var(--bd2); border-radius:10px;
 *             box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -2px 0 rgba(0,0,0,.22),0 2px 0 var(--canvas)
 *   .rpggrid → background-image: linear-gradient grid at 22px
 *
 * Traceability: CMP-13-panel, AC-13-006.x.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelVariant = "panel" | "rpgpanel" | "secondary";
type PanelGlow = "warn" | "accent";

export interface PanelProps {
  /** Surface variant. */
  variant?: PanelVariant;
  /** Adds the RPG grid dot overlay (background-image linear-gradient grid). */
  grid?: boolean;
  /** Adds a colored glow box-shadow. */
  glow?: PanelGlow;
  /** Elevation shadow level: 0 (none), 1 (resting), 2 (pop). */
  elevation?: 0 | 1 | 2;
  /** Spot mode — adds a 1.5px border (spot class). */
  spot?: boolean;
  children?: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

/**
 * Panel — the app-wide surface primitive.
 *
 * The 'panel' and 'rpgpanel' variants use the RPG embossed pressed-pixel-tile
 * signature (box-shadow inset top-highlight + bottom-shadow + 0 2px 0 canvas).
 * The 'secondary' variant is a flat resting tile (no emboss, panel background).
 *
 * Usage:
 *   <Panel>…</Panel>
 *   <Panel variant="rpgpanel" grid>…</Panel>
 *   <Panel variant="secondary" glow="warn">…</Panel>
 */
export function Panel({
  variant = "panel",
  grid = false,
  glow,
  elevation,
  spot = false,
  children,
}: PanelProps): React.JSX.Element {
  // RPG embossed style (panel + rpgpanel are both the embossed skin after re-anchor)
  const isEmbossed = variant === "panel" || variant === "rpgpanel";
  const isSecondary = variant === "secondary";

  // Build box-shadow: emboss signature + optional glow + optional elevation
  const shadowParts: string[] = [];

  if (isEmbossed) {
    // The prototype's "pressed pixel tile" signature (frozen, DR-054)
    shadowParts.push(
      "inset 0 1px 0 rgba(255,255,255,.05)",
      "inset 0 -2px 0 rgba(0,0,0,.22)",
      "0 2px 0 var(--color-base)",
    );
  }

  if (glow === "warn") {
    shadowParts.push("0 0 18px -7px var(--color-warn)");
  } else if (glow === "accent") {
    shadowParts.push("0 0 18px -7px var(--color-accent)");
  }

  if (elevation === 1) {
    shadowParts.push("var(--shadow-1, 0 1px 2px rgba(0,0,0,.3),0 8px 28px rgba(0,0,0,.35))");
  } else if (elevation === 2) {
    shadowParts.push("var(--shadow-2, 0 18px 50px rgba(0,0,0,.5))");
  }

  const style: React.CSSProperties = {
    position: "relative",
    background: isSecondary ? "var(--color-panel)" : "var(--color-card)",
    border: isSecondary
      ? "var(--hairline, 1px) solid var(--color-border)"
      : "1px solid var(--color-border-strong)",
    borderRadius: "var(--radius-md, 12px)",
    padding: "16px 18px",
    boxSizing: "border-box",
    ...(shadowParts.length > 0 ? { boxShadow: shadowParts.join(", ") } : {}),
    ...(spot ? { borderWidth: "1.5px" } : {}),
  };

  // RPG grid dot overlay (background-image, tokens only)
  const gridStyle: React.CSSProperties = grid
    ? {
        backgroundImage:
          "linear-gradient(var(--color-border, #2f373a) 1px, transparent 1px)," +
          "linear-gradient(90deg, var(--color-border, #2f373a) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }
    : {};

  const combinedStyle: React.CSSProperties = { ...style, ...gridStyle };

  return (
    <div
      data-testid="panel"
      data-variant={variant}
      data-grid={grid ? "true" : undefined}
      data-glow={glow}
      style={combinedStyle}
    >
      {children}
    </div>
  );
}
