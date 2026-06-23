/**
 * manual-diagrams/PipelineDiagram.tsx — FRD-08 ("El recorrido de una idea")
 *
 * The 6-phase pipeline trail: each phase is a colored chip (118px) + a
 * description + a CmdRow, separated by a down-arrow connector.
 *
 * Faithful recreation of the prototype `pipelineDiagram()` (index.html L1055-1062).
 *
 * Tokens only · light+dark first-class · meaning never by color alone (the phase
 * name is the label; the color is reinforcement).
 *
 * Traceability: CMP-08-diagrams (pipeline).
 */

import type React from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { DownArrow } from "./atoms";

// ---------------------------------------------------------------------------
// Phase data — mirrors the prototype `st` array (name, color token, copy, cmd)
// ---------------------------------------------------------------------------

type Phase = {
  readonly name: string;
  readonly color: string;
  readonly body: string;
  readonly cmd: string;
};

const PHASES: readonly Phase[] = [
  {
    name: "Descubierta",
    color: "var(--color-text3)",
    body: "Exploras una idea difusa en conversación, capturas una idea tuya, o la fábrica descubre oportunidades en internet.",
    cmd: "/pandacorp:explore · :new-idea · :discover",
  },
  {
    name: "Documentada",
    color: "var(--color-cat-2)",
    body: "Nace el proyecto (handoff). Investigación + PRD + FRDs del MVP con criterios verificables.",
    cmd: "/pandacorp:spec <idea>",
  },
  {
    name: "Diseño",
    color: "var(--color-cat-3)",
    body: "El designer genera 3 mockups navegables + design tokens; el copywriter define la voz y el microcopy real. Tú eliges uno.",
    cmd: "/pandacorp:design",
  },
  {
    name: "Arquitectura",
    color: "var(--color-cat-8)",
    body: "El architect propone el stack (lo apruebas), diseña y genera las work orders.",
    cmd: "/pandacorp:blueprint",
  },
  {
    name: "En construcción",
    color: "var(--color-cat-6)",
    body: "Un workflow dinámico orquesta a los subagentes (TDD), desatendido. Lo sigues en Mission Control. El último paso es el endurecimiento: seguridad, calidad, auditoría y métricas/telemetría.",
    cmd: "/pandacorp:implement",
  },
  {
    name: "Lanzada",
    color: "var(--color-cat-1)",
    body: "La versión (ya auditada) se despliega y lanza —interno en local o externo (Vercel/AWS)—; el devops la pone viva con la copy de landing lista. Producción la apruebas tú. Desde aquí iteras: no hay una fase «operación» aparte.",
    cmd: "/pandacorp:release",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-pipeline">
      {PHASES.map((phase, i) => (
        <div key={phase.name}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            {/* Phase label chip (fixed 118px column) */}
            <div style={{ flex: "0 0 118px" }}>
              <div
                style={{
                  background: phase.color,
                  color: "var(--color-base)",
                  borderRadius: "var(--radius-sm, 8px)",
                  padding: "9px 8px",
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                {phase.name}
              </div>
            </div>
            {/* Description + command */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", color: "var(--color-text)", lineHeight: 1.5 }}>
                {phase.body}
              </div>
              <div style={{ marginTop: "6px" }}>
                <CmdRow command={phase.cmd} />
              </div>
            </div>
          </div>
          {i < PHASES.length - 1 && <DownArrow marginLeft="58px" />}
        </div>
      ))}
    </div>
  );
}
