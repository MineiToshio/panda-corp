import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Button.module.css";

type ButtonVariant = "default" | "primary" | "secondary" | "ghost" | "toned" | "danger";
type ButtonSize = "sm" | "md" | "lg";
/** Colour intent, composed with `variant`. 'danger' recolours to the destructive palette. */
type ButtonTone = "default" | "danger" | Tone;

export interface ButtonProps {
  /** Visual variant. Defaults to 'secondary'. */
  variant?: ButtonVariant;
  /**
   * Colour intent layered on top of `variant`. 'danger' makes a destructive button:
   * Danger stays outlined coral for every variant. Defaults to 'default'.
   */
  tone?: ButtonTone;
  /** Size. Defaults to 'md' (40 px); sm is 32 px. */
  size?: ButtonSize;
  /** Optional SVG icon from the shared icon set. */
  icon?: IconName;
  /** Additional class names. */
  className?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  /** HTML type attribute. Defaults to 'button'. */
  type?: "button" | "submit" | "reset";
  /** aria-label for icon-only buttons. */
  ariaLabel?: string;
  /** Override the default data-testid ("button"). For callers that need a unique testid. */
  "data-testid"?: string;
}

/** Shared action button. Use one primary action per screen; danger stays outlined. */
export function Button({
  variant = "secondary",
  tone = "default",
  size = "md",
  disabled = false,
  onClick,
  children,
  type = "button",
  ariaLabel,
  icon,
  className,
  "data-testid": testId = "button",
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={`btn ${variant} ${size} ${styles.btn} ${className ?? ""}`}
      data-testid={testId}
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </button>
  );
}
