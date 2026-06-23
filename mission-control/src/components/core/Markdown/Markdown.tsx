/**
 * core/Markdown — the single, reusable Markdown renderer for the app (DR-057).
 *
 * Wraps react-markdown (+ remark-gfm for tables / strikethrough / task lists) with a
 * styled element map so EVERY document renders with one consistent, legible typographic
 * scale: real h1 > h2 > h3 hierarchy, breathing-room spacing, styled bold / lists /
 * inline-code / fenced-code / tables / quotes. Reused by the card-detail Documentos,
 * the work-order detail, the project documents tab, the Manual fallback and summaries —
 * so the markdown styling lives in ONE place instead of being re-invented per surface.
 *
 * Faithful to the prototype's `.doc` scale (docs/design/prototype/index.html L76-78):
 * h1 20 · h2 16 · h3 14, body 15/1.6, mono code on a secondary chip. Tokens only
 * (FRD-13, zero hardcoded colors) and overflow-safe (long ids/paths wrap, never spill).
 */

import type { CSSProperties } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Root — body scale (prototype: 15px / 1.6) + overflow safety
// ---------------------------------------------------------------------------

const ROOT_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "15px",
  lineHeight: 1.6,
  color: "var(--color-text, currentColor)",
  // `break-word` (not `anywhere`) breaks long unbreakable tokens (urls/paths/ids) to
  // prevent overflow WITHOUT collapsing the min-content width to one character — which,
  // in a narrow flex/grid cell (mobile), squished the whole document to 1 char per line.
  overflowWrap: "break-word",
  minWidth: 0,
};

// ---------------------------------------------------------------------------
// Per-element styles — headings use the display font; real size hierarchy so the
// h1 always reads as the main title (the previous renderers flattened all headings).
// ---------------------------------------------------------------------------

const H1_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "20px",
  fontWeight: 600,
  lineHeight: 1.25,
  margin: "2px 0 10px",
  color: "var(--color-text)",
};
const H2_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "16px",
  fontWeight: 600,
  lineHeight: 1.35,
  margin: "22px 0 6px",
  color: "var(--color-text)",
};
const H3_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1.4,
  margin: "16px 0 4px",
  color: "var(--color-text)",
};
const H4_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.01em",
  margin: "14px 0 4px",
  color: "var(--color-text2, var(--color-text))",
};

const P_STYLE: CSSProperties = { margin: "8px 0", lineHeight: 1.65 };
// Tailwind v4's preflight resets `ul,ol { list-style: none }`, which removed the bullets
// (leaving only the indent). Restore the markers explicitly: disc for ul, decimal for ol.
const UL_STYLE: CSSProperties = {
  margin: "8px 0",
  paddingLeft: "22px",
  listStyleType: "disc",
  listStylePosition: "outside",
};
const OL_STYLE: CSSProperties = {
  margin: "8px 0",
  paddingLeft: "26px",
  listStyleType: "decimal",
  listStylePosition: "outside",
};
const LI_STYLE: CSSProperties = { margin: "4px 0", lineHeight: 1.6, display: "list-item" };
const STRONG_STYLE: CSSProperties = { fontWeight: 600, color: "var(--color-text)" };
const A_STYLE: CSSProperties = {
  color: "var(--color-accent-text, var(--color-accent))",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
/** A link the resolver could NOT map to a real destination → rendered as plain (non-clickable)
 *  text so a dead relative path never looks like a working link. */
const A_NEUTRAL_STYLE: CSSProperties = { color: "inherit" };

const INLINE_CODE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.85em",
  background: "var(--color-secondary, var(--color-surface2))",
  padding: "1px 5px",
  borderRadius: "4px",
  color: "var(--color-text)",
};
const PRE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  lineHeight: 1.5,
  background: "var(--color-secondary, var(--color-surface2))",
  padding: "12px 14px",
  borderRadius: "var(--radius-sm, 8px)",
  margin: "10px 0",
  overflowX: "auto",
};
const BLOCKQUOTE_STYLE: CSSProperties = {
  margin: "10px 0",
  paddingLeft: "12px",
  borderLeft: "3px solid var(--color-border, currentColor)",
  color: "var(--color-text2, currentColor)",
};
const HR_STYLE: CSSProperties = {
  border: "none",
  borderTop: "0.5px solid var(--color-border, currentColor)",
  margin: "18px 0",
};

const TABLE_WRAP_STYLE: CSSProperties = { overflowX: "auto", margin: "10px 0" };
const TABLE_STYLE: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: "14px",
};
const TH_STYLE: CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  borderBottom: "1px solid var(--color-border, currentColor)",
  background: "var(--color-secondary, transparent)",
  fontWeight: 600,
};
const TD_STYLE: CSSProperties = {
  padding: "6px 10px",
  borderBottom: "0.5px solid var(--color-border, currentColor)",
  verticalAlign: "top",
};
const IMG_STYLE: CSSProperties = { maxWidth: "100%", borderRadius: "var(--radius-sm, 8px)" };

// ---------------------------------------------------------------------------
// Element map. Two notes:
//   1. Headings are DEMOTED one level (markdown `#` → <h2>, `##` → <h3>, …) while
//      keeping the visual scale (H1_STYLE on the <h2>, etc.). Markdown here is always
//      EMBEDDED under a page that already owns the single <h1> (the PageTitle), so the
//      content must never emit its own <h1> (WCAG: one h1 per page) — yet the document's
//      main title must still READ as the biggest heading. Demotion satisfies both.
//   2. Inline code vs fenced code: in react-markdown v10 a fenced block carries a
//      `language-*` className, inline code does not — so we chip only inline.
// ---------------------------------------------------------------------------

const COMPONENTS: Components = {
  h1: ({ children }) => <h2 style={H1_STYLE}>{children}</h2>,
  h2: ({ children }) => <h3 style={H2_STYLE}>{children}</h3>,
  h3: ({ children }) => <h4 style={H3_STYLE}>{children}</h4>,
  h4: ({ children }) => <h5 style={H4_STYLE}>{children}</h5>,
  h5: ({ children }) => <h6 style={H4_STYLE}>{children}</h6>,
  h6: ({ children }) => <h6 style={H4_STYLE}>{children}</h6>,
  p: ({ children }) => <p style={P_STYLE}>{children}</p>,
  ul: ({ children }) => <ul style={UL_STYLE}>{children}</ul>,
  ol: ({ children }) => <ol style={OL_STYLE}>{children}</ol>,
  li: ({ children }) => <li style={LI_STYLE}>{children}</li>,
  strong: ({ children }) => <strong style={STRONG_STYLE}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
  a: ({ href, children }) => (
    <a href={href} style={A_STYLE} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isFenced = typeof className === "string" && className.startsWith("language-");
    if (isFenced) {
      return <code className={className}>{children}</code>;
    }
    return <code style={INLINE_CODE_STYLE}>{children}</code>;
  },
  pre: ({ children }) => <pre style={PRE_STYLE}>{children}</pre>,
  blockquote: ({ children }) => <blockquote style={BLOCKQUOTE_STYLE}>{children}</blockquote>,
  hr: () => <hr style={HR_STYLE} />,
  table: ({ children }) => (
    <div style={TABLE_WRAP_STYLE}>
      <table style={TABLE_STYLE}>{children}</table>
    </div>
  ),
  th: ({ children }) => <th style={TH_STYLE}>{children}</th>,
  td: ({ children }) => <td style={TD_STYLE}>{children}</td>,
  img: ({ src, alt }) => (
    // biome-ignore lint/performance/noImgElement: markdown embeds arbitrary external image URLs; next/image needs known dimensions / allowlisted domains.
    <img src={typeof src === "string" ? src : undefined} alt={alt} style={IMG_STYLE} />
  ),
};

const REMARK_PLUGINS = [remarkGfm];

// ---------------------------------------------------------------------------
// Link resolution (opt-in) — lets a caller rewrite where a markdown link points.
//   - { href, external }  → render an <a> (external → new tab, internal → same tab)
//   - { onSelect }        → render a link-styled <button> (client-side navigation,
//                           e.g. the board card-detail selects the doc in its own rail)
//   - null                → render the link text as plain, non-clickable text
// Used by the document readers so a relative link like `../frds/frd-01-.../frd.md` opens
// that doc inside the SAME reader instead of 404-ing against the app's routes.
// ---------------------------------------------------------------------------

/** Resolve to a navigable href (URL-driven readers). */
interface HrefLink {
  href: string;
  /** true → open in a new tab (off-app URL); false → same tab (in-app navigation). */
  external: boolean;
}
/** Resolve to a client-side selection (state-driven readers, e.g. board card-detail). */
interface ActionLink {
  onSelect: () => void;
}
/** Where a markdown link resolves to (or null to neutralize it). */
type ResolvedLink = HrefLink | ActionLink;

export type LinkResolver = (href: string) => ResolvedLink | null;

/** A link rendered as a button (client-side selection) — link visuals, button semantics. */
const A_BUTTON_STYLE: CSSProperties = {
  ...A_STYLE,
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  cursor: "pointer",
};

/** Build a resolver-aware anchor renderer; a null resolution renders plain text. */
function makeAnchor(resolveLink: LinkResolver): NonNullable<Components["a"]> {
  return ({ href, children }) => {
    const resolved = typeof href === "string" ? resolveLink(href) : null;
    if (resolved === null) {
      return (
        <span style={A_NEUTRAL_STYLE} title="Documento no disponible en el lector">
          {children}
        </span>
      );
    }
    if ("onSelect" in resolved) {
      return (
        <button type="button" style={A_BUTTON_STYLE} onClick={resolved.onSelect}>
          {children}
        </button>
      );
    }
    if (resolved.external) {
      return (
        <a href={resolved.href} style={A_STYLE} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    }
    return (
      <a href={resolved.href} style={A_STYLE}>
        {children}
      </a>
    );
  };
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface MarkdownProps {
  /** The raw markdown string to render. */
  children: string;
  /** Optional testid on the root wrapper. */
  "data-testid"?: string;
  /** Optional style overrides merged onto the root (e.g. a tighter font-size). */
  style?: CSSProperties;
  /**
   * Optional link resolver. When provided, each link href is passed through it to decide
   * the destination (in-app vs new tab) or to neutralize a dead relative path. When omitted,
   * links render as-is in a new tab (the default for every other markdown surface).
   */
  resolveLink?: LinkResolver;
}

/**
 * Render a markdown string with the app's shared document styling.
 *
 * @example <Markdown>{doc.body}</Markdown>
 * @example <Markdown resolveLink={resolver}>{doc.body}</Markdown>
 */
export function Markdown({
  children,
  style,
  resolveLink,
  ...rest
}: MarkdownProps): React.JSX.Element {
  const components = resolveLink ? { ...COMPONENTS, a: makeAnchor(resolveLink) } : COMPONENTS;
  return (
    <div
      className="pc-markdown"
      style={style ? { ...ROOT_STYLE, ...style } : ROOT_STYLE}
      data-testid={rest["data-testid"]}
    >
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
