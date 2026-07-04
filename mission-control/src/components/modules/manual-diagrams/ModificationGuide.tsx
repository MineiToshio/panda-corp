/**
 * manual-diagrams/ModificationGuide.tsx — FRD-08 ("Operar desde cualquier agente")
 *
 * The compact cross-runtime modification guide ("si cambias X, haz también Y")
 * from multi-runtime.md, rendered as a two-column key→action list inside a Panel.
 *
 * Tokens only · light+dark first-class · Spanish copy.
 *
 * Traceability: CMP-08-diagrams (multi-runtime).
 */

import type React from "react";
import { Code } from "./prose";

type Change = { readonly change: string; readonly action: React.ReactNode };

const CHANGES: readonly Change[] = [
  {
    change: "Un skill (SKILL.md)",
    action: (
      <>
        Nada para Codex — el symlink lo ve al instante. Claude necesita{" "}
        <Code>claude plugin update</Code> como siempre.
      </>
    ),
  },
  {
    change: "Un agente (plugin/agents/*.md)",
    action: (
      <>
        Regenerar los espejos: <Code>node plugin/scripts/generate-codex-agents.mjs</Code>.
      </>
    ),
  },
  {
    change: "El manual (AGENTS.md)",
    action: (
      <>
        Verificar que sigue <Code>&lt; 32 KB</Code> (tope de Codex) y que no depende de{" "}
        <Code>@imports</Code> (Codex no los expande).
      </>
    ),
  },
  {
    change: "La capa Claude (CLAUDE.md)",
    action: <>Nada para Codex — no lo lee.</>,
  },
  {
    change: "La versión del plugin",
    action: <>Mantener los DOS manifests en la misma versión.</>,
  },
];

export function ModificationGuide(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-modification-guide">
      {CHANGES.map((row, i) => (
        <div
          key={row.change}
          data-testid={`modguide-row-${i}`}
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
            padding: "8px 0",
            borderTop: i === 0 ? undefined : "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              flex: "0 0 160px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text)",
              display: "flex",
              gap: "7px",
              alignItems: "flex-start",
            }}
          >
            <i
              className="ti ti-pencil"
              aria-hidden="true"
              style={{ fontSize: "13px", color: "var(--color-accent-text)", marginTop: "1px" }}
            />
            {row.change}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "12px",
              color: "var(--color-text2)",
              lineHeight: 1.5,
            }}
          >
            {row.action}
          </div>
        </div>
      ))}
    </div>
  );
}
