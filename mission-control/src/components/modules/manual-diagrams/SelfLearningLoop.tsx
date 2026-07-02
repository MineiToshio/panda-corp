/**
 * manual-diagrams/SelfLearningLoop.tsx — FRD-08 ("Autoaprendizaje"), loop v2.
 *
 * The self-learning cycle as a vertical 6-step flow: five AUTOMATIC steps
 * (capture → harvest → filter → use → escalation) and ONE owner step (approve
 * with /pandacorp:learn). Mirrors the loop-v2 mechanics shipped 2026-07-02
 * (factory proposal 23, plugin v9.49.x): same-turn capture + re-scan backstop,
 * close-out harvest + daily threshold sweep, cross-corroboration filter,
 * citation-measured retrieval, and the >=3-projects promotion escalator.
 *
 * A legend up top separates "automático" from "tu único paso" so the owner sees
 * at a glance that the loop turns by itself. Meaning never by color alone (each
 * card carries its icon + explicit step label).
 *
 * Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (self-learning).
 */

import type React from "react";
import { Fragment } from "react";

// ---------------------------------------------------------------------------
// Step data
// ---------------------------------------------------------------------------

type LoopStep = {
  readonly icon: string;
  readonly title: string;
  readonly caption: string;
  readonly owner: boolean;
};

const LOOP_STEPS: readonly LoopStep[] = [
  {
    icon: "ti-pencil",
    title: "1 · Captura — mientras conversas",
    caption:
      "Cada corrección tuya, fallo arreglado o veredicto de librería se anota en el instante, en el mismo turno. Al cerrar la sesión, una red de seguridad re-escanea la conversación por si algo se escapó.",
    owner: false,
  },
  {
    icon: "ti-refresh",
    title: "2 · Cosecha — dos motores",
    caption:
      "Al terminar cada build, el cierre cosecha obligatoriamente (sello last_harvest). Y cada mañana la rutina programada barre todo: con 20+ notas, 7+ días sin barrer o un build sin cosechar, trabaja; si no, silencio.",
    owner: false,
  },
  {
    icon: "ti-filter",
    title: "3 · Filtro — solo entra lo probado",
    caption:
      "El cronista descarta por defecto lo que no tiene evidencia concreta. Una lección solo se vuelve activa cuando otro proyecto distinto la confirma (o tú la dijiste). Nada se borra; se archiva.",
    owner: false,
  },
  {
    icon: "ti-book",
    title: "4 · Uso — los builds nuevos la leen",
    caption:
      'Antes de trabajar, cada agente lee el índice ("úsala cuando…") y cita la lección aplicada en el documento que escribe. Un script cuenta esas citas — el uso se mide, no se promete.',
    owner: false,
  },
  {
    icon: "ti-arrow-up-right",
    title: "5 · Ascenso — se propone sola",
    caption:
      "Cuando 3 proyectos citan la misma lección, entra sola a la cola de promociones: candidata a volverse regla o estándar permanente de la fábrica.",
    owner: false,
  },
  {
    icon: "ti-crown",
    title: "6 · Tu único paso — aprobar",
    caption:
      "El buzón de Propuestas y el reporte diario te muestran la cola. Si te convence, /pandacorp:learn la vuelve regla para siempre; si no, la rechazas y sigue siendo una lección útil.",
    owner: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function LegendPill({ owner, label }: { owner: boolean; label: string }): React.JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        color: owner ? "var(--color-warn)" : "var(--color-ok)",
        background: owner ? "var(--color-warn-bg)" : "var(--color-ok-bg)",
        borderRadius: "var(--radius-sm, 8px)",
        padding: "2px 9px",
      }}
    >
      <i
        className={`ti ${owner ? "ti-user" : "ti-settings-automation"}`}
        aria-hidden="true"
        style={{ fontSize: "13px" }}
      />
      {label}
    </span>
  );
}

function StepCard({ step }: { step: LoopStep }): React.JSX.Element {
  const tint = step.owner ? "var(--color-warn)" : "var(--color-ok)";
  return (
    <div
      style={{
        background: step.owner ? "var(--color-warn-bg)" : "var(--color-panel)",
        border: `var(--hairline, 1px) solid ${step.owner ? "var(--color-warn)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md, 12px)",
        padding: "11px 14px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      <i
        className={`ti ${step.icon}`}
        aria-hidden="true"
        style={{ fontSize: "18px", color: tint, marginTop: "1px" }}
      />
      <div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
          {step.title}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text2)",
            marginTop: "3px",
            lineHeight: 1.5,
          }}
        >
          {step.caption}
        </div>
      </div>
    </div>
  );
}

function Connector({ toOwner }: { toOwner: boolean }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        width: "2px",
        height: "12px",
        background: toOwner
          ? "var(--color-warn)"
          : "var(--color-border-strong, var(--color-border))",
        marginLeft: "22px",
      }}
    />
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
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <LegendPill owner={false} label="automático — no haces nada" />
        <LegendPill owner={true} label="tu único paso" />
      </div>
      {LOOP_STEPS.map((step, i) => (
        <Fragment key={step.title}>
          <StepCard step={step} />
          {i < LOOP_STEPS.length - 1 && <Connector toOwner={LOOP_STEPS[i + 1]?.owner === true} />}
        </Fragment>
      ))}
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
