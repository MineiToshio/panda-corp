/**
 * manual-diagrams/prose.tsx — FRD-08 Manual prose atoms
 *
 * Small typographic helpers used by the Manual page components to reproduce the
 * prototype's paragraph / lead / note-panel / numbered-step look without raw
 * markdown. Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-readers (prose atoms).
 */

import type React from "react";
import { Panel } from "@/components/core/Panel/Panel";

/** A lead paragraph (the muted intro under a heading). */
export function Lead({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p
      style={{ fontSize: "13px", color: "var(--color-text2)", margin: "0 0 14px", lineHeight: 1.6 }}
    >
      {children}
    </p>
  );
}

/** A body paragraph inside a Panel (15px text, tighter color). */
export function Body({
  children,
  size = "14px",
  margin = "0 0 12px",
}: {
  children: React.ReactNode;
  size?: string;
  margin?: string;
}): React.JSX.Element {
  return (
    <p style={{ fontSize: size, lineHeight: 1.7, margin, color: "var(--color-text)" }}>
      {children}
    </p>
  );
}

/** A bold inline emphasis (weight 500/600, default text color). */
export function B({
  children,
  weight = 500,
}: {
  children: React.ReactNode;
  weight?: number;
}): React.JSX.Element {
  return <b style={{ fontWeight: weight }}>{children}</b>;
}

/** Inline mono code/path/id. */
export function Code({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <code style={{ fontFamily: "var(--font-mono, monospace)" }}>{children}</code>;
}

/**
 * A note panel: a small Panel with a leading icon + muted body. Mirrors the
 * prototype's `.panel` callouts (e.g. the handoff / iterate notes).
 */
export function NotePanel({
  icon,
  iconColor = "var(--color-text2)",
  children,
  marginTop = "10px",
}: {
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  marginTop?: string;
}): React.JSX.Element {
  return (
    <div style={{ marginTop }}>
      <Panel>
        <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.55 }}>
          {icon != null && (
            <i
              className={`ti ${icon}`}
              aria-hidden="true"
              style={{
                fontSize: "13px",
                verticalAlign: "-2px",
                color: iconColor,
                marginRight: "4px",
              }}
            />
          )}
          {children}
        </div>
      </Panel>
    </div>
  );
}

/** An unordered list with the prototype's compact spacing. */
export function Ul({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: "18px",
        fontSize: "13px",
        lineHeight: 1.7,
        color: "var(--color-text)",
      }}
    >
      {children}
    </ul>
  );
}

/** A thin divider rule (the prototype's `border-top:.5px solid var(--bd)`). */
export function Divider(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{ borderTop: "1px solid var(--color-border)", margin: "12px 0" }}
    />
  );
}

/** A row of inline chips/arrows (the prototype's chip flows). */
export function ChipFlow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
      {children}
    </div>
  );
}
