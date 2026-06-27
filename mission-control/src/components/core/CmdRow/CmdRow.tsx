"use client";

/**
 * WO-13-007 — CmdRow (CMP-13-cmdrow)
 *
 * Mono command row (.cmd): inset on canvas, bd2 hairline, mono + tabular-nums,
 * with an optional CopyButton. THE command-chip primitive.
 *
 * Aliases: cmdRow, docCmd, CommandChip, CommandClip.
 *
 * Optional `modes` render an inline segmented selector (pinned right, before the
 * copy button): picking a mode folds its flag into the displayed AND copied
 * command, so the user copies `/pandacorp:spec my-app --ask` in one click. Picking
 * the active mode again clears it (back to the base command). Commands without
 * `modes` render exactly as before.
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
  /** Flag folded into the command when active, e.g. "--ask". */
  flag: string;
  /** Short pill label, e.g. "ask". */
  label: string;
  /** One-line note shown below the row while this mode is selected. */
  hint?: string;
}

export interface CmdRowProps {
  /** The base command string to display and optionally copy. */
  command: string;
  /** If false, suppresses the CopyButton. Defaults to true. */
  copy?: boolean;
  /** When provided, renders an inline mode selector before the copy button. */
  modes?: ReadonlyArray<CmdRowMode>;
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

// With modes the command may wrap to a second line; pin the controls to the top.
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
  paddingTop: "4px",
};

const SEGMENT_STYLE: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid var(--color-border)",
  borderRadius: "999px",
  overflow: "hidden",
  flexShrink: 0,
};

const HINT_STYLE: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "0.6875rem",
  lineHeight: 1.45,
  color: "var(--color-text3)",
};

function pillStyle(isActive: boolean, hasDivider: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "11px",
    lineHeight: 1,
    padding: "5px 11px",
    border: 0,
    borderRight: hasDivider ? "1px solid var(--color-border)" : "0",
    background: isActive ? "var(--color-accent-bg)" : "transparent",
    color: isActive ? "var(--color-accent-text)" : "var(--color-text3)",
    cursor: "pointer",
  };
}

// ---------------------------------------------------------------------------
// CmdRow component
// ---------------------------------------------------------------------------

/**
 * CmdRow — mono command row with optional copy affordance and inline mode selector.
 *
 * Usage:
 *   <CmdRow command="claude plugin update pandacorp@panda-corp" />
 *   <CmdRow command="/pandacorp:adopt" copy={false} />
 *   <CmdRow command="/pandacorp:spec my-app" modes={SPEC_MODES} modeHint="…" />
 */
export function CmdRow({ command, copy = true, modes, modeHint }: CmdRowProps): React.JSX.Element {
  const [activeFlag, setActiveFlag] = useState<string | null>(null);
  const hasModes = modes !== undefined && modes.length > 0;
  const displayCommand = activeFlag !== null ? `${command} ${activeFlag}` : command;

  const handlePillClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const { flag } = event.currentTarget.dataset;
    if (flag === undefined) return;
    setActiveFlag((current) => (current === flag ? null : flag));
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
        <fieldset
          aria-label="Modo del comando"
          style={{ ...SEGMENT_STYLE, margin: 0, padding: 0, minInlineSize: 0 }}
        >
          {modes.map((mode, index) => {
            const isActive = mode.flag === activeFlag;
            return (
              <button
                key={mode.flag}
                type="button"
                data-flag={mode.flag}
                aria-pressed={isActive}
                onClick={handlePillClick}
                style={pillStyle(isActive, index < modes.length - 1)}
              >
                {mode.label}
              </button>
            );
          })}
        </fieldset>
      )}
      {copy && <CopyButton value={displayCommand} />}
    </div>
  );

  if (!hasModes) return row;

  const activeMode =
    activeFlag !== null ? modes.find((mode) => mode.flag === activeFlag) : undefined;
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
