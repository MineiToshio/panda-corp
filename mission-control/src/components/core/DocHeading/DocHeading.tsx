/**
 * WO-13-007 — DocHeading (CMP-13-docheading)
 *
 * Reading heading: accent ledge + title (docH).
 * Used in document/manual pages as the section reading heading.
 *
 * Aliases: docH.
 *
 * Tokens only. Light+dark first-class.
 * Traceability: CMP-13-docheading, AC-13-006.x.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocHeadingProps {
  /** The heading title text. */
  title: string;
  /** Heading level. Defaults to 2 (h2). */
  level?: 1 | 2 | 3 | 4;
}

// ---------------------------------------------------------------------------
// DocHeading component
// ---------------------------------------------------------------------------

/**
 * DocHeading — reading section heading with accent ledge.
 *
 * Usage:
 *   <DocHeading title="Guía de inicio rápido" />
 *   <DocHeading title="Referencia de comandos" level={1} />
 *
 * The accent ledge (left border strip) reinforces the heading hierarchy
 * visually without relying on color alone (the heading text carries the
 * structural meaning; the ledge is decorative, aria-hidden).
 */
export function DocHeading({ title, level = 2 }: DocHeadingProps): React.JSX.Element {
  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "22px 0 11px",
  };

  // Accent ledge: a thin vertical bar using the accent token
  const ledgeStyle: React.CSSProperties = {
    flexShrink: 0,
    width: "3px",
    alignSelf: "stretch",
    borderRadius: "2px",
    background: "var(--color-accent)",
  };

  const textStyle: React.CSSProperties = {
    fontFamily: "var(--font-display, system-ui, sans-serif)",
    fontWeight: 600,
    fontSize: level === 1 ? "20px" : level === 2 ? "16px" : "14px",
    lineHeight: 1.3,
    color: "var(--color-text)",
    margin: 0,
  };

  const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4";

  return (
    <div data-testid="doc-heading" style={wrapperStyle}>
      {/* Accent ledge — decorative, aria-hidden */}
      <span data-testid="doc-heading-ledge" aria-hidden="true" style={ledgeStyle} />
      <HeadingTag style={textStyle}>{title}</HeadingTag>
    </div>
  );
}
