/**
 * CampaignPipeline — static phase model.
 *
 * Faithful to party-redesign-spec.md §2 and FRD-02 (REQ-02-010, AC-02-010.4).
 * Each phase defines its key, name, description, LEE (reads), ESCRIBE (writes)
 * and the WHOLE specialist team (every member, role key + label + what they do).
 *
 * Teams:
 *   research      → researcher
 *   product       → product-manager
 *   design        → designer + copywriter
 *   architecture  → architect
 *   build         → implementer + reviewer + analytics
 *   release       → security-auditor + devops
 *
 * Pure static data — no side effects. The command modes (spec / implement) come from
 * the shared command-modes module (DR-092: one source for both this board view and the
 * project workspace Commands tab).
 */

import {
  type CommandMode,
  IMPLEMENT_MODE_DEFAULT_LABEL,
  IMPLEMENT_MODES,
  SPEC_MODE_DEFAULT_LABEL,
  SPEC_MODES,
} from "@/lib/command-modes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A specialist in a campaign phase. */
interface TeamMember {
  /** Machine-readable role key (hyphenated, e.g. "product-manager"). */
  role: string;
  /** Human-readable display label (e.g. "Product Manager"). */
  label: string;
  /** One-line description of what this specialist does in this phase. */
  what: string;
}

/** Full definition of one campaign phase. */
export interface PhaseDefinition {
  /** Unique key — used for data-testid and logic. */
  key: string;
  /** Display name in Spanish. */
  name: string;
  /** Phase description in Spanish. */
  description: string;
  /** Deliverable read from the previous phase (LEE). */
  reads: string;
  /** Deliverable written for the next phase (ESCRIBE). */
  writes: string;
  /** Entire specialist team for this phase (every member, AC-02-010.4). */
  team: ReadonlyArray<TeamMember>;
  /**
   * The runnable commands at this phase — shown as "Qué puedes correr" in the ficha. The FIRST is the
   * advance / recommended step; the rest are this phase's other options. A `<idea>` token in a command
   * is substituted with the project slug for copy-paste; an optional `hint` adds a one-line note, and
   * optional `modes` render an inline flag selector that the user folds into the copied command.
   */
  commands: ReadonlyArray<{
    label: string;
    command: string;
    hint?: string;
    modes?: ReadonlyArray<CommandMode>;
    /** Label of the mode select's first "no flag" option (names the field + the default). */
    modeDefaultLabel?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Static data — index 0–5 maps to these 6 phases in order.
// ---------------------------------------------------------------------------

/** The 6 campaign phases in pipeline order (research → release). */
export const PHASES: ReadonlyArray<PhaseDefinition> = [
  {
    key: "research",
    name: "Investigación",
    description:
      "Exploración del problema, del mercado y de las oportunidades. El researcher sumerge la idea en datos reales antes de tomar ninguna decisión de producto.",
    reads: "Idea inicial (card de la base de ideas)",
    writes: "research.md — hallazgos, oportunidades y restricciones",
    commands: [
      {
        label: "Documenta el MVP (research + PRD + FRDs)",
        command: "/pandacorp:spec <idea>",
        hint: "Elige un modo de preguntas, o déjalo así y el skill usa el default por origen.",
        modes: SPEC_MODES,
        modeDefaultLabel: SPEC_MODE_DEFAULT_LABEL,
      },
      { label: "Sigue explorando la idea en conversación", command: "/pandacorp:explore <idea>" },
    ],
    team: [
      {
        role: "researcher",
        label: "Researcher",
        what: "Investiga el mercado, la competencia y los dolores del usuario; produce research.md.",
      },
    ],
  },
  {
    key: "product",
    name: "Producto",
    description:
      "Definición del producto mínimo viable. El product manager transforma los hallazgos en requisitos EARS y criterios de aceptación medibles.",
    reads: "research.md",
    writes: "PRD + FRDs (requisitos EARS con criterios de aceptación)",
    commands: [
      { label: "Diseña la interfaz y los tokens", command: "/pandacorp:design" },
      {
        label: "Pule el PRD/FRDs (re-corre el spec)",
        command: "/pandacorp:spec <idea>",
        modes: SPEC_MODES,
        modeDefaultLabel: SPEC_MODE_DEFAULT_LABEL,
      },
    ],
    team: [
      {
        role: "product-manager",
        label: "Product Manager",
        what: "Redacta el PRD y los FRDs con criterios EARS; define el alcance y las métricas de éxito.",
      },
    ],
  },
  {
    key: "design",
    name: "Diseño",
    description:
      "Creación del sistema visual y la microcopia. Diseñador y copywriter colaboran para que el producto sea bello, accesible y coherente en lenguaje.",
    reads: "PRD + FRDs",
    writes: "Mockups, design tokens y microcopia",
    commands: [
      { label: "Define la arquitectura y los work orders", command: "/pandacorp:blueprint" },
      { label: "Itera el diseño", command: "/pandacorp:design" },
    ],
    team: [
      {
        role: "designer",
        label: "Designer",
        what: "Crea los mockups, define los tokens de diseño y asegura la consistencia visual.",
      },
      {
        role: "copywriter",
        label: "Copywriter",
        what: "Redacta la microcopia, los mensajes de error y el texto de la interfaz.",
      },
    ],
  },
  {
    key: "architecture",
    name: "Arquitectura",
    description:
      "Diseño técnico de la solución. El arquitecto traduce los requisitos en ADRs, plano de implementación y órdenes de trabajo para el equipo de build.",
    reads: "Mockups, design tokens y microcopia",
    writes: "Blueprint + ADRs + Build Plan + work orders",
    commands: [
      {
        label: "Construye con TDD",
        command: "/pandacorp:implement",
        modes: IMPLEMENT_MODES,
        modeDefaultLabel: IMPLEMENT_MODE_DEFAULT_LABEL,
      },
      { label: "Ajusta la arquitectura / work orders", command: "/pandacorp:blueprint" },
    ],
    team: [
      {
        role: "architect",
        label: "Architect",
        what: "Diseña la arquitectura, escribe los ADRs, define el build plan y genera los work orders.",
      },
    ],
  },
  {
    key: "build",
    name: "Construcción",
    description:
      "Implementación con TDD (RED → GREEN → refactor) y, como último paso, el endurecimiento: el security-auditor revisa la seguridad, el reviewer cierra la calidad y analytics instrumenta las métricas. El implementer construye cada work order.",
    reads: "Blueprint + ADRs + Build Plan + work orders",
    writes: "Código verificado y endurecido (GREEN) — la app lista para lanzar",
    commands: [
      { label: "Lanza (interno o externo)", command: "/pandacorp:release" },
      {
        label: "Reanuda / continúa el build",
        command: "/pandacorp:implement",
        modes: IMPLEMENT_MODES,
        modeDefaultLabel: IMPLEMENT_MODE_DEFAULT_LABEL,
      },
      { label: "Reporta un bug encontrado probando", command: "/pandacorp:bug" },
      { label: "Encola un cambio para el build", command: "/pandacorp:change" },
    ],
    team: [
      {
        role: "implementer",
        label: "Implementer",
        what: "Construye cada work order end-to-end con TDD; escribe el Status Note al cerrar.",
      },
      {
        role: "reviewer",
        label: "Reviewer",
        what: "Ejecuta el gate de cada FRD: tests adversariales, 3 lentes (corrección/seguridad/calidad).",
      },
      {
        role: "analytics",
        label: "Analytics",
        what: "Instrumenta los eventos clave para métricas de negocio y telemetría.",
      },
      {
        role: "security-auditor",
        label: "Security Auditor",
        what: "Audita seguridad, dependencias y superficie de ataque — el endurecimiento final, último paso de la construcción antes de lanzar.",
      },
    ],
  },
  {
    key: "release",
    name: "Release",
    description:
      "El producto YA está lanzado: desplegado a un host externo (Vercel/AWS) o publicado como herramienta interna en la red. El devops orquesta el despliegue y el plan de lanzamiento; desde aquí se itera con métricas reales.",
    reads: "Código verificado y endurecido (GREEN)",
    writes: "App lanzada (interna o externa) + plan de lanzamiento",
    commands: [
      { label: "Agrega una feature o cambio", command: "/pandacorp:iterate" },
      {
        label: "Revisa métricas vs hipótesis (kill/hold/double-down)",
        command: "/pandacorp:review-launch",
      },
      { label: "Empaqueta un hito grande (v2…)", command: "/pandacorp:new-version" },
      {
        label: "Reconcilia los docs desde cambios a mano en el código",
        command: "/pandacorp:sync",
      },
    ],
    team: [
      {
        role: "devops",
        label: "DevOps",
        what: "Orquesta el despliegue (interno en la red o externo a un host) y el plan de retorno al mercado.",
      },
    ],
  },
];
