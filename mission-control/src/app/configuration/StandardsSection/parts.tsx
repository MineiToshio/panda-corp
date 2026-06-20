"use client";
/**
 * WO-07-009 — Standards section sub-components (CMP-07-standards-list + CMP-07-standard-detail)
 *
 * Internal building blocks for StandardsSection: the copy-only "New standard"
 * button and the domain/list/detail rendering tree. "use client" because these
 * carry interaction state (open/close, Summary/Detail tabs, clipboard write).
 *
 * Traceability:
 *   CMP-07-standards-list → AC-07-009.1 (domain grouping)
 *   CMP-07-standards-list → AC-07-009.2 (severity + enforcement badges)
 *   CMP-07-standard-detail → AC-07-009.3 (Summary / Detail toggle)
 *   AC-07-009.4 ("New standard" copies /pandacorp:learn)
 *   AC-07-009.5 (graceful fallback for missing metadata)
 */

import type React from "react";
import { useCallback, useState } from "react";
import Markdown from "react-markdown";
import type { Standard, StandardDomain } from "@/lib/standards/standards";
import {
  BADGES_STYLE,
  DETAIL_PANEL_STYLE,
  DETAIL_TABS_STYLE,
  DOMAIN_GROUP_STYLE,
  DOMAIN_HEADING_STYLE,
  detailTabStyle,
  enforcementBadgeStyle,
  ITEM_TITLE_STYLE,
  LIST_STYLE,
  MARKDOWN_BODY_STYLE,
  SUMMARY_BULLET_STYLE,
  SUMMARY_ITEM_STYLE,
  SUMMARY_LIST_STYLE,
  severityBadgeStyle,
  standardItemStyle,
} from "./styles";

// ---------------------------------------------------------------------------
// NewStandardButton — copy-only affordance for /pandacorp:learn (AC-07-009.4)
// ---------------------------------------------------------------------------

/**
 * Copy-only button that writes `/pandacorp:learn` to the clipboard.
 * Does NOT execute anything (architecture §1 golden rule).
 * Uses navigator.clipboard.writeText directly so the <button> itself
 * carries data-testid="new-standard-button" (shared CopyButton hardcodes
 * its own testid and cannot receive an override).
 */
export function NewStandardButton(): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("/pandacorp:learn");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed — do not show confirmation
    }
  }, []);

  return (
    <button
      type="button"
      data-testid="new-standard-button"
      aria-label={copied ? "Copiado al portapapeles" : "Copiar /pandacorp:learn al portapapeles"}
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "calc(var(--spacing, 0.25rem) * 2)",
        padding: "calc(var(--spacing, 0.25rem) * 1.5) calc(var(--spacing, 0.25rem) * 3)",
        border: "var(--hairline, 1px) solid var(--color-accent, currentColor)",
        borderRadius: "var(--radius, 0.5rem)",
        background: "transparent",
        color: "var(--color-accent, currentColor)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "0.8125rem",
        fontWeight: 600,
        transition: "opacity var(--duration-fast, 150ms) var(--easing-standard, ease)",
      }}
    >
      <span aria-hidden="true">+</span>
      <span>{copied ? "¡Copiado!" : "Nuevo estándar"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  standard: Standard;
}

function DetailPanel({ standard }: DetailPanelProps): React.JSX.Element {
  const [view, setView] = useState<"summary" | "detail">("summary");

  return (
    <div style={DETAIL_PANEL_STYLE} data-testid={`standard-detail-${standard.id}`}>
      {/* Summary / Detail toggle tabs */}
      <div style={DETAIL_TABS_STYLE}>
        <button
          type="button"
          data-testid="standard-tab-summary"
          data-active={view === "summary" ? "true" : "false"}
          onClick={() => setView("summary")}
          style={detailTabStyle(view === "summary")}
          aria-pressed={view === "summary"}
        >
          Resumen
        </button>
        <button
          type="button"
          data-testid="standard-tab-detail"
          data-active={view === "detail" ? "true" : "false"}
          onClick={() => setView("detail")}
          style={detailTabStyle(view === "detail")}
          aria-pressed={view === "detail"}
        >
          Detalle
        </button>
      </div>

      {/* Content */}
      {view === "summary" ? (
        <ul style={SUMMARY_LIST_STYLE} aria-label="Resumen del estándar">
          {standard.summary.length > 0 ? (
            standard.summary.map((point, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: summary items have no stable key
                key={i}
                style={SUMMARY_ITEM_STYLE}
              >
                <span style={SUMMARY_BULLET_STYLE} aria-hidden="true">
                  ›
                </span>
                <span>{point}</span>
              </li>
            ))
          ) : (
            <li style={SUMMARY_ITEM_STYLE}>
              <span style={{ ...SUMMARY_ITEM_STYLE, opacity: 0.5, fontStyle: "italic" }}>
                Sin puntos clave — ver Detalle para el contenido completo.
              </span>
            </li>
          )}
        </ul>
      ) : (
        <div data-testid="standard-markdown-body" style={MARKDOWN_BODY_STYLE}>
          <Markdown>{standard.body}</Markdown>
        </div>
      )}
    </div>
  );
}

interface StandardItemProps {
  standard: Standard;
  isOpen: boolean;
  onToggle: () => void;
}

function StandardItem({ standard, isOpen, onToggle }: StandardItemProps): React.JSX.Element {
  return (
    <div>
      {/* Row button */}
      <button
        type="button"
        data-testid={`standard-item-${standard.id}`}
        onClick={onToggle}
        style={standardItemStyle(isOpen)}
        aria-expanded={isOpen}
      >
        {/* Title */}
        <span style={ITEM_TITLE_STYLE}>{standard.title}</span>

        {/* Badges */}
        <span style={BADGES_STYLE}>
          {/* Severity badge (AC-07-009.2) */}
          <span
            data-testid={`standard-severity-badge-${standard.id}`}
            data-severity={standard.severity}
            style={severityBadgeStyle(standard.severity)}
            title={`Severidad: ${standard.severity}`}
          >
            {standard.severity}
          </span>

          {/* Enforcement badge (AC-07-009.2) */}
          <span
            data-testid={`standard-enforcement-badge-${standard.id}`}
            data-enforcement={standard.enforcement}
            style={enforcementBadgeStyle()}
            title={`Aplicación: ${standard.enforcement}`}
          >
            {standard.enforcement}
          </span>
        </span>

        {/* Chevron */}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            fontSize: "0.75rem",
            opacity: 0.5,
            transition: `transform var(--duration-fast, 150ms) var(--easing-standard, ease)`,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ›
        </span>
      </button>

      {/* Detail panel — mounted only when open (AC-07-009.3) */}
      {isOpen && <DetailPanel standard={standard} />}
    </div>
  );
}

interface DomainGroupProps {
  domain: StandardDomain;
  standards: Standard[];
  openId: string | null;
  onToggle: (id: string) => void;
}

export function DomainGroup({
  domain,
  standards,
  openId,
  onToggle,
}: DomainGroupProps): React.JSX.Element {
  // Sanitize domain for data-testid (replace "/" with "-")
  const domainTestId = `standards-domain-${domain}`;

  return (
    <div data-testid={domainTestId} style={DOMAIN_GROUP_STYLE}>
      {/* Domain heading */}
      <h3 data-testid={`standards-domain-heading-${domain}`} style={DOMAIN_HEADING_STYLE}>
        {domain}
      </h3>

      {/* List of standards in this domain */}
      <div data-testid={`standards-list-items-${domain}`} style={LIST_STYLE}>
        {standards.map((std) => (
          <StandardItem
            key={std.id}
            standard={std}
            isOpen={openId === std.id}
            onToggle={() => onToggle(std.id)}
          />
        ))}
      </div>
    </div>
  );
}
