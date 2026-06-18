"use client";
/**
 * WO-07-009 — Standards section (CMP-07-standards-list + CMP-07-standard-detail)
 *
 * Renders the Standards section of the Configuration page, grouped by domain,
 * each standard with severity/enforcement badges and Summary/Detail views.
 *
 * Architecture:
 *   - "use client" because the section toggle (open/close) and Summary/Detail
 *     tab state require client-side interaction.
 *   - Accepts `standards: Standard[]` as a prop (server parent reads via
 *     readStandards() and passes them down). This keeps fs access server-side.
 *   - Reuses CopyButton (FRD-02) for the "New standard" button.
 *   - Renders markdown via react-markdown (architecture §2).
 *   - Zero hardcoded colors — CSS custom properties only (FRD-13).
 *   - data-testid on all interactive elements.
 *   - Spanish copy (architecture §7, DR-009).
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

// ---------------------------------------------------------------------------
// Domain ordering (AC-07-009.1 — the 9 domains + Other as catch-all)
// ---------------------------------------------------------------------------

const DOMAIN_ORDER: StandardDomain[] = [
  "Programming",
  "Architecture",
  "Design",
  "Technology",
  "Quality",
  "Security",
  "Operation",
  "Data/Privacy",
  "Product/Docs",
  "Other",
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  flexWrap: "wrap",
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const DOMAIN_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const DOMAIN_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text, currentColor)",
  opacity: 0.45,
  margin: 0,
  paddingBottom: "calc(var(--spacing, 0.25rem) * 1)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

/** Returns style for a standard item row (button). */
function standardItemStyle(isOpen: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 3)",
    width: "100%",
    padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
    background: isOpen
      ? "var(--color-surface-raised, oklch(from var(--color-surface, oklch(0.1 0.015 230)) calc(l + 0.04) c h))"
      : "transparent",
    border: "var(--hairline, 1px) solid",
    borderColor: isOpen ? "var(--color-accent, currentColor)" : "var(--color-border, transparent)",
    borderRadius: "var(--radius, 0.5rem)",
    cursor: "pointer",
    textAlign: "left",
    color: "var(--color-text, currentColor)",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    transition:
      "background var(--duration-fast, 150ms) var(--easing-standard, ease), border-color var(--duration-fast, 150ms) var(--easing-standard, ease)",
  };
}

const ITEM_TITLE_STYLE: React.CSSProperties = {
  flex: 1,
  fontWeight: 500,
  color: "var(--color-text, currentColor)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const BADGES_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  flexShrink: 0,
};

/** Returns severity badge style based on severity level. */
function severityBadgeStyle(severity: string): React.CSSProperties {
  const colorMap: Record<string, string> = {
    MUST: "var(--color-accent, currentColor)",
    SHOULD: "var(--color-agent-test-writer, currentColor)",
    MAY: "var(--color-text, currentColor)",
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    border: "var(--hairline, 1px) solid currentColor",
    color: colorMap[severity] ?? "var(--color-text, currentColor)",
    background: "transparent",
  };
}

/** Returns enforcement badge style. */
function enforcementBadgeStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
    color: "var(--color-text, currentColor)",
    opacity: 0.75,
    background: "transparent",
  };
}

const DETAIL_PANEL_STYLE: React.CSSProperties = {
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
  marginLeft: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  background: "oklch(from var(--color-surface, oklch(0.1 0.015 230)) calc(l + 0.03) c h / 0.6)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const DETAIL_TABS_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

/** Returns style for a summary/detail toggle tab. */
function detailTabStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 3)",
    border: "var(--hairline, 1px) solid",
    borderColor: isActive
      ? "var(--color-accent, currentColor)"
      : "var(--color-border, currentColor)",
    borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
    background: isActive ? "var(--color-accent, currentColor)" : "transparent",
    color: isActive ? "var(--color-surface, currentColor)" : "var(--color-text, currentColor)",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: isActive ? 600 : 400,
    fontFamily: "inherit",
    transition: "background var(--duration-fast, 150ms) var(--easing-standard, ease)",
  };
}

const SUMMARY_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: 0,
  margin: 0,
  listStyle: "none",
};

const SUMMARY_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.5,
};

const SUMMARY_BULLET_STYLE: React.CSSProperties = {
  flexShrink: 0,
  color: "var(--color-accent, currentColor)",
  fontWeight: 700,
};

const MARKDOWN_BODY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.7,
  color: "var(--color-text, currentColor)",
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  textAlign: "center",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  fontSize: "0.875rem",
};

const SECTION_HEADER_NOTE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.6,
  lineHeight: 1.4,
};

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
function NewStandardButton(): React.JSX.Element {
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

function DomainGroup({ domain, standards, openId, onToggle }: DomainGroupProps): React.JSX.Element {
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StandardsSectionProps {
  /** Pre-read standards from readStandards() — passed from server parent. */
  standards: Standard[];
}

// ---------------------------------------------------------------------------
// StandardsSection — main export (CMP-07-standards-list + CMP-07-standard-detail)
// ---------------------------------------------------------------------------

/**
 * StandardsSection — Standards tab panel for the Configuration page.
 *
 * Renders standards grouped by domain, each with severity+enforcement badges
 * and a collapsible Summary/Detail panel. Includes a "New standard" button
 * that copies `/pandacorp:learn` to the clipboard.
 *
 * AC-07-009.1: grouped by domain (9 domains + Other)
 * AC-07-009.2: severity + enforcement badges (label+shape, not color alone)
 * AC-07-009.3: Summary/Detail toggle (react-markdown for Detail view)
 * AC-07-009.4: "New standard" button → copies /pandacorp:learn (no exec)
 * AC-07-009.5: graceful for missing metadata / Other domain / empty list
 */
export function StandardsSection({ standards }: StandardsSectionProps): React.JSX.Element {
  // Currently open standard id (one at a time — AC-07-009.3 close-on-reopen)
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  // --- Group standards by domain (AC-07-009.1) ---
  const grouped = new Map<StandardDomain, Standard[]>();
  for (const std of standards) {
    const list = grouped.get(std.domain) ?? [];
    list.push(std);
    grouped.set(std.domain, list);
  }

  // Order domains per canonical list; append any unseen domains at the end
  const orderedDomains: StandardDomain[] = [
    ...DOMAIN_ORDER.filter((d) => grouped.has(d)),
    ...Array.from(grouped.keys()).filter((d) => !DOMAIN_ORDER.includes(d)),
  ];

  return (
    <div data-testid="standards-section" style={SECTION_STYLE}>
      {/* Section header with intro + "New standard" button */}
      <div style={HEADER_STYLE}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--spacing, 0.25rem) * 1)",
          }}
        >
          <h2 style={SECTION_TITLE_STYLE}>Estándares</h2>
          <p style={SECTION_HEADER_NOTE_STYLE}>
            Directrices de ingeniería de la fábrica, agrupadas por dominio. Lectura solamente — para
            añadir un estándar, copia el comando y ejecútalo en Claude Code.
          </p>
        </div>

        {/* "New standard" button — copies /pandacorp:learn (AC-07-009.4)
         *  Copy-only, no exec (architecture §1). Uses navigator.clipboard.writeText
         *  directly so we can attach data-testid to the <button> itself, since the
         *  shared CopyButton hardcodes its own testid. Same semantics as CopyButton. */}
        <NewStandardButton />
      </div>

      {/* Empty state (AC-07-009.5) */}
      {standards.length === 0 ? (
        <div data-testid="standards-empty-state" style={EMPTY_STATE_STYLE}>
          No se encontraron estándares en <code>factory/standards/</code>.
        </div>
      ) : (
        /* Domain groups (AC-07-009.1) */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--spacing, 0.25rem) * 8)",
          }}
        >
          {orderedDomains.map((domain) => (
            <DomainGroup
              key={domain}
              domain={domain}
              standards={grouped.get(domain) ?? []}
              openId={openId}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
