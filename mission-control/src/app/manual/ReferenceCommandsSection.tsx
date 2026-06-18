"use client";
/**
 * app/manual/ReferenceCommandsSection.tsx — WO-08-003 (CMP-08-reference-commands)
 *
 * Reference: commands catalog, derived from readSkills() via the FRD-07 reader.
 * DR-046 core: this component accepts `skills` as a prop (server-side reads by
 * page.tsx) — no hand-maintained catalog array exists here or in any Manual file.
 *
 * Each command row shows:
 *   - /pandacorp:<slug>  (the command name)
 *   - description        (from SKILL.md frontmatter)
 *   - CopyButton         (copy only, never executes — architecture §1)
 *   - runsIn badge       (factory/project, when known)
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish labels/aria-labels.
 *   - data-testid on the root and on every interactive/data element.
 *
 * Traceability:
 *   CMP-08-reference-commands → AC-08-003.1, AC-08-003.4, AC-08-003.5
 *   DR-046 → AC-08-003.3
 */

import type React from "react";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { SkillRef } from "@/lib/reference";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReferenceCommandsSectionProps {
  /**
   * Skills catalog derived from readSkills() at render time.
   * Passed down from the Server Component (page.tsx) — no fs access here.
   * DR-046: this prop IS the derivation; no static array allowed.
   */
  skills: SkillRef[];
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-base, 1rem)",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  margin: 0,
  marginBottom: "var(--space-base, 1rem)",
  color: "var(--color-text, currentColor)",
  borderBottom:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 15%, transparent)",
  paddingBottom: "calc(var(--space-base, 1rem) * 0.5)",
};

const LIST_STYLE: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
};

const ITEM_STYLE: React.CSSProperties = {
  padding: "calc(var(--space-base, 1rem) * 0.75) var(--space-base, 1rem)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "color-mix(in oklch, var(--color-text, currentColor) 5%, transparent)",
  border:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 10%, transparent)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
};

const NAME_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  flexWrap: "wrap",
};

const NAME_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.9375rem",
  fontFamily: "monospace",
  color: "var(--color-accent, currentColor)",
};

const DESC_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.8,
  margin: 0,
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "color-mix(in oklch, var(--color-accent, currentColor) 20%, transparent)",
  color: "var(--color-accent, currentColor)",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  fontStyle: "italic",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferenceCommandsSection({
  skills,
}: ReferenceCommandsSectionProps): React.JSX.Element {
  return (
    <div data-testid="reference-commands-section" style={SECTION_STYLE}>
      <h2 style={HEADING_STYLE}>Comandos (Habilidades)</h2>

      {skills.length === 0 ? (
        <p style={EMPTY_STYLE} data-testid="reference-commands-empty">
          No se encontraron habilidades en el plugin.
        </p>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de comandos del plugin">
          {skills.map((skill) => {
            const commandName = `/pandacorp:${skill.slug}`;
            return (
              <li
                key={skill.slug}
                style={ITEM_STYLE}
                data-testid={`reference-command-${skill.slug}`}
              >
                <div style={NAME_ROW_STYLE}>
                  {/* Command name — displayed as /pandacorp:<slug> */}
                  <span style={NAME_STYLE}>{commandName}</span>

                  {/* runsIn badge — shown when context is known (AC-08-003.5) */}
                  {skill.runsIn !== "unknown" && (
                    <span style={BADGE_STYLE} data-runs-in={skill.runsIn}>
                      {skill.runsIn}
                    </span>
                  )}

                  {/* CopyButton — copies the command string, never executes (AC-08-003.5) */}
                  <CopyButton value={commandName} />
                </div>

                {/* Description — from SKILL.md frontmatter (AC-08-003.1) */}
                <p style={DESC_STYLE}>{skill.description}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
