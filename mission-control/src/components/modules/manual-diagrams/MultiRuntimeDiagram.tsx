import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
/**
 * manual-diagrams/MultiRuntimeDiagram.tsx — FRD-08 ("Operar desde cualquier agente")
 *
 * The "dos puertas, un núcleo" picture (DR-113): two doors — Claude Code and Codex
 * — each with its own runtime-specific layer, both opening onto
 * the SAME shared core (AGENTS.md + factory/ · plugin/skills · state in files).
 *
 * Faithful to the Manual's diagram visual language (boxed regions + chips + a
 * down-connector), NOT a pixel copy of the raw asset docs/assets/multi-runtime-two-doors.svg.
 * Two door accents come from the token palette (cat-2 purple = Claude, cat-7 amber =
 * Codex); the core is neutral. Tokens only · light+dark first-class · meaning never by
 * color alone (each door is labelled).
 *
 * Traceability: CMP-08-diagrams (multi-runtime).
 */

import type React from "react";

type Door = {
  readonly key: "claude" | "codex";
  readonly icon: IconName;
  readonly title: string;
  readonly subtitle: string;
  readonly accent: string;
  readonly reads: string;
  readonly layer: readonly string[];
};

const DOORS: readonly Door[] = [
  {
    key: "claude",
    icon: "external",
    title: "Puerta Claude Code",
    subtitle: "runtime nativo",
    accent: "var(--teal)",
    reads: "CLAUDE.md → importa AGENTS.md",
    layer: ["plugin /pandacorp:* + hooks", "motor background + supervisor"],
  },
  {
    key: "codex",
    icon: "external",
    title: "Puerta Codex",
    subtitle: "app · CLI · acceso completo",
    accent: "var(--amber)",
    reads: "AGENTS.md directo + plugin Codex",
    layer: ["plugin + .agents/skills (symlink)", ".codex/agents/*.toml (generados)"],
  },
] as const;

const CORE_PIECES: readonly string[] = [
  "AGENTS.md + factory/",
  "plugin/skills · SKILL.md",
  "estado en ficheros",
] as const;

function DoorCard({ door }: { door: Door }): React.JSX.Element {
  return (
    <div
      data-testid={`multi-runtime-door-${door.key}`}
      style={{
        flex: "1 1 220px",
        minWidth: 0,
        border: `1px solid ${door.accent}`,
        borderRadius: "var(--radius-md, 12px)",
        padding: "12px",
        background: "var(--surface-2)",
        boxShadow: `0 0 18px -12px ${door.accent}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span aria-hidden="true" style={{ fontSize: "18px", color: door.accent }}>
          <Icon name={door.icon} size="sm" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
            {door.title}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-3)" }}>{door.subtitle}</div>
        </div>
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--text-2)",
          fontFamily: "var(--font-mono, monospace)",
          marginBottom: "8px",
          lineHeight: 1.5,
        }}
      >
        {door.reads}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {door.layer.map((line) => (
          <div
            key={line}
            style={{
              fontSize: "11px",
              color: "var(--text-2)",
              lineHeight: 1.45,
              paddingLeft: "10px",
              borderLeft: `2px solid ${door.accent}`,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MultiRuntimeDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-multi-runtime">
      {/* The two doors */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {DOORS.map((door) => (
          <DoorCard key={door.key} door={door} />
        ))}
      </div>
      {/* Connector caption — both open onto the same core */}
      <div
        style={{
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: "12px",
          margin: "8px 0 2px",
        }}
      >
        cada herramienta se auto-selecciona por lo que puede leer · ambas abren al{" "}
        <b style={{ fontWeight: 500 }}>mismo taller</b> <span aria-hidden="true">↓</span>
      </div>
      {/* The shared core */}
      <div
        data-testid="multi-runtime-core"
        style={{
          marginTop: "8px",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-lg, 16px)",
          padding: "12px",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "8px",
            color: "var(--text)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "14px", verticalAlign: "-2px" }}>
            <Icon name="factory" size="sm" />
          </span>{" "}
          El núcleo compartido · el mismo conjunto de ficheros
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {CORE_PIECES.map((piece) => (
            <span
              key={piece}
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--text-2)",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm, 8px)",
                padding: "3px 9px",
              }}
            >
              {piece}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
