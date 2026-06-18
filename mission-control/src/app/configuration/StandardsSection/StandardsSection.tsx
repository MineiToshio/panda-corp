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
 * Internal pieces are split into siblings to keep each file ≤500 lines
 * (clean-code): styles + helpers in `./styles`, sub-components in `./parts`.
 *
 * Traceability:
 *   CMP-07-standards-list → AC-07-009.1 (domain grouping)
 *   CMP-07-standards-list → AC-07-009.2 (severity + enforcement badges)
 *   CMP-07-standard-detail → AC-07-009.3 (Summary / Detail toggle)
 *   AC-07-009.4 ("New standard" copies /pandacorp:learn)
 *   AC-07-009.5 (graceful fallback for missing metadata)
 */

import type React from "react";
import { useState } from "react";
import type { Standard, StandardDomain } from "@/lib/standards/standards";
import { DomainGroup, NewStandardButton } from "./parts";
import {
  DOMAIN_ORDER,
  EMPTY_STATE_STYLE,
  HEADER_STYLE,
  SECTION_HEADER_NOTE_STYLE,
  SECTION_STYLE,
  SECTION_TITLE_STYLE,
} from "./styles";

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
