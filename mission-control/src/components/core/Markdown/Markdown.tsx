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
import type { Tone } from "@/components/core/Chip/vocabulary";
import { remarkHeadingAnchors } from "./headingAnchors";
import styles from "./Markdown.module.css";
import { MarkdownAnchorScope } from "./MarkdownAnchorScope";
import { Scrollable } from "./Scrollable";

// ---------------------------------------------------------------------------
// Root — body scale (prototype: 15px / 1.6) + overflow safety
// ---------------------------------------------------------------------------

const ROOT_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-lg)",
  lineHeight: 1.7,
  color: "var(--text)",
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
  fontSize: "var(--fs-h1s)",
  fontWeight: 600,
  lineHeight: 1.25,
  margin: "0 0 .7em",
  paddingBottom: ".4em",
  borderBottom:
    "var(--hairline) solid color-mix(in srgb, var(--tone, var(--line)) 40%, var(--line))",
  color: "var(--tone, var(--text))",
};
const H2_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h2)",
  fontWeight: 600,
  lineHeight: 1.35,
  margin: "1.8em 0 .6em",
  color: "var(--tone, var(--text))",
};
const H3_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-xl)",
  fontWeight: 600,
  lineHeight: 1.4,
  margin: "1.5em 0 .5em",
  color: "color-mix(in srgb, var(--tone, var(--text)) 60%, var(--text))",
};
const H4_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-xs)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  margin: "14px 0 4px",
  color: "color-mix(in srgb, var(--tone, var(--slate)) 70%, var(--text-2))",
};

const P_STYLE: CSSProperties = { margin: "0 0 .9em", lineHeight: 1.7 };
// Tailwind v4's preflight resets `ul,ol { list-style: none }`, which removed the bullets
// (leaving only the indent). Restore the markers explicitly: disc for ul, decimal for ol.
const UL_STYLE: CSSProperties = {
  margin: "0 0 .9em",
  paddingLeft: "1.4em",
  listStyleType: "disc",
  listStylePosition: "outside",
};
const OL_STYLE: CSSProperties = {
  margin: "0 0 .9em",
  paddingLeft: "1.4em",
  listStyleType: "decimal",
  listStylePosition: "outside",
};
const LI_STYLE: CSSProperties = { margin: "4px 0", lineHeight: 1.6, display: "list-item" };
const STRONG_STYLE: CSSProperties = { fontWeight: 600, color: "var(--text)" };
const A_STYLE: CSSProperties = {
  color: "var(--blue)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
/** A link the resolver could NOT map to a real destination → rendered as plain (non-clickable)
 *  text so a dead relative path never looks like a working link. */
const A_NEUTRAL_STYLE: CSSProperties = { color: "inherit" };

const INLINE_CODE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "max(.86em, var(--fs-xs))",
  background: "color-mix(in srgb, var(--tone, var(--slate)) 8%, var(--surface-3))",
  padding: "1px 5px",
  borderRadius: "var(--r-xs)",
  color: "var(--text)",
};
const PRE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-xs)",
  lineHeight: 1.5,
  background: "color-mix(in srgb, var(--tone, var(--slate)) 8%, var(--surface-3))",
  padding: "12px 14px",
  borderRadius: "var(--r)",
  margin: "10px 0",
  overflowX: "auto",
};
const BLOCKQUOTE_STYLE: CSSProperties = {
  margin: "10px 0",
  paddingLeft: "12px",
  border: "var(--hairline) solid color-mix(in srgb, var(--tone, var(--blue)) 30%, var(--line))",
  borderRadius: "var(--r)",
  background: "color-mix(in srgb, var(--tone, var(--blue)) 7%, transparent)",
  color: "var(--text-2)",
};
const HR_STYLE: CSSProperties = {
  border: "none",
  borderTop: "0.5px solid var(--line)",
  margin: "18px 0",
};

const TABLE_STYLE: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: "var(--fs-md)",
};
const TH_STYLE: CSSProperties = {
  textAlign: "left",
  padding: "9px var(--s3)",
  border: "var(--hairline) solid var(--line)",
  background: "color-mix(in srgb, var(--tone, var(--slate)) var(--tint), var(--surface-2))",
  fontWeight: 600,
};
const TD_STYLE: CSSProperties = {
  padding: "9px var(--s3)",
  border: "var(--hairline) solid var(--line)",
  verticalAlign: "top",
};
const IMG_STYLE: CSSProperties = { maxWidth: "100%", borderRadius: "var(--r)" };

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
  h1: ({ children, id }) => (
    <h2 id={id} style={H1_STYLE}>
      {children}
    </h2>
  ),
  h2: ({ children, id }) => (
    <h3 id={id} style={H2_STYLE}>
      {children}
    </h3>
  ),
  h3: ({ children, id }) => (
    <h4 id={id} style={H3_STYLE}>
      {children}
    </h4>
  ),
  h4: ({ children, id }) => (
    <h5 id={id} style={H4_STYLE}>
      {children}
    </h5>
  ),
  h5: ({ children, id }) => (
    <h6 id={id} style={H4_STYLE}>
      {children}
    </h6>
  ),
  h6: ({ children, id }) => (
    <h6 id={id} style={H4_STYLE}>
      {children}
    </h6>
  ),
  p: ({ children }) => <p style={P_STYLE}>{children}</p>,
  ul: ({ children }) => <ul style={UL_STYLE}>{children}</ul>,
  ol: ({ children }) => <ol style={OL_STYLE}>{children}</ol>,
  li: ({ children }) => <li style={LI_STYLE}>{children}</li>,
  strong: ({ children }) => <strong style={STRONG_STYLE}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      style={A_STYLE}
      target={href?.startsWith("#") ? undefined : "_blank"}
      rel="noreferrer noopener"
    >
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
  pre: ({ children }) => (
    <Scrollable kind="code">
      <pre style={PRE_STYLE}>{children}</pre>
    </Scrollable>
  ),
  blockquote: ({ children }) => <blockquote style={BLOCKQUOTE_STYLE}>{children}</blockquote>,
  hr: () => <hr style={HR_STYLE} />,
  table: ({ children }) => (
    <Scrollable kind="table">
      <table className={styles.table} style={TABLE_STYLE}>
        {children}
      </table>
    </Scrollable>
  ),
  th: ({ children }) => <th style={TH_STYLE}>{children}</th>,
  td: ({ children }) => <td style={TD_STYLE}>{children}</td>,
  img: ({ src, alt }) => (
    // biome-ignore lint/performance/noImgElement: markdown embeds arbitrary external image URLs; next/image needs known dimensions / allowlisted domains.
    <img src={typeof src === "string" ? src : undefined} alt={alt} style={IMG_STYLE} />
  ),
};

const REMARK_PLUGINS = [remarkGfm, remarkHeadingAnchors];

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
  /** Optional semantic element overrides for embedded document excerpts. */
  components?: Components;
  /** Document-type hue and dense embedded presentation. */
  tone?: Tone;
  compact?: boolean;
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
  components: overrides,
  tone,
  compact = false,
  ...rest
}: MarkdownProps): React.JSX.Element {
  const components = {
    ...COMPONENTS,
    ...overrides,
    ...(resolveLink ? { a: makeAnchor(resolveLink) } : {}),
  };
  return (
    <MarkdownAnchorScope
      className={`pc-markdown md ${styles.markdown} ${compact ? `compact ${styles.compact}` : ""}`}
      tone={tone}
      style={{
        ...ROOT_STYLE,
        ...(compact ? { fontSize: "var(--fs-md)", lineHeight: 1.6 } : {}),
        ...style,
      }}
      testId={rest["data-testid"]}
    >
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {children}
      </ReactMarkdown>
    </MarkdownAnchorScope>
  );
}
