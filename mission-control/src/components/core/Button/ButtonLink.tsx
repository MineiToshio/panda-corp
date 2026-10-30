import styles from "./Button.module.css";

export interface ButtonLinkProps {
  readonly href: string;
  readonly children: React.ReactNode;
  /** `inline` is the text-link action; `button` looks like a default button. */
  readonly look?: "button" | "inline";
}

/** A real link (`<a>`) that carries the button or inline-action look; never a button inside a link. */
export function ButtonLink({
  href,
  children,
  look = "inline",
}: ButtonLinkProps): React.JSX.Element {
  return (
    <a
      href={href}
      className={look === "inline" ? `btn ${styles.btn} ${styles.link}` : `btn ${styles.btn}`}
    >
      {children}
    </a>
  );
}
