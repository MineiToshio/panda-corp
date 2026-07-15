/**
 * manual-diagrams/RuntimeComparison.tsx — FRD-08 ("Operar desde cualquier agente")
 *
 * The per-capability Claude Code vs Codex comparison (PORT-1..6). Each row states
 * a capability, what each runtime provides, and a labelled status badge:
 *   - "idéntico"  → both runtimes behave the same (governance, gates, docs)
 *   - "degrada"   → Codex provides a narrower/manual form of the capability
 *   - "solo Claude" → the mechanism is Claude-Code-only (governance still binds)
 * A highlighted final row states what is IDENTICAL across runtimes (the governance
 * floor: change queue, decisions, docs, human gates, Spanish).
 *
 * Status is NEVER conveyed by color alone — every badge pairs an icon + a text
 * label + a data-status attribute. Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (multi-runtime).
 */

import type React from "react";

type Status = "same" | "degrades" | "claude-only";

type Row = {
  readonly capability: string;
  readonly claude: string;
  readonly codex: string;
  readonly status: Status;
};

type StatusMeta = {
  readonly label: string;
  readonly icon: string;
  readonly color: string;
  readonly bg: string;
};

const STATUS_META: Record<Status, StatusMeta> = {
  same: {
    label: "idéntico",
    icon: "ti-equal",
    color: "var(--color-ok)",
    bg: "var(--color-ok-bg)",
  },
  degrades: {
    label: "degrada",
    icon: "ti-arrow-down-right",
    color: "var(--color-warn)",
    bg: "var(--color-warn-bg)",
  },
  "claude-only": {
    label: "solo Claude",
    icon: "ti-lock",
    color: "var(--color-info)",
    bg: "var(--color-info-bg)",
  },
} as const;

const ROWS: readonly Row[] = [
  {
    capability: "Manual que carga",
    claude: "CLAUDE.md → importa AGENTS.md",
    codex: "AGENTS.md directo (< 32 KB, sin @imports)",
    status: "same",
  },
  {
    capability: "Invocar skills",
    claude: "plugin instalado (/pandacorp:*)",
    codex: ".agents/skills → plugin/skills (symlink)",
    status: "same",
  },
  {
    capability: "Build (implement)",
    claude: "background + paralelo, motor dinámico",
    codex: "EXPERIMENTAL: 1 FRD/change, foreground, ≤7200 s, sin autorestart",
    status: "degrades",
  },
  {
    capability: "Construcción nocturna",
    claude: "desatendida, corre por horas sin owner",
    codex: "no habilitada; attended_foreground no se puede dejar solo",
    status: "claude-only",
  },
  {
    capability: "Subagentes",
    claude: "modelo elegido al vuelo por subtarea",
    codex: ".codex/agents/*.toml (modelo fijo) · tiers mech/standard/judge",
    status: "degrades",
  },
  {
    capability: "Tiers de modelo",
    claude: "haiku / sonnet / opus",
    codex: "gpt-5.4-mini / gpt-5.5 medium / gpt-5.5 high",
    status: "same",
  },
  {
    capability: "Enforcement",
    claude: "hooks automáticos (bloqueo, gate al parar)",
    codex: "hooks/config generados; instalación + trust siguen siendo gates",
    status: "degrades",
  },
  {
    capability: "Fragua / telemetría",
    claude: "eventos completos (hooks + motor)",
    codex: "transporte propio + progreso/track; archivos siguen siendo verdad",
    status: "degrades",
  },
  {
    capability: "Notificaciones",
    claude: "push al escritorio + móvil",
    codex: "avance en chat mientras el build atendido permanece abierto",
    status: "degrades",
  },
  {
    capability: "Claude Design",
    claude: "canvas nativo (DesignSync)",
    codex: "fallback HTML documentado (DR-058 plan B)",
    status: "claude-only",
  },
];

const IDENTICAL_ROW = {
  capability: "Gobernanza",
  detail:
    "Cola de cambios, decisiones, disciplina documental, gates humanos y el español contigo: IDÉNTICO en ambas puertas. Un runtime degrada el mecanismo, nunca la gobernanza.",
} as const;

function StatusBadge({ status }: { status: Status }): React.JSX.Element {
  const meta = STATUS_META[status];
  return (
    <span
      data-testid={`runtime-status-${status}`}
      data-status={status}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        borderRadius: "var(--radius-sm, 8px)",
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <i className={`ti ${meta.icon}`} aria-hidden="true" style={{ fontSize: "12px" }} />
      {meta.label}
    </span>
  );
}

function ComparisonRow({ row, isFirst }: { row: Row; isFirst: boolean }): React.JSX.Element {
  return (
    <div
      data-testid={`runtime-row-${row.capability}`}
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "9px 0",
        borderTop: isFirst ? undefined : "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          flex: "0 0 128px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {row.capability}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: "5px" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.45 }}>
            <span style={{ color: "var(--color-cat-2)", fontWeight: 600 }}>Claude · </span>
            {row.claude}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text2)", lineHeight: 1.45 }}>
            <span style={{ color: "var(--color-cat-7)", fontWeight: 600 }}>Codex · </span>
            {row.codex}
          </div>
        </div>
      </div>
      <div style={{ flex: "0 0 auto" }}>
        <StatusBadge status={row.status} />
      </div>
    </div>
  );
}

export function RuntimeComparison(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-runtime-comparison">
      {ROWS.map((row, i) => (
        <ComparisonRow key={row.capability} row={row} isFirst={i === 0} />
      ))}
      {/* The highlighted "everything below is identical" row */}
      <div
        data-testid="runtime-row-identical"
        style={{
          marginTop: "10px",
          border: "1px solid var(--color-ok)",
          borderRadius: "var(--radius-md, 12px)",
          padding: "10px 12px",
          background: "var(--color-ok-bg)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}
      >
        <i
          className="ti ti-shield-check"
          aria-hidden="true"
          style={{ fontSize: "18px", color: "var(--color-ok)", marginTop: "1px" }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
            {IDENTICAL_ROW.capability} · idéntico en ambas puertas
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--color-text2)",
              marginTop: "3px",
              lineHeight: 1.5,
            }}
          >
            {IDENTICAL_ROW.detail}
          </div>
        </div>
      </div>
    </div>
  );
}
