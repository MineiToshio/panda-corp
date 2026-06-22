/**
 * manual-diagrams/DocH.tsx — FRD-08 Manual section heading (prototype `docH`)
 *
 * The Manual's reading heading, pixel-faithful to the prototype `docH(t)`
 * (index.html L1054): a 6×18px accent bar WITH glow + a 18px display-font title.
 *
 * This is intentionally distinct from the core `DocHeading` primitive (3px ledge,
 * 16/20px, no glow) which carries a different contract used across other surfaces.
 * The Manual re-anchor requires the prototype's exact `docH` look, so it ships as
 * a Manual-scoped heading. Tokens only · light+dark first-class.
 *
 * Renders a real heading element (h1/h2/h3) so the title is in the a11y tree and
 * queryable by role — `level` defaults to 2 (the page H1 belongs to PageTitle,
 * DR-062), but the FIRST heading of an authored page passes level={1} so the
 * reader exposes the page title as an <h1> (visual re-anchor tests).
 *
 * Traceability: CMP-08-diagrams (docH).
 */

import type React from "react";

export interface DocHProps {
  /** Heading text. */
  title: string;
  /** Heading level (1–3). Defaults to 2. */
  level?: 1 | 2 | 3;
}

export function DocH({ title, level = 2 }: DocHProps): React.JSX.Element {
  const HeadingTag = `h${level}` as "h1" | "h2" | "h3";

  return (
    <div
      data-testid="manual-doc-h"
      style={{
        fontSize: "18px",
        margin: "2px 0 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {/* Accent bar with glow — decorative, aria-hidden */}
      <span
        aria-hidden="true"
        style={{
          width: "6px",
          height: "18px",
          borderRadius: "3px",
          background: "var(--color-accent)",
          flex: "0 0 auto",
          boxShadow: "0 0 9px -2px var(--color-accent)",
        }}
      />
      <HeadingTag
        style={{
          margin: 0,
          fontSize: "18px",
          fontFamily: "var(--font-display, system-ui, sans-serif)",
          fontWeight: 600,
          color: "var(--color-text)",
          lineHeight: 1.3,
        }}
      >
        {title}
      </HeadingTag>
    </div>
  );
}
