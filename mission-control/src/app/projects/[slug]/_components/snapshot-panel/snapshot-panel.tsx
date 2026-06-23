/**
 * WO-14-002 — SnapshotPanel (CMP-14-snapshot-panel)
 *
 * Server Component: renders the FRD-14 snapshot panel inside the FRD-04
 * workspace "Resumen" tab. Shows the last build commit that passed all gates
 * ("última versión verificada · segura para probar"), a "building now" notice
 * when a work order is in progress, and a staleness warning when the snapshot
 * is far behind HEAD.
 *
 * Primitives (DR-057 — reuse before create):
 *   - Panel     → the app-wide surface wrapper
 *   - Chip      → status signal: tone="ok" when safeToTest=true, tone="warn" when safeToTest=false
 *   - CmdRow    → the worktree command row with copy button
 *   - Banner    → staleness warning (tone="warn")
 *
 * Design rules (DR-054/055/056):
 *   - ZERO hardcoded colors — CSS custom properties only (tokens).
 *   - data-testid on every significant element.
 *   - Spanish UI copy per the re-anchored FDD (2026-06-19).
 *   - Server Component (no "use client"); Banner/CopyButton are their own client islands.
 *   - Warn state carried by icon + text (not color alone) — a11y.
 *   - tabular-nums on the SHA.
 *
 * Visual reference:
 *   docs/design/prototype/index.html → snapshotPanel(i) (~L867) + bStalenessPanel(i) (~L876)
 *
 * Traceability:
 *   CMP-14-snapshot-panel → REQ-14-001, REQ-14-002, REQ-14-003
 *   AC-14-001.1 — green heading + Chip + sha + muted detail line
 *   AC-14-001.2 — worktree command in CmdRow with copy button
 *   AC-14-001.3 — absent snapshot → panel omitted entirely
 *   AC-14-002.1 — building-now block (visually distinct; canonical copy)
 *   AC-14-003.1 — staleness warning on shared Banner (tone="warn")
 *   IF-14-snapshot (lib/snapshot.ts, WO-14-001)
 */

import { Banner } from "@/components/core/Banner/Banner";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Panel } from "@/components/core/Panel/Panel";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SnapshotPanelProps {
  /**
   * The project slug — used to distinguish this panel in the layout;
   * the worktree command itself is already pre-built in snapshot.worktreeCommand.
   */
  slug: string;
  /**
   * Pre-built snapshot info from buildSnapshot() (WO-14-001).
   * null when last_green_sha is absent → panel is omitted entirely (AC-14-001.3).
   */
  snapshot: SnapshotInfo | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (no hardcoded colors / spacing)
// ---------------------------------------------------------------------------

/** Row: left icon + body (mirrors prototype flex layout). */
const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
};

/** Icon column — ti-circle-check in var(--color-ok). */
const CHECK_ICON_STYLE: React.CSSProperties = {
  fontSize: "18px",
  color: "var(--color-ok)",
  marginTop: "1px",
  flexShrink: 0,
};

/** Flexible body column. */
const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

/** Main heading line: "Última versión verificada · segura para probar". */
const HEADING_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
};

/**
 * Muted detail line: "commit <sha> — pasó todos los gates. Pruébalo en un worktree aparte sin
 * parar el build."
 */
const DETAIL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text2))",
  marginTop: "2px",
};

/** Inline SHA code chip (var(--color-panel) background as in prototype). */
const SHA_CODE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  background: "var(--color-panel, var(--color-card))",
  padding: "1px 5px",
  borderRadius: "4px",
  fontVariantNumeric: "tabular-nums",
};

/** Building-now line: hammer icon + progress text. */
const BUILDING_NOW_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
  marginTop: "6px",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  flexWrap: "wrap",
};

/** Hammer icon in var(--color-accent) for the "building now" signal. */
const HAMMER_ICON_STYLE: React.CSSProperties = {
  fontSize: "13px",
  verticalAlign: "-2px",
  color: "var(--color-accent)",
  flexShrink: 0,
};

/** Wrapper for the CmdRow — top-margin matches prototype. */
const CMD_ROW_WRAPPER_STYLE: React.CSSProperties = {
  marginTop: "10px",
};

// ---------------------------------------------------------------------------
// SnapshotPanel — CMP-14-snapshot-panel
// ---------------------------------------------------------------------------

/**
 * CMP-14-snapshot-panel — snapshot panel for the FRD-04 workspace.
 *
 * Renders only when snapshot is non-null (AC-14-001.3).
 * Server Component (no "use client"). Banner and CopyButton are client islands.
 *
 * Layout (per prototype snapshotPanel + bStalenessPanel):
 *   1. Panel (shared primitive) wrapping:
 *      a. flex row: ti-circle-check icon + body
 *         body: heading + Chip (ok|warn per safeToTest) + sha muted line + optional building-now
 *      b. CmdRow (shared primitive) — the git worktree add command
 *   2. Optional Banner (shared primitive, tone="warn") — staleness warning
 */
export function SnapshotPanel({ snapshot }: SnapshotPanelProps): React.JSX.Element | null {
  // AC-14-001.3 — absent snapshot → omit panel entirely
  if (snapshot === null) {
    return null;
  }

  const { sha, safeToTest, worktreeCommand, buildingNow, stale } = snapshot;

  // AC-14-001.1 — reads BOTH last_green_sha AND safe_to_test.
  // When safeToTest=false (HEAD has moved past the last green SHA), do NOT claim
  // "seguro para probar" — that would mislead the operator (lib/snapshot.ts comment:
  // "fail-safe: don't mislead the user"). Show a warn chip instead.
  const isGreenAndSafe = safeToTest === true;

  return (
    <section
      data-testid="snapshot-panel"
      aria-label={
        isGreenAndSafe
          ? "Última versión verificada — segura para probar"
          : "Última versión verificada — HEAD avanzó, no es el punto seguro actual"
      }
      style={{ marginBottom: "12px" }}
    >
      {/* Main panel — Panel primitive (DR-057) */}
      <Panel>
        {/* Row: left check icon + body */}
        <div style={ROW_STYLE}>
          {/* ti-circle-check in var(--color-ok) — state carried by icon + text */}
          <i className="ti ti-circle-check" style={CHECK_ICON_STYLE} aria-hidden="true" />

          {/* Body column */}
          <div data-testid="snapshot-panel-green-section" style={BODY_STYLE}>
            {/* Heading + status Chip (AC-14-001.1) */}
            <p style={HEADING_STYLE}>
              {isGreenAndSafe
                ? "Última versión verificada · segura para probar"
                : "Última versión verificada"}{" "}
              {/*
               * Chip (shared primitive, DR-057):
               *   - safeToTest=true  → tone="ok" "verificada" (passed all gates — safe to test)
               *   - safeToTest=false → tone="warn" "aún no seguro" (HEAD advanced past the verified SHA)
               */}
              {isGreenAndSafe ? (
                <Chip tone="ok">verificada</Chip>
              ) : (
                <Chip tone="warn">aún no seguro</Chip>
              )}
            </p>

            {/* Muted detail: commit sha — pasó todos los gates (AC-14-001.1) */}
            <p style={DETAIL_STYLE}>
              commit{" "}
              <code
                data-testid="snapshot-panel-sha"
                className="tabular-nums"
                style={SHA_CODE_STYLE}
              >
                {sha}
              </code>{" "}
              — pasó todos los gates. Pruébalo en un worktree aparte sin parar el build.
            </p>

            {/* Building-now block (AC-14-002.1) — only when running */}
            {buildingNow !== undefined && (
              <div data-testid="snapshot-panel-building-now" style={BUILDING_NOW_STYLE}>
                {/* ti-hammer in var(--color-accent) — visually distinct from the green section */}
                <i className="ti ti-hammer" style={HAMMER_ICON_STYLE} aria-hidden="true" />
                {/* "El build sigue avanzando: <progress> · eso aún no está verificado, no lo pruebes" */}
                El build sigue avanzando: <b style={{ fontWeight: 500 }}>{buildingNow}</b>
                {" · "}
                eso aún no está verificado, no lo pruebes
              </div>
            )}
          </div>
        </div>

        {/* CmdRow (shared primitive, DR-057) — worktree command (AC-14-001.2) */}
        <div style={CMD_ROW_WRAPPER_STYLE}>
          <CmdRow command={worktreeCommand} />
        </div>
      </Panel>

      {/* Staleness warning — shared Banner (tone="warn", DR-057) — AC-14-003.1 */}
      {stale && (
        <div style={{ marginTop: "8px" }}>
          <Banner
            tone="warn"
            heading="La última versión verificada quedó atrás del build"
            detail="Lo que pruebes ahí ya no refleja lo que el build lleva construido."
          />
        </div>
      )}
    </section>
  );
}
