import Link from "next/link";
import type { Tone } from "@/components/core/Chip/vocabulary";
import type { ButtonProps } from "./Button";
import styles from "./Button.module.css";

export interface ButtonLinkProps {
  readonly size?: ButtonProps["size"];
  readonly href: string;
  readonly children: React.ReactNode;
  /** `inline` is the text-link action; `button` looks like a default button. */
  readonly look?: "button" | "inline";
  /** Toned button look for a navigation action that shares a toned button's slot. */
  readonly tone?: Tone;
}

/** A real link (`<a>`) that carries the button or inline-action look; never a button inside a link. */
export function ButtonLink({
  href,
  children,
  look = "inline",
  size = "md",
  tone,
}: ButtonLinkProps): React.JSX.Element {
  return (
    <Link
      href={href}
      data-size={look === "button" ? size : undefined}
      data-variant={tone ? "toned" : undefined}
      data-tone={tone}
      className={
        look === "inline"
          ? `btn ${styles.btn} ${styles.link}`
          : `btn ${styles.btn} ${styles.navigation}`
      }
    >
      {children}
    </Link>
  );
}
