/**
 * manual-diagrams/SelfLearningLoop.tsx — FRD-08 ("Autoaprendizaje")
 *
 * The self-learning loop: top row Capturar → Refinar → Cuaderno → Recuperar,
 * then a review row Revisar → Tú decides → Promover, closed by a "the notebook
 * grows" footer bar.
 *
 * Faithful recreation of the prototype `docPage(14)` loop block (index.html
 * L1095-1109). Only the loop graphic lives here; the surrounding prose/cards of
 * the concept page are composed in the Manual page component.
 *
 * Tokens only · light+dark first-class · meaning never by color alone.
 *
 * Traceability: CMP-08-diagrams (self-learning).
 */

import type React from "react";
import { Fragment } from "react";
import { MiniNode, type MiniNodeTone, RightArrow } from "./atoms";

// ---------------------------------------------------------------------------
// Row data
// ---------------------------------------------------------------------------

type Step = { readonly title: string; readonly caption: string; readonly tone: MiniNodeTone };

const CAPTURE_ROW: readonly Step[] = [
  { title: "Capturar", caption: "cualquier skill o charla", tone: "accent" },
  { title: "Refinar", caption: "cronista: dedup + procedencia", tone: "accent" },
  { title: "Cuaderno", caption: "factory/memory", tone: "neutral" },
  { title: "Recuperar", caption: "los agentes lo usan", tone: "ok" },
] as const;

const REVIEW_ROW: readonly Step[] = [
  { title: "Revisar", caption: "propone reglas", tone: "neutral" },
  { title: "Tú decides", caption: "apruebas o rechazas", tone: "warn" },
  { title: "Promover", caption: "/learn → regla", tone: "accent" },
] as const;

// ---------------------------------------------------------------------------
// A row of MiniNodes joined by right-arrows
// ---------------------------------------------------------------------------

function StepRow({ steps }: { steps: readonly Step[] }): React.JSX.Element {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "stretch", flexWrap: "wrap" }}>
      {steps.map((step, i) => (
        <Fragment key={step.title}>
          <MiniNode title={step.title} caption={step.caption} tone={step.tone} />
          {i < steps.length - 1 && <RightArrow />}
        </Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelfLearningLoop(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-self-learning">
      <div
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--color-text2)",
          marginBottom: "10px",
        }}
      >
        El bucle
      </div>
      <StepRow steps={CAPTURE_ROW} />
      <div
        aria-hidden="true"
        style={{
          textAlign: "center",
          color: "var(--color-text3)",
          fontSize: "11px",
          margin: "9px 0",
        }}
      >
        ↓ &nbsp; de vez en cuando el cronista revisa y propone ascensos &nbsp; ↓
      </div>
      <StepRow steps={REVIEW_ROW} />
      <div
        style={{
          marginTop: "10px",
          background: "var(--color-ok-bg)",
          borderRadius: "var(--radius-md, 12px)",
          padding: "7px 10px",
          textAlign: "center",
          fontSize: "11px",
          color: "var(--color-ok)",
        }}
      >
        ↻ Cada vuelta el cuaderno crece — y cada proyecto nuevo arranca más listo y rápido.
      </div>
    </div>
  );
}
