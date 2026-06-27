"use client";

/**
 * WO-13-007 — CmdRow (CMP-13-cmdrow)
 *
 * Mono command row (.cmd): inset on canvas, bd2 hairline, mono + tabular-nums,
 * with an optional CopyButton. THE command-chip primitive.
 *
 * Aliases: cmdRow, docCmd, CommandChip, CommandClip.
 *
 * Optional `modes` render an inline `<select>` (pinned right, before the copy
 * button, same height as it): the first option is "no flag" (the skill's default),
 * the rest each fold their flag into the displayed AND copied command — so the user
 * copies `/pandacorp:spec my-app --ask` in one click. A `<select>` (not a row of
 * pills) keeps the control compact no matter how many modes a command has. Commands
 * without `modes` render exactly as before.
 *
 * Prototype reference (re-anchor, DR-054):
 *   .cmd → background:var(--canvas); border:1px solid var(--bd2); border-radius:8px
 *   .cmd .t → font-family:var(--mono); font-size:13px; flex:1
 *
 * Tokens only. Light+dark first-class.
 * Traceability: CMP-13-cmdrow, AC-13-006.x, AC-02-010.9.
 */

import { useState } from "react";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A selectable flag the command can carry (e.g. `/pandacorp:spec` → `--ask`). */
export interface CmdRowMode {
  /** Flag folded into the command when active, e.g. "--ask" or "powerful". */
  flag: string;
  /** Human-readable option label, e.g. "ask" or "Potente". */
  label: string;
  /** One-line note shown below the row while this mode is selected. */
  hint?: string;
}

export interface CmdRowProps {
  /** The base command string to display and optionally copy. */
  command: string;
  /** If false, suppresses the CopyButton. Defaults to true. */
  copy?: boolean;
  /** When provided, renders an inline mode `<select>` before the copy button. */
  modes?: ReadonlyArray<CmdRowMode>;
  /** Label of the first "no flag" option — names the field and means "default". */
  modeDefaultLabel?: string;
  /** Note shown below the row when no mode is selected (only with `modes`). */
  modeHint?: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "var(--color-base, var(--color-panel))",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "9px 11px",
};

// With a mode select the command may wrap to a second line; pin the controls to the top.
const ROW_MODES_STYLE: React.CSSProperties = { ...ROW_STYLE, alignItems: "flex-start" };

const TEXT_BASE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "13px",
  flex: 1,
  minWidth: 0,
  userSelect: "all",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text)",
};

const TEXT_STYLE: React.CSSProperties = {
  ...TEXT_BASE,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// Modes variant: never ellipsize the flag away — wrap instead so the copied command is fully visible.
const TEXT_WRAP_STYLE: React.CSSProperties = {
  ...TEXT_BASE,
  whiteSpace: "normal",
  wordBreak: "break-word",
  paddingTop: "5px",
};

// Sized to match the CopyButton box (same border, radius, surface, height) so the row reads as one unit.
// CopyButton is 6px+13px+6px+2px border = 27px tall; mirror that exactly with box-sizing: border-box.
const SELECT_STYLE: React.CSSProperties = {
  flexShrink: 0,
  boxSizing: "border-box",
  height: "27px",
  maxWidth: "190px",
  padding: "0 8px",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "12px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  color: "var(--color-text)",
  cursor: "pointer",
};

const HINT_STYLE: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "0.6875rem",
  lineHeight: 1.45,
  color: "var(--color-text3)",
};

// ---------------------------------------------------------------------------
// CmdRow component
// ---------------------------------------------------------------------------

/**
 * CmdRow — mono command row with optional copy affordance and inline mode select.
 *
 * Usage:
 *   <CmdRow command="claude plugin update pandacorp@panda-corp" />
 *   <CmdRow command="/pandacorp:adopt" copy={false} />
 *   <CmdRow command="/pandacorp:spec my-app" modes={SPEC_MODES} modeDefaultLabel="preguntas: default" />
 */
export function CmdRow({
  command,
  copy = true,
  modes,
  modeDefaultLabel,
  modeHint,
}: CmdRowProps): React.JSX.Element {
  const [activeFlag, setActiveFlag] = useState<string>("");
  const hasModes = modes !== undefined && modes.length > 0;
  const displayCommand = activeFlag !== "" ? `${command} ${activeFlag}` : command;

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setActiveFlag(event.target.value);
  };

  const row = (
    <div data-testid="cmd-row" style={hasModes ? ROW_MODES_STYLE : ROW_STYLE}>
      {/* Leading terminal glyph (prototype `.cmd` → `ti-terminal-2`) */}
      <i
        className="ti ti-terminal-2"
        aria-hidden="true"
        style={{ fontSize: "15px", color: "var(--color-text2)", lineHeight: 1, flexShrink: 0 }}
      />
      <span style={hasModes ? TEXT_WRAP_STYLE : TEXT_STYLE}>{displayCommand}</span>
      {hasModes && (
        <select
          aria-label="Modo del comando"
          value={activeFlag}
          onChange={handleModeChange}
          style={SELECT_STYLE}
        >
          <option value="">{modeDefaultLabel ?? "sin flag"}</option>
          {modes.map((mode) => (
            <option key={mode.flag} value={mode.flag}>
              {mode.label}
            </option>
          ))}
        </select>
      )}
      {copy && <CopyButton value={displayCommand} />}
    </div>
  );

  if (!hasModes) return row;

  const activeMode = activeFlag !== "" ? modes.find((mode) => mode.flag === activeFlag) : undefined;
  const hint = activeMode?.hint ?? modeHint;

  return (
    <div>
      {row}
      {hint !== undefined && hint !== "" && (
        <p data-testid="cmd-row-hint" style={HINT_STYLE}>
          {hint}
        </p>
      )}
    </div>
  );
}
