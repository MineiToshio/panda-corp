import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
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
  readonly icon: IconName;
  readonly color: string;
  readonly bg: string;
};

const STATUS_META: Record<Status, StatusMeta> = {
  same: {
    label: "idéntico",
    icon: "layers",
    color: "var(--green)",
    bg: "color-mix(in srgb, var(--green) var(--tint), transparent)",
  },
  degrades: {
    label: "degrada",
    icon: "arrow",
    color: "var(--amber)",
    bg: "color-mix(in srgb, var(--amber) var(--tint), transparent)",
  },
  "claude-only": {
    label: "solo Claude",
    icon: "lock",
    color: "var(--blue)",
    bg: "color-mix(in srgb, var(--blue) var(--tint), transparent)",
  },
} as const;

const ROWS: readonly Row[] = [
  {
    capability: "Instrucciones que carga",
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
    codex: "acceso completo; sesión nativa o launcher foreground con alcance probado (DR-133)",
    status: "degrades",
  },
  {
    capability: "Construcción nocturna",
    claude: "desatendida, corre por horas sin owner",
    codex: "sesión atendida; sin promesa de automatización nocturna",
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
    codex: "gpt-6-luna low / gpt-6.1-sol low / gpt-6.1-sol high",
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
    codex: "progreso y resultados en chat; notificaciones si el runtime las ofrece",
    status: "degrades",
  },
  {
    capability: "Revisión de diseño",
    claude: "Artifacts privados con enlace estable y comentarios",
    codex: "archivos locales o capturas",
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
      <span aria-hidden="true" style={{ fontSize: "12px" }}>
        <Icon name={meta.icon} size="sm" />
      </span>
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
        borderTop: isFirst ? undefined : "1px solid var(--line)",
      }}
    >
      <div
        style={{
          flex: "0 0 128px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text)",
        }}
      >
        {row.capability}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: "5px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.45 }}>
            <span style={{ color: "var(--teal)", fontWeight: 600 }}>Claude · </span>
            {row.claude}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.45 }}>
            <span style={{ color: "var(--amber)", fontWeight: 600 }}>Codex · </span>
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
          border: "1px solid var(--green)",
          borderRadius: "var(--radius-md, 12px)",
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--green) var(--tint), transparent)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontSize: "18px", color: "var(--green)", marginTop: "1px" }}
        >
          <Icon name="shield" size="sm" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
            {IDENTICAL_ROW.capability} · idéntico en ambas puertas
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-2)",
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
