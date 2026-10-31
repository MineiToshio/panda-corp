import { Icon } from "@/components/core/Icon/Icon";
/**
 * manual-diagrams/ArchDiagram.tsx — FRD-08 ("Arquitectura del sistema")
 *
 * The factory (panda-corp repo) as one boxed region holding its parts (plugin /
 * Mission Control / ideas / portfolio), then the products below as separate
 * repos — the "know-how travels by the plugin, products live apart" picture.
 *
 * Faithful recreation of the prototype `archDiagram()` (index.html L1073).
 *
 * Tokens only · light+dark first-class. The prototype's `--secondary` surface maps
 * to the app's `--color-panel` resting-tile token (Panel "secondary" variant).
 *
 * Traceability: CMP-08-diagrams (arch).
 */

import type React from "react";
import { Chip } from "@/components/core/Chip/Chip";

const FACTORY_PARTS: readonly string[] = [
  "plugin · skills/agents/hooks",
  "Mission Control · esta app",
  "base de ideas",
  "portfolio",
] as const;

const PRODUCTS: readonly string[] = ["funko-tracker", "budget-buddy", "…"] as const;

export function ArchDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-arch">
      {/* The factory region */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg, 16px)",
          padding: "12px",
          background: "var(--surface)",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "8px",
            color: "var(--text)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "14px", verticalAlign: "-2px" }}>
            <Icon name="factory" size="sm" />
          </span>{" "}
          La fábrica · repo panda-corp (el know-how)
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {FACTORY_PARTS.map((part) => (
            <Chip key={part} tone="slate">
              {part}
            </Chip>
          ))}
        </div>
      </div>
      {/* Connector caption */}
      <div
        style={{
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: "12px",
          margin: "2px 0",
        }}
      >
        el know-how viaja por el <b style={{ fontWeight: 500 }}>plugin</b> · los productos viven
        aparte <span aria-hidden="true">↓</span>
      </div>
      {/* The products */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: "8px",
        }}
      >
        {PRODUCTS.map((product) => (
          <div
            key={product}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md, 12px)",
              padding: "8px 12px",
              background: "var(--surface)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text)" }}>{product}</div>
            <div style={{ fontSize: "11px", color: "var(--text-3)" }}>repo propio · su docs/</div>
          </div>
        ))}
      </div>
    </div>
  );
}
