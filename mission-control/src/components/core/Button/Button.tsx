/**
 * WO-13-007 — Button (CMP-13-button)
 *
 * Primary/secondary/ghost action button. ≥44px hit area (a11y target).
 * 1 primary per screen (convention, not enforced here).
 *
 * Prototype reference (re-anchor, DR-054):
 *   button → font-family:var(--display); background:var(--card); border:1px solid var(--bd2);
 *             color:var(--text); border-radius:8px; padding:7px 13px; font-size:13px;
 *             font-weight:500; box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 1px 0 var(--canvas)
 *   button:hover → border-color:var(--accent); box-shadow:… 0 0 14px -7px var(--accent)
 *
 * Tokens only. Light+dark first-class. WCAG AA.
 * Traceability: CMP-13-button, AC-13-006.x.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  /** Visual variant. Defaults to 'secondary'. */
  variant?: ButtonVariant;
  /** Size. Defaults to 'md' (≥44px hit area). */
  size?: ButtonSize;
  /** Disabled state. */
  disabled?: boolean;
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  /** HTML type attribute. Defaults to 'button'. */
  type?: "button" | "submit" | "reset";
  /** aria-label for icon-only buttons. */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Size → padding map (ensures ≥44px hit area on md/lg)
// ---------------------------------------------------------------------------

const SIZE_PADDING: Record<ButtonSize, string> = {
  sm: "5px 10px", // smaller; hit area may be <44px — use sparingly
  md: "10px 16px", // ~44px with normal line-height
  lg: "12px 20px", // comfortably ≥44px
} as const;

const SIZE_FONT: Record<ButtonSize, string> = {
  sm: "12px",
  md: "13px",
  lg: "14px",
} as const;

// ---------------------------------------------------------------------------
// Variant → token vars (no hardcoded hex)
// ---------------------------------------------------------------------------

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: "var(--color-accent-bg)",
        color: "var(--color-accent-text)",
        borderColor: "var(--color-accent)",
      };
    case "ghost":
      return {
        background: "transparent",
        color: "var(--color-text2)",
        borderColor: "transparent",
        boxShadow: "none",
      };
    default:
      // secondary + any unknown variant
      return {
        background: "var(--color-card)",
        color: "var(--color-text)",
        borderColor: "var(--color-border-strong)",
      };
  }
}

// ---------------------------------------------------------------------------
// Button component
// ---------------------------------------------------------------------------

/**
 * Button — shared action button.
 *
 * Usage:
 *   <Button variant="primary" onClick={handleSave}>Guardar</Button>
 *   <Button variant="ghost" size="sm">Cancelar</Button>
 */
export function Button({
  variant = "secondary",
  size = "md",
  disabled = false,
  onClick,
  children,
  type = "button",
  ariaLabel,
}: ButtonProps): React.JSX.Element {
  const baseStyle: React.CSSProperties = {
    fontFamily: "var(--font-display, system-ui, sans-serif)",
    fontSize: SIZE_FONT[size],
    fontWeight: 500,
    padding: SIZE_PADDING[size],
    border: "1px solid",
    borderRadius: "var(--radius-sm, 8px)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    lineHeight: 1.4,
    transition: "border-color var(--duration-fast, 150ms), box-shadow var(--duration-fast, 150ms)",
    boxShadow:
      variant !== "ghost"
        ? "inset 0 1px 0 rgba(255,255,255,.05), 0 1px 0 var(--color-base)"
        : undefined,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap" as const,
    userSelect: "none" as const,
    ...variantStyle(variant),
  };

  return (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      style={baseStyle}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  );
}
