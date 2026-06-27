"use client";

/**
 * WO-13-007 — Banner (CMP-13-banner)
 *
 * THE shared warn/info/ok/danger banner strip (DR-057 dup-fix).
 * Eliminates the duplicate BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE blocks that
 * each consumer used to re-declare independently (e.g. PluginSyncBanner, FRD-15).
 *
 * Contract:
 *   - tone: warn/info/ok/danger — sets data-tone, colors via CSS vars only
 *   - kind: drift/orphan/gate/error/inline — sets data-kind (consumer context)
 *   - heading: required string
 *   - detail?: optional secondary line
 *   - commandRow?: optional mono command string (renders CmdRow)
 *   - dismissible?: boolean — shows dismiss ×
 *   - onDismiss?: () => void — called when dismissed
 *   - items[]?: { id, label } — multi-item list
 *   - collapseAfter?: number — collapse list beyond this count
 *
 * Accessibility: role="alert", aria-label, icon aria-hidden, keyboard dismiss.
 * Motion: respects prefers-reduced-motion via CSS (no JS animation).
 * Tokens only: all colors via var(--color-*) / var(--hairline) / var(--space-base).
 *
 * Traceability: AC-13-006.x, CMP-13-banner, DR-057.
 */

import { useState } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BannerTone = "warn" | "info" | "ok" | "danger";
type BannerKind = "drift" | "gate" | "error" | "inline";

interface BannerItem {
  id: string;
  label: string;
}

export interface BannerProps {
  /** Visual tone — sets color scheme (via CSS custom properties only). */
  tone: BannerTone;
  /** Consumer context — identifies what kind of condition this banner represents. */
  kind?: BannerKind;
  /**
   * Optional Tabler icon class (e.g. "ti-alert-triangle") shown left of the heading,
   * matching the prototype's per-banner glyph. Falls back to the tone SVG when omitted.
   */
  icon?: string;
  /** Required heading (primary signal, always visible). */
  heading: string;
  /** Optional secondary detail line. */
  detail?: string;
  /**
   * Optional extra body content rendered between `detail` and `commandRow`.
   * Use for recall/recovery sequences (e.g. FRD-15 drift recall steps).
   * Rendered as-is — consumer is responsible for tokens and testids.
   */
  children?: React.ReactNode;
  /** Optional mono command to display in a command row with a copy button. */
  commandRow?: string;
  /** If true, renders a keyboard-operable dismiss × button. */
  dismissible?: boolean;
  /** Called when the dismiss button is clicked. */
  onDismiss?: () => void;
  /** Optional list of items to display below the heading (multi-item mode). */
  items?: BannerItem[];
  /** Collapse items list beyond this count; shows a toggle. */
  collapseAfter?: number;
}

// ---------------------------------------------------------------------------
// Token map: tone → CSS variable names (no hardcoded hex)
// ---------------------------------------------------------------------------

const TONE_VARS: Record<BannerTone, { fg: string; bg: string; border: string }> = {
  warn: {
    fg: "var(--color-warn)",
    bg: "var(--color-warn-bg)",
    border: "var(--color-warn)",
  },
  info: {
    fg: "var(--color-info)",
    bg: "var(--color-info-bg)",
    border: "var(--color-info)",
  },
  ok: {
    fg: "var(--color-ok)",
    bg: "var(--color-ok-bg)",
    border: "var(--color-ok)",
  },
  danger: {
    fg: "var(--color-danger)",
    bg: "var(--color-danger-bg)",
    border: "var(--color-danger)",
  },
} as const;

// ---------------------------------------------------------------------------
// Icon shapes per tone (inline SVG, aria-hidden — state conveyed by text too)
// ---------------------------------------------------------------------------

function ToneIcon({ tone }: { tone: BannerTone }): React.JSX.Element {
  // All icons are geometrically distinct so no two tones share the same shape.
  // aria-hidden: the icon is decorative; heading text + aria-label carry the meaning.
  const size = 16;

  switch (tone) {
    case "warn":
      // Warning triangle
      return (
        <svg
          data-testid="banner-icon"
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          role="presentation"
        >
          <polygon points="8,2 14,14 2,14" />
          <line x1="8" y1="7" x2="8" y2="10" />
          <circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "danger":
      // Circle with X
      return (
        <svg
          data-testid="banner-icon"
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          role="presentation"
        >
          <circle cx="8" cy="8" r="6" />
          <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" />
          <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" />
        </svg>
      );
    case "ok":
      // Circle with checkmark
      return (
        <svg
          data-testid="banner-icon"
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          role="presentation"
        >
          <circle cx="8" cy="8" r="6" />
          <polyline points="5.5,8 7,10 10.5,6" />
        </svg>
      );
    default:
      // Circle with i (covers info + any unknown tone)
      return (
        <svg
          data-testid="banner-icon"
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          role="presentation"
        >
          <circle cx="8" cy="8" r="6" />
          <line x1="8" y1="6" x2="8" y2="6" strokeWidth={2} />
          <line x1="8" y1="8.5" x2="8" y2="11" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Banner component (CMP-13-banner)
// ---------------------------------------------------------------------------

/**
 * Banner — THE shared warn/info/ok/danger banner strip.
 *
 * One component for all app banners (FRD-15 PluginSyncBanner, FRD-03 path-not-found,
 * FRD-18 health banners, FRD-17 memory-health nudge).
 *
 * Use via: `<Banner tone="warn" heading="…" detail="…" commandRow="…" dismissible />`
 */
export function Banner({
  tone,
  kind,
  icon,
  heading,
  detail,
  children,
  commandRow,
  dismissible,
  onDismiss,
  items,
  collapseAfter,
}: BannerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const vars = TONE_VARS[tone];

  // Full rounded card, neutral hairline border (prototype: `.5px solid var(--bd2)`,
  // radius-md) — NOT a top/bottom strip and NOT the loud tone-colored border.
  const rootStyle: React.CSSProperties = {
    background: vars.bg,
    border: "0.5px solid var(--color-border-strong)",
    borderRadius: "var(--radius-md, 12px)",
    padding: "12px 14px",
    width: "100%",
    color: vars.fg,
  };

  const innerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "0.875rem",
    fontWeight: 500,
    margin: 0,
  };

  const detailStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    opacity: 0.9,
    margin: "0.125rem 0 0",
  };

  const dismissStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    opacity: 0.7,
    padding: "0.125rem 0.25rem",
    marginLeft: "auto",
    fontSize: "1rem",
    lineHeight: 1,
    flexShrink: 0,
    color: "inherit",
  };

  const toggleStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    opacity: 0.85,
    padding: "0.25rem 0",
    fontSize: "0.75rem",
    fontWeight: 500,
    textDecoration: "underline",
    color: "inherit",
  };

  const itemStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    margin: "0.25rem 0 0",
    paddingLeft: "0.25rem",
    borderLeft: `2px solid ${vars.border}`,
  };

  // Determine which items to show (collapsed vs expanded)
  const safeItems = Array.isArray(items) ? items : [];
  const hasItems = safeItems.length > 0;
  const shouldCollapse =
    hasItems && collapseAfter !== undefined && safeItems.length > collapseAfter;
  const shownItems = shouldCollapse && !expanded ? safeItems.slice(0, collapseAfter) : safeItems;
  const hiddenCount = shouldCollapse ? safeItems.length - (collapseAfter ?? 0) : 0;

  return (
    <div
      data-testid="banner"
      data-tone={tone}
      data-kind={kind}
      role="alert"
      aria-label={`Aviso: ${heading}`}
      style={rootStyle}
    >
      <div style={innerStyle}>
        {/* Icon — state conveyed by icon + heading text, never color alone (FRD-13).
            Prefer the consumer's per-banner Tabler glyph; fall back to the tone SVG. */}
        <span style={{ flexShrink: 0, marginTop: "1px", lineHeight: 1, color: vars.fg }}>
          {icon !== undefined ? (
            <i
              className={`ti ${icon}`}
              data-testid="banner-icon"
              aria-hidden="true"
              style={{ fontSize: "20px", lineHeight: 1 }}
            />
          ) : (
            <ToneIcon tone={tone} />
          )}
        </span>

        <div style={bodyStyle}>
          {/* Primary heading */}
          <p style={headingStyle}>{heading}</p>

          {/* Optional detail */}
          {detail !== undefined && (
            <p data-testid="banner-detail" style={detailStyle}>
              {detail}
            </p>
          )}

          {/* Optional extra body content (recall steps, custom sections) */}
          {children}

          {/* Multi-item list */}
          {hasItems &&
            shownItems.map((item) => (
              <p key={item.id} style={itemStyle}>
                {item.label}
              </p>
            ))}

          {/* Collapse toggle */}
          {shouldCollapse && (
            <button
              type="button"
              data-testid="banner-collapse-toggle"
              aria-expanded={expanded}
              style={toggleStyle}
              onClick={() => {
                setExpanded((prev) => !prev);
              }}
            >
              {expanded
                ? "Ver menos"
                : `Ver ${hiddenCount} elemento${hiddenCount === 1 ? "" : "s"} más`}
            </button>
          )}

          {/* Optional command row — aligned with the body content (left edge = heading, not
              under the icon), reusing the shared CmdRow primitive (DR-057). Lives inside the
              body column so its width tracks the message, owner request 2026-06-26. */}
          {commandRow !== undefined && (
            <div data-testid="banner-cmd-row" style={{ marginTop: "10px" }}>
              <CmdRow command={commandRow} />
            </div>
          )}
        </div>

        {/* Optional dismiss button (keyboard-operable, AC-13-006.3) */}
        {dismissible === true && (
          <button
            type="button"
            data-testid="banner-dismiss"
            aria-label="Descartar aviso"
            style={dismissStyle}
            onClick={onDismiss}
          >
            {/* × — state conveyed by button label, not color alone (FRD-13) */}
            &#x00D7;
          </button>
        )}
      </div>
    </div>
  );
}
