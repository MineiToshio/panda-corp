/**
 * manual-diagrams/atoms.tsx — FRD-08 Manual concept diagrams (shared atoms)
 *
 * Small, presentational building blocks shared by the Manual's concept/landing
 * diagrams (pipeline, team, channels, snapshot, arch, cockpit, self-learning,
 * hooks, stacks, state-table). They mirror the prototype's inline diagram markup
 * (index.html `pipelineDiagram()` … `docPage(14)`), recreated as faithful React.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only (tokens).
 *   - Light + dark first-class (tokens re-resolve under [data-theme]).
 *   - Decorative glyphs are aria-hidden; meaning never by color alone.
 *
 * Traceability: CMP-08-diagrams (docs/design/components.md "Manual diagrams").
 */

import type React from "react";

// ---------------------------------------------------------------------------
// Down arrow — the vertical connector between stacked diagram rows ("↓")
// Prototype: `<div style="...color:var(--text3);font-size:16px">↓</div>`
// ---------------------------------------------------------------------------

export function DownArrow({
  marginLeft = "0",
  size = "16px",
}: {
  marginLeft?: string;
  size?: string;
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        margin: `6px 0 6px ${marginLeft}`,
        color: "var(--color-text3)",
        fontSize: size,
        lineHeight: 1,
      }}
    >
      ↓
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right arrow — the horizontal connector between flow nodes (Tabler "→")
// Prototype: `<i class="ti ti-arrow-right" style="color:var(--text3)">`
// ---------------------------------------------------------------------------

export function RightArrow({ size = "15px" }: { size?: string }): React.JSX.Element {
  return (
    <i
      className="ti ti-arrow-right"
      aria-hidden="true"
      style={{
        color: "var(--color-text3)",
        fontSize: size,
        alignSelf: "center",
        flex: "0 0 auto",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// MiniNode — a small labelled step box used by the self-learning loop.
// Prototype: bordered/tinted box with a title + a one-line caption (docPage 14).
// ---------------------------------------------------------------------------

export type MiniNodeTone = "accent" | "ok" | "warn" | "neutral";

const MINI_NODE_BORDER: Record<MiniNodeTone, string> = {
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  neutral: "var(--color-border)",
};

const MINI_NODE_BG: Record<MiniNodeTone, string> = {
  accent: "var(--color-accent-bg)",
  ok: "var(--color-ok-bg)",
  warn: "var(--color-warn-bg)",
  neutral: "var(--color-panel)",
};

const MINI_NODE_TITLE: Record<MiniNodeTone, string> = {
  accent: "var(--color-accent-text)",
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  neutral: "var(--color-text)",
};

export function MiniNode({
  title,
  caption,
  tone = "neutral",
}: {
  title: string;
  caption: string;
  tone?: MiniNodeTone;
}): React.JSX.Element {
  return (
    <div
      style={{
        flex: "1 1 92px",
        minWidth: "84px",
        border: `1px solid ${MINI_NODE_BORDER[tone]}`,
        borderRadius: "var(--radius-md, 12px)",
        padding: "7px 8px",
        background: MINI_NODE_BG[tone],
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 500, color: MINI_NODE_TITLE[tone] }}>{title}</div>
      <div
        style={{
          fontSize: "10px",
          color: tone === "neutral" ? "var(--color-text3)" : "var(--color-text2)",
          marginTop: "1px",
        }}
      >
        {caption}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconRowCard — a `.panel`-style row: leading status icon + title + body.
// Prototype: the channels / hooks panels (icon left, title + caption right).
// Rendered WITHOUT its own Panel so callers wrap it in <Panel> for the surface.
// ---------------------------------------------------------------------------

export function IconRow({
  icon,
  iconColor,
  title,
  children,
}: {
  icon: string;
  iconColor: string;
  title: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <i
        className={`ti ${icon}`}
        aria-hidden="true"
        style={{ fontSize: "18px", color: iconColor, marginTop: "1px" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>{title}</div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text2)",
            marginTop: "3px",
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
