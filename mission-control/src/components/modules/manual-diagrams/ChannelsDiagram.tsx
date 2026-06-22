/**
 * manual-diagrams/ChannelsDiagram.tsx — FRD-08 ("Cómo operas a diario")
 *
 * The three feedback channels (bug / iterate / decide): each a Panel row with a
 * leading status icon, a mono command + headline, and a one-line description.
 *
 * Faithful recreation of the prototype `channelsDiagram()` (index.html L1066-1070).
 *
 * Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (channels).
 */

import type React from "react";
import { Panel } from "@/components/core/Panel/Panel";
import { IconRow } from "./atoms";

// ---------------------------------------------------------------------------
// Channel data — mirrors the prototype `ch` array.
// ---------------------------------------------------------------------------

type Channel = {
  readonly icon: string;
  readonly color: string;
  readonly cmd: string;
  readonly headline: string;
  readonly body: string;
};

const CHANNELS: readonly Channel[] = [
  {
    icon: "ti-bug",
    color: "var(--color-danger)",
    cmd: "/pandacorp:bug",
    headline: "Algo está roto",
    body: "Lo dejas en la bandeja; la construcción lo recoge y lo arregla con un test de regresión. No para al agente.",
  },
  {
    icon: "ti-git-branch",
    color: "var(--color-info)",
    cmd: "/pandacorp:iterate",
    headline: "Un cambio o módulo nuevo",
    body: "El PM triagea: ajuste chico se encola; cambio fuerte te muestra el impacto y pide pausar.",
  },
  {
    icon: "ti-check",
    color: "var(--color-warn)",
    cmd: "/pandacorp:decide",
    headline: "Responder algo que te preguntó",
    body: "Te muestra la decisión con su recomendación, la registra y desbloquea el frente.",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChannelsDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-channels">
      {CHANNELS.map((ch) => (
        <div key={ch.cmd} style={{ marginBottom: "8px" }}>
          <Panel>
            <IconRow
              icon={ch.icon}
              iconColor={ch.color}
              title={
                <>
                  <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{ch.cmd}</span> ·{" "}
                  {ch.headline}
                </>
              }
            >
              {ch.body}
            </IconRow>
          </Panel>
        </div>
      ))}
    </div>
  );
}
