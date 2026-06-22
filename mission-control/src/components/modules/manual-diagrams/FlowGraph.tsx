"use client";
/**
 * FlowGraph — the interactive, step-by-step flow diagram for a skill (FRD-08).
 *
 * Renders a curated SkillFlow (lib/manual/skill-flows): typed step nodes (action / gate / safe / io /
 * loop) with arrows, parallel rows, notes and a loop badge. Skill/agent `calls` are CLICKABLE — a skill
 * node jumps to that skill's own flow, an agent node to its card (via ManualNavContext) — so the docs
 * become a navigable graph, "for dummies".
 *
 * Token-only (zero hardcoded colors). Faithful to the prototype's flowDiagram() node-by-kind coloring.
 */

import type React from "react";
import { AGENT_COLOR } from "@/app/_design/tokens/tokens";
import { useManualNav } from "@/app/manual/ManualNavContext";
import type { FlowCall, FlowStep, FlowStepKind, SkillFlow } from "@/lib/manual/skill-flows";

// ---------------------------------------------------------------------------
// Kind → visual (color token + icon + label)
// ---------------------------------------------------------------------------

interface KindVisual {
  color: string;
  bg: string;
  icon: string;
  label: string;
}

const KIND_VISUAL: Record<FlowStepKind, KindVisual> = {
  action: {
    color: "var(--color-text2)",
    bg: "var(--color-panel)",
    icon: "ti-point-filled",
    label: "Paso",
  },
  gate: {
    color: "var(--color-warn)",
    bg: "var(--color-warn-bg)",
    icon: "ti-hand-stop",
    label: "Decides / gate",
  },
  safe: {
    color: "var(--color-ok)",
    bg: "var(--color-ok-bg)",
    icon: "ti-circle-check",
    label: "Punto seguro",
  },
  io: {
    color: "var(--color-info)",
    bg: "var(--color-info-bg)",
    icon: "ti-arrows-exchange",
    label: "Tú ↔ IA",
  },
  loop: {
    color: "var(--color-accent-text)",
    bg: "var(--color-accent-bg)",
    icon: "ti-refresh",
    label: "Se repite",
  },
};

// ---------------------------------------------------------------------------
// Styles — tokens only
// ---------------------------------------------------------------------------

const GRAPH_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "0",
};

const ARROW_STYLE: React.CSSProperties = {
  textAlign: "center",
  color: "var(--color-text3)",
  fontSize: "16px",
  lineHeight: 1,
  margin: "5px 0",
};

const CARD_STYLE: React.CSSProperties = {
  position: "relative",
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
  padding: "11px 13px 11px 15px",
  overflow: "hidden",
};

const STRIPE_STYLE = (color: string): React.CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: "4px",
  background: color,
});

const KIND_CHIP_STYLE = (v: KindVisual): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: v.color,
  background: v.bg,
  border: `0.5px solid ${v.color}`,
  borderRadius: "5px",
  padding: "1px 7px",
  whiteSpace: "nowrap",
});

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--color-text)",
  fontFamily: "var(--font-display, system-ui)",
};

const DETAIL_STYLE: React.CSSProperties = {
  fontSize: "12.5px",
  color: "var(--color-text2)",
  lineHeight: 1.55,
  margin: "5px 0 0",
};

const NOTE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  fontStyle: "italic",
  margin: "5px 0 0",
};

const CALLS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "6px",
  marginTop: "9px",
};

const PARALLEL_TAG_STYLE: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--color-accent-text)",
  background: "var(--color-accent-bg)",
  border: "0.5px solid var(--color-accent)",
  borderRadius: "5px",
  padding: "1px 7px",
};

const CHIP_BTN_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "var(--radius-pill, 999px)",
  padding: "3px 11px 3px 9px",
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  transition: "box-shadow .15s, border-color .15s",
};

const LOOP_BADGE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  marginTop: "12px",
  background: "var(--color-accent-bg)",
  border: "0.5px solid var(--color-accent)",
  borderRadius: "8px",
  padding: "9px 12px",
  fontSize: "12px",
  color: "var(--color-accent-text)",
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Call chip (clickable skill / agent node)
// ---------------------------------------------------------------------------

function CallChip({ call }: { call: FlowCall }): React.JSX.Element {
  const nav = useManualNav();
  const isSkill = call.as === "skill";

  // Agent color from the per-agent token (falls back to accent for agents not in the map, e.g. librarian).
  const agentColorToken = (AGENT_COLOR as Record<string, string | undefined>)[call.ref];
  const accent = isSkill
    ? "var(--color-accent-text)"
    : agentColorToken
      ? `var(${agentColorToken})`
      : "var(--color-accent-text)";
  const bg = isSkill ? "var(--color-accent-bg)" : "var(--color-panel)";

  const label = isSkill ? `/${call.ref}` : call.ref;
  const title = call.note
    ? `${isSkill ? "Ir al comando" : "Ir al agente"} ${call.ref} — ${call.note}`
    : `${isSkill ? "Ir al comando" : "Ir al agente"} ${call.ref}`;

  function handleClick(): void {
    if (isSkill) nav.goToSkill(call.ref);
    else nav.goToAgent(call.ref);
  }

  return (
    <button
      type="button"
      data-testid={`flow-call-${call.as}-${call.ref}`}
      data-flow-call={call.ref}
      onClick={handleClick}
      title={title}
      style={{
        ...CHIP_BTN_BASE,
        color: accent,
        background: bg,
        border: `1px solid ${accent}`,
      }}
    >
      {isSkill ? (
        <i className="ti ti-wand" aria-hidden="true" style={{ fontSize: "12px" }} />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: accent,
            flex: "0 0 auto",
          }}
        />
      )}
      <span style={{ fontFamily: isSkill ? "var(--font-mono, monospace)" : "inherit" }}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// One step node
// ---------------------------------------------------------------------------

function StepNode({ step, index }: { step: FlowStep; index: number }): React.JSX.Element {
  const v = KIND_VISUAL[step.kind];
  const hasCalls = step.calls !== undefined && step.calls.length > 0;

  return (
    <div data-testid={`flow-step-${index}`} data-flow-kind={step.kind} style={CARD_STYLE}>
      <span aria-hidden="true" style={STRIPE_STYLE(v.color)} />

      <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
        <span style={KIND_CHIP_STYLE(v)}>
          <i className={`ti ${v.icon}`} aria-hidden="true" style={{ fontSize: "11px" }} />
          {v.label}
        </span>
        <span style={TITLE_STYLE}>{step.title}</span>
        {step.parallel && hasCalls && <span style={PARALLEL_TAG_STYLE}>en paralelo</span>}
      </div>

      {step.detail !== undefined && <p style={DETAIL_STYLE}>{step.detail}</p>}
      {step.note !== undefined && (
        <p style={NOTE_STYLE}>
          <i
            className="ti ti-info-circle"
            aria-hidden="true"
            style={{ fontSize: "11px", verticalAlign: "-1px" }}
          />{" "}
          {step.note}
        </p>
      )}

      {hasCalls && (
        <div style={CALLS_ROW_STYLE}>
          {step.calls?.map((call) => (
            <CallChip key={`${call.as}-${call.ref}`} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlowGraph
// ---------------------------------------------------------------------------

export interface FlowGraphProps {
  flow: SkillFlow;
}

/** The interactive step-by-step flow graph for a skill. */
export function FlowGraph({ flow }: FlowGraphProps): React.JSX.Element {
  return (
    <div data-testid="flow-graph" style={GRAPH_STYLE}>
      {flow.steps.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps are a fixed ordered list, no reordering
        <div key={i}>
          <StepNode step={step} index={i} />
          {i < flow.steps.length - 1 && (
            <div style={ARROW_STYLE} aria-hidden="true">
              ↓
            </div>
          )}
        </div>
      ))}

      {flow.loop !== undefined && flow.loop.length > 0 && (
        <div data-testid="flow-loop" style={LOOP_BADGE_STYLE}>
          <i
            className="ti ti-refresh"
            aria-hidden="true"
            style={{ fontSize: "14px", marginTop: "1px", flex: "0 0 auto" }}
          />
          <span>
            <b style={{ fontWeight: 600 }}>Se repite:</b> {flow.loop}
          </span>
        </div>
      )}
    </div>
  );
}
