/**
 * manual-diagrams/CockpitDataDiagram.tsx — FRD-08 ("Mission Control por dentro")
 *
 * The file sources (left, mono list) → arrow → Mission Control box (right,
 * accent) — "it only reads, never calls Claude".
 *
 * Faithful recreation of the prototype `cockpitDataDiagram()` (index.html L1074).
 *
 * Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (cockpit-data).
 */

import type React from "react";

const SOURCES: readonly string[] = [
  "factory/ideas/*.md",
  "factory/portfolio.md",
  ".pandacorp/status.yaml (×proyecto)",
  "~/.claude/dashboard-events.ndjson",
  "~/.claude/plugins/installed_plugins.json",
] as const;

export function CockpitDataDiagram(): React.JSX.Element {
  return (
    <div
      data-testid="manual-diagram-cockpit-data"
      style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}
    >
      <div style={{ flex: 1, minWidth: "170px" }}>
        {SOURCES.map((src) => (
          <div
            key={src}
            style={{
              fontSize: "12px",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--color-text2)",
              padding: "2px 0",
            }}
          >
            {src}
          </div>
        ))}
      </div>
      <i
        className="ti ti-arrow-right"
        aria-hidden="true"
        style={{ fontSize: "18px", color: "var(--color-text3)" }}
      />
      <div
        style={{
          background: "var(--color-accent)",
          color: "var(--color-on-accent)",
          borderRadius: "var(--radius-sm, 8px)",
          padding: "10px 14px",
          textAlign: "center",
          flex: "0 0 auto",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500 }}>Mission Control</div>
        <div style={{ fontSize: "11px", opacity: 0.9 }}>solo lee · nunca llama a Claude</div>
      </div>
    </div>
  );
}
