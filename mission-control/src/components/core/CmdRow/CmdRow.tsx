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

import { Fragment, useId, useState } from "react";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import styles from "./CmdRow.module.css";

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
  /** Optional container hue. */
  tone?: import("@/components/core/Chip/vocabulary").Tone;
  /** Token-based command box presentation; omitted for the compact row. */
  variant?: "box";
  /** Accessible name of the copy action. */
  copyLabel?: string;
  /** Reports whether the clipboard write succeeded. */
  onCopyResult?: (copied: boolean) => void;
  /** If false, suppresses the CopyButton. Defaults to true. */
  copy?: boolean;
  /** When provided, renders an inline mode `<select>` before the copy button. */
  modes?: ReadonlyArray<CmdRowMode>;
  /** Label of the first "no flag" option — names the field and means "default". */
  modeDefaultLabel?: string;
  /** Hover tooltip on the select naming the field (e.g. "Modo de construcción"). */
  modeTitle?: string;
  /** Note shown below the row when no mode is selected (only with `modes`). */
  modeHint?: string;
  /** Controlled selected flag ("" = no flag). When set, the parent owns the value (e.g. to persist it). */
  modeValue?: string;
  /** Called with the chosen flag when the select changes (controlled or uncontrolled). */
  onModeChange?: (flag: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--command-gap, 10px)",
  background: "var(--command-bg, var(--bg-2))",
  border: "var(--hairline) solid var(--command-line, var(--line))",
  borderRadius: "var(--command-radius, var(--r))",
  padding: "var(--command-padding, var(--s1) var(--s1) var(--s1) var(--s3))",
  minHeight: "var(--command-height, 44px)",
};

const BOX_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--s2) + var(--s1) / 2)",
  minHeight: "calc(var(--s10) + var(--s1))",
  minWidth: 0,
  padding: "var(--s1) var(--s1) var(--s1) var(--s3)",
  borderRadius: "var(--r)",
  background: "var(--command-bg, var(--bg-2))",
  border: "var(--hairline) solid color-mix(in srgb, var(--tone, var(--violet)) 22%, var(--line))",
};
const BOX_TEXT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--command-font-size, var(--fs-sm))",
  lineHeight: 1.4,
  padding: "calc(var(--s3) / 2) 0",
  overflowWrap: "normal",
  overflowX: "auto",
  wordBreak: "normal",
  whiteSpace: "normal",
};

// With a mode select the command may wrap to a second line; pin the controls to the top.
const ROW_MODES_STYLE: React.CSSProperties = { ...ROW_STYLE, alignItems: "flex-start" };

const TEXT_BASE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "var(--command-font-size, var(--fs-sm))",
  flex: 1,
  minWidth: 0,
  userSelect: "all",
  fontVariantNumeric: "tabular-nums",
  color: "var(--text)",
};

// A narrow row wraps instead of hiding the command's arguments behind an ellipsis.
const TEXT_STYLE: React.CSSProperties = {
  ...TEXT_BASE,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
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
  height: "var(--command-copy-height, 27px)",
  maxWidth: "190px",
  padding: "0 8px",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "var(--fs-xs)",
  borderRadius: "var(--r)",
  border: "var(--hairline) solid var(--command-line, var(--line))",
  background: "var(--surface-2)",
  color: "var(--text)",
  cursor: "pointer",
};

const HINT_STYLE: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "var(--fs-xs)",
  lineHeight: 1.45,
  color: "var(--text-3)",
};

// Custom tooltip — anchors the select so the tip can sit ABOVE it (vs the native `title`,
// which is delayed, browser-positioned and unbounded in width).
const TOOLTIP_WRAP_STYLE: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
};

// Above the select (bottom edge anchored to its top), right-aligned so it never overflows
// the row's right edge; bounded width with multi-line wrap. Shown instantly on hover/focus.
const TOOLTIP_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  right: 0,
  zIndex: 30,
  width: "max-content",
  maxWidth: "240px",
  padding: "6px 9px",
  borderRadius: "var(--r)",
  border: "var(--hairline) solid var(--command-line, var(--line))",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "var(--fs-xs)",
  lineHeight: 1.4,
  whiteSpace: "normal",
  boxShadow: "var(--shadow)",
  pointerEvents: "none",
};

function CommandFrame({
  variant,
  tone,
  hasModes,
  command,
  children,
}: {
  readonly variant?: "box";
  readonly tone?: import("@/components/core/Chip/vocabulary").Tone;
  readonly hasModes: boolean;
  readonly command: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-testid="cmd-row"
      className={`cmd ${styles.command}`}
      data-tone={tone}
      style={{
        ...(variant === "box" ? BOX_STYLE : hasModes ? ROW_MODES_STYLE : ROW_STYLE),
        ...(tone ? { background: "color-mix(in srgb, var(--tone) 5%, var(--surface))" } : {}),
      }}
    >
      <Icon name="terminal" />
      {variant === "box" ? (
        <code style={BOX_TEXT_STYLE}>
          {Array.from(command.matchAll(/[^:\s]+|:|\s+/g), (match) => (
            <Fragment key={match.index}>
              {match[0].includes("-") ? (
                <span style={{ whiteSpace: "nowrap" }}>{match[0]}</span>
              ) : (
                match[0]
              )}
              {match[0] === ":" ? <wbr /> : null}
            </Fragment>
          ))}
        </code>
      ) : (
        <span style={hasModes ? TEXT_WRAP_STYLE : TEXT_STYLE}>{command}</span>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CmdRow component
// ---------------------------------------------------------------------------

/**
 * CmdRow — mono command row with optional copy affordance and inline mode select.
 *
 * Usage:
 *   <CmdRow command="claude plugin update pandacorp@panda-corp" />
 *   <CmdRow command="/pandacorp:adopt" copy={false} />
 *   <CmdRow command="/pandacorp:spec my-app" modes={SPEC_MODES} modeDefaultLabel="default" modeTitle="…" />
 */
export function CmdRow({
  command,
  variant,
  tone,
  copyLabel,
  onCopyResult,
  copy = true,
  modes,
  modeDefaultLabel,
  modeTitle,
  modeHint,
  modeValue,
  onModeChange,
}: CmdRowProps): React.JSX.Element {
  const [internalFlag, setInternalFlag] = useState<string>("");
  const [tipOpen, setTipOpen] = useState(false);
  const tipId = useId();
  const isControlled = modeValue !== undefined;
  const activeFlag = isControlled ? modeValue : internalFlag;
  const hasModes = modes !== undefined && modes.length > 0;
  const hasTip = modeTitle !== undefined && modeTitle !== "";
  const displayCommand = activeFlag !== "" ? `${command} ${activeFlag}` : command;

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const next = event.target.value;
    onModeChange?.(next);
    if (!isControlled) setInternalFlag(next);
  };

  const handleTipShow = (): void => setTipOpen(true);
  const handleTipHide = (): void => setTipOpen(false);

  const row = (
    <CommandFrame variant={variant} tone={tone} hasModes={hasModes} command={displayCommand}>
      {hasModes && (
        <span style={TOOLTIP_WRAP_STYLE}>
          <select
            aria-label="Modo del comando"
            aria-describedby={hasTip ? tipId : undefined}
            value={activeFlag}
            onChange={handleModeChange}
            onMouseEnter={handleTipShow}
            onMouseLeave={handleTipHide}
            onFocus={handleTipShow}
            onBlur={handleTipHide}
            style={SELECT_STYLE}
          >
            <option value="">{modeDefaultLabel ?? "sin flag"}</option>
            {modes.map((mode) => (
              <option key={mode.flag} value={mode.flag}>
                {mode.label}
              </option>
            ))}
          </select>
          {hasTip && tipOpen && (
            <span role="tooltip" id={tipId} style={TOOLTIP_STYLE}>
              {modeTitle}
            </span>
          )}
        </span>
      )}
      {copy && (
        <CopyButton
          value={displayCommand}
          accessibleLabel={copyLabel ?? t("common.copy.command", { command: displayCommand })}
          onResult={onCopyResult}
          variant={variant}
        />
      )}
    </CommandFrame>
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

/** Compact list-row command, sharing display, mode selection and clipboard behavior with CmdRow. */
export function CommandCompact(props: Omit<CmdRowProps, "variant">): React.JSX.Element {
  return (
    <div className={`ask-cmd ${styles.compact}`}>
      <CmdRow {...props} />
    </div>
  );
}
