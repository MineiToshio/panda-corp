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
 * This module is a pure static constant — no side effects, no imports.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A specialist in a campaign phase. */
export interface TeamMember {
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
}

// ---------------------------------------------------------------------------
// Static data — index 0–5 maps to these 6 phases in order.
// ---------------------------------------------------------------------------

/** The 6 campaign phases in pipeline order (research → release). */
export const PHASES: ReadonlyArray<PhaseDefinition> = [
  {
    key: "research",
    name: "Research",
    description:
      "Exploración del problema, del mercado y de las oportunidades. El researcher sumerge la idea en datos reales antes de tomar ninguna decisión de producto.",
    reads: "Idea inicial (card de la base de ideas)",
    writes: "research.md — hallazgos, oportunidades y restricciones",
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
      "Implementación con TDD (RED → GREEN → refactor). El implementer construye cada work order; el reviewer verifica con tests adversariales; analytics instrumenta eventos clave.",
    reads: "Blueprint + ADRs + Build Plan + work orders",
    writes: "Código verificado (GREEN) — la app funcionando",
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
    ],
  },
  {
    key: "release",
    name: "Release",
    description:
      "Auditoría de seguridad y despliegue a producción. El auditor revisa vulnerabilidades; el devops orquesta el deploy y el plan de lanzamiento.",
    reads: "Código verificado (GREEN)",
    writes: "App en producción + plan de lanzamiento",
    team: [
      {
        role: "security-auditor",
        label: "Security Auditor",
        what: "Revisa vulnerabilidades, cabeceras, dependencias y la superficie de ataque antes del deploy.",
      },
      {
        role: "devops",
        label: "DevOps",
        what: "Orquesta el despliegue, la infraestructura y el plan de retorno al mercado.",
      },
    ],
  },
];
