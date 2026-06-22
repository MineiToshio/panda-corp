/**
 * manual-diagrams/SnapshotMini.tsx — FRD-08 ("Probar sin parar al agente")
 *
 * Two side-by-side boxes (agent building / you testing) over a shared
 * "git · historial compartido" bar — the safe-point-is-a-commit picture.
 *
 * Faithful recreation of the prototype `snapshotMini()` (index.html L1071-1072).
 *
 * Tokens only · light+dark first-class · meaning never by color alone.
 *
 * Traceability: CMP-08-diagrams (snapshot).
 */

import type React from "react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapshotMini(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-snapshot">
      <div style={{ display: "flex", gap: "10px", alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Agent building (cat-8) */}
        <div
          style={{
            flex: 1,
            minWidth: "160px",
            background: "var(--color-cat-8)",
            color: "var(--color-base)",
            borderRadius: "var(--radius-sm, 8px)",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500 }}>Agente construyendo</div>
          <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
            en su carpeta · a medias
          </div>
        </div>
        {/* You testing (cat-1) */}
        <div
          style={{
            flex: 1,
            minWidth: "160px",
            background: "var(--color-cat-1)",
            color: "var(--color-base)",
            borderRadius: "var(--radius-sm, 8px)",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500 }}>Tú probando</div>
          <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
            otra carpeta · último verde, congelado
          </div>
        </div>
      </div>
      {/* Shared connector */}
      <div
        aria-hidden="true"
        style={{
          textAlign: "center",
          color: "var(--color-text3)",
          margin: "6px 0",
          fontSize: "14px",
        }}
      >
        ↓ &nbsp; comparten &nbsp; ↓
      </div>
      {/* git shared history bar */}
      <div
        style={{
          background: "var(--color-panel)",
          borderRadius: "var(--radius-sm, 8px)",
          padding: "10px 12px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
          git · historial compartido
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text2)", marginTop: "2px" }}>
          solo cruzan los commits verdes · el agente nunca para
        </div>
      </div>
    </div>
  );
}
