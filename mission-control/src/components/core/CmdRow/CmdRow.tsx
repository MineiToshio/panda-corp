/**
 * WO-13-007 — CmdRow (CMP-13-cmdrow)
 *
 * Mono command row (.cmd): inset on canvas, bd2 hairline, mono + tabular-nums,
 * with an optional CopyButton. THE command-chip primitive.
 *
 * Aliases: cmdRow, docCmd, CommandChip, CommandClip.
 *
 * Prototype reference (re-anchor, DR-054):
 *   .cmd → background:var(--canvas); border:1px solid var(--bd2); border-radius:8px
 *   .cmd .t → font-family:var(--mono); font-size:13px; flex:1
 *
 * Tokens only. Light+dark first-class.
 * Traceability: CMP-13-cmdrow, AC-13-006.x.
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CmdRowProps {
  /** The command string to display and optionally copy. */
  command: string;
  /** If false, suppresses the CopyButton. Defaults to true. */
  copy?: boolean;
}

// ---------------------------------------------------------------------------
// CmdRow component
// ---------------------------------------------------------------------------

/**
 * CmdRow — mono command row with optional copy affordance.
 *
 * Usage:
 *   <CmdRow command="claude plugin update pandacorp@panda-corp" />
 *   <CmdRow command="/pandacorp:adopt" copy={false} />
 */
export function CmdRow({ command, copy = true }: CmdRowProps): React.JSX.Element {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "var(--color-base, var(--color-panel))",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "var(--radius-sm, 8px)",
    padding: "9px 11px",
  };

  const textStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "13px",
    flex: 1,
    userSelect: "all" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-text)",
  };

  return (
    <div data-testid="cmd-row" style={style}>
      <span style={textStyle}>{command}</span>
      {copy && <CopyButton value={command} label="Copiar" />}
    </div>
  );
}
