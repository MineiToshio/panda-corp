/**
 * WO-01-008 — Onboarding gate (UI) — CMP-01-onboarding-gate
 *
 * Traceability:
 *   REQ-01-001 → AC-01-001.1
 *   Consumed by app/layout.tsx (Server Component guard)
 *   Depends on: WO-01-002 (readProfile), WO-02-002 (CopyButton)
 *
 * Rendered when readProfile() returns { present: false }.
 * It is the ENTIRE view — nothing else renders behind it.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - Spanish copy (DR-009, single operator).
 *   - data-testid on every significant element.
 *   - aria-label in Spanish.
 *   - Server Component safe — no hooks, no browser APIs.
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; no hardcoded color values.
// Fallbacks use system semantic values so the component renders before
// design tokens are frozen (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

const GATE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  fontFamily: "inherit",
};

const CARD_STYLE: React.CSSProperties = {
  // Elevation level 1: panel above canvas.
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  boxShadow: "var(--shadow-panel, none)",
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  maxWidth: "36rem",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  lineHeight: 1.3,
  margin: 0,
  color: "var(--color-text, currentColor)",
};

const DESCRIPTION_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.6,
  margin: 0,
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.8,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface-code, color-mix(in oklch, currentColor 5%, transparent))",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const CODE_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  fontSize: "0.875rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--color-accent, var(--color-text, currentColor))",
  flex: 1,
  minWidth: 0,
};

const HINT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.65,
  lineHeight: 1.5,
  margin: 0,
};

// ---------------------------------------------------------------------------
// The onboarding command (single source of truth inside this component)
// ---------------------------------------------------------------------------

const ONBOARDING_COMMAND = "/pandacorp:onboarding";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-screen gate shown when factory/profile.md is absent (AC-01-001.1).
 * Server Component safe — no hooks, no browser APIs.
 *
 * Uses CopyButton (WO-02-002) for the clipboard affordance so the shared
 * contract is respected. The CopyButton is a Client Component; Next.js
 * composes them transparently from a Server Component parent.
 */
export function OnboardingGate(): React.JSX.Element {
  return (
    <main
      data-testid="onboarding-gate"
      style={GATE_STYLE}
      aria-label="Configuración inicial de la fábrica requerida"
    >
      <div style={CARD_STYLE}>
        {/* Heading */}
        <h1 data-testid="onboarding-gate-heading" style={HEADING_STYLE}>
          La fábrica aún no está configurada
        </h1>

        {/* Description */}
        <p data-testid="onboarding-gate-description" style={DESCRIPTION_STYLE}>
          No se encontró{" "}
          <code
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
              fontSize: "0.8125em",
            }}
          >
            factory/profile.md
          </code>
          . Ejecuta el comando de configuración en tu terminal para personalizar la fábrica con tu
          nombre, metas e intereses antes de continuar.
        </p>

        {/* Command row: code + copy button */}
        <div style={COMMAND_ROW_STYLE}>
          <code data-testid="onboarding-gate-command" style={CODE_STYLE}>
            {ONBOARDING_COMMAND}
          </code>

          {/* CopyButton (WO-02-002) — data-testid="copy-button" is set internally */}
          <CopyButton value={ONBOARDING_COMMAND} label="Copiar" />
        </div>

        {/* Hint */}
        <p style={HINT_STYLE}>
          Una vez que el perfil exista, recarga esta página y la fábrica estará lista.
        </p>
      </div>
    </main>
  );
}
