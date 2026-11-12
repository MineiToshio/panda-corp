import type { IconName } from "@/components/core/Icon/iconData";
/**
 * manual-diagrams/ChannelsDiagram.tsx : FRD-08 ("Cómo operas a diario")
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
import { Card } from "@/components/core/Card/Card";
import { IconRow } from "./atoms";

// ---------------------------------------------------------------------------
// Channel data : mirrors the prototype `ch` array.
// ---------------------------------------------------------------------------

type Channel = {
  readonly icon: IconName;
  readonly color: string;
  readonly cmd: string;
  readonly headline: string;
  readonly body: string;
};

const CHANNELS: readonly Channel[] = [
  {
    icon: "alert",
    color: "var(--coral)",
    cmd: "/pandacorp:implement",
    headline: "Algo está roto",
    body: "Describe el bug y fija su alcance. Los tests de regresión preceden al arreglo; no se amplía otro run.",
  },
  {
    icon: "branch",
    color: "var(--blue)",
    cmd: "Anótalo: draft + card check",
    headline: "Un cambio o módulo nuevo",
    body: "Guarda el pedido sin construir y valida su tarjeta. Más adelante selecciona ese objetivo con implement.",
  },
  {
    icon: "check",
    color: "var(--amber)",
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
          <Card>
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
          </Card>
        </div>
      ))}
    </div>
  );
}
