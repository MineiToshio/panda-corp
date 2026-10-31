import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
/**
 * manual-diagrams/SourceOfTruthMap.tsx — FRD-08 ("Operar desde cualquier agente")
 *
 * The single-source-of-truth map (agent-portability standard, "Maintenance"):
 * every piece has exactly ONE source; the "other side" is a symlink, an import,
 * a shared read, or a script-GENERATED artifact. Generated projections are flagged.
 *
 * Each row carries a labelled mechanism badge (mechanism never by color alone:
 * icon + text + data-mechanism). Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (multi-runtime).
 */

import type React from "react";

type Mechanism = "symlink" | "import" | "shared" | "generated" | "mirror";

type Meta = { readonly label: string; readonly icon: IconName; readonly color: string };

const MECHANISM_META: Record<Mechanism, Meta> = {
  symlink: { label: "symlink", icon: "link", color: "var(--green)" },
  import: { label: "import", icon: "file", color: "var(--blue)" },
  shared: { label: "compartido", icon: "file", color: "var(--text-2)" },
  generated: { label: "generado", icon: "sparkles", color: "var(--amber)" },
  mirror: { label: "espejo", icon: "copy", color: "var(--violet)" },
} as const;

type Piece = {
  readonly piece: string;
  readonly source: string;
  readonly otherSide: string;
  readonly mechanism: Mechanism;
  /** A deterministic generated projection checked by the drift gate. */
  readonly derived?: boolean;
};

const PIECES: readonly Piece[] = [
  {
    piece: "Los 25 skills",
    source: "plugin/skills/*/SKILL.md",
    otherSide: ".agents/skills → plugin/skills · el mismo fichero físico",
    mechanism: "symlink",
  },
  {
    piece: "El manual operativo",
    source: "AGENTS.md (raíz)",
    otherSide: "CLAUDE.md lo referencia (@AGENTS.md), no lo copia",
    mechanism: "import",
  },
  {
    piece: "Estándares · registry · docs",
    source: "factory/…",
    otherSide: "ambos runtimes leen el mismo fichero, tal cual",
    mechanism: "shared",
  },
  {
    piece: "Los 14 agentes del equipo",
    source: "plugin/agents/*.md",
    otherSide: ".codex/agents/*.toml · script generate-codex-agents.mjs (cabecera «do not edit»)",
    mechanism: "generated",
    derived: true,
  },
  {
    piece: "Manifests del plugin",
    source: "plugin/runtime/plugin-metadata.json",
    otherSide: ".claude-plugin/plugin.json + .codex-plugin/plugin.json · generados",
    mechanism: "generated",
    derived: true,
  },
  {
    piece: "Vocabulario de eventos",
    source: "plugin/runtime/event-vocabulary.json",
    otherSide: "Mission Control event-vocabulary.json · generado y drift-checked",
    mechanism: "generated",
    derived: true,
  },
];

function MechanismBadge({ mechanism }: { mechanism: Mechanism }): React.JSX.Element {
  const meta = MECHANISM_META[mechanism];
  return (
    <span
      data-testid={`sot-mechanism-${mechanism}`}
      data-mechanism={mechanism}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        fontWeight: 600,
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: "var(--radius-sm, 8px)",
        padding: "1px 7px",
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

function PieceRow({ piece, isFirst }: { piece: Piece; isFirst: boolean }): React.JSX.Element {
  return (
    <div
      data-testid={`sot-row-${piece.mechanism}`}
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "9px 0",
        borderTop: isFirst ? undefined : "1px solid var(--line)",
      }}
    >
      <div style={{ flex: "0 0 150px", minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{piece.piece}</div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-2)",
            fontFamily: "var(--font-mono, monospace)",
            marginTop: "2px",
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {piece.source}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <MechanismBadge mechanism={piece.mechanism} />
          {piece.derived === true && (
            <span
              data-testid="sot-derived-flag"
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--amber)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              proyección derivada verificada
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-2)",
            marginTop: "4px",
            lineHeight: 1.45,
          }}
        >
          {piece.otherSide}
        </div>
      </div>
    </div>
  );
}

export function SourceOfTruthMap(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-sot-map">
      {PIECES.map((piece, i) => (
        <PieceRow key={piece.piece} piece={piece} isFirst={i === 0} />
      ))}
    </div>
  );
}
