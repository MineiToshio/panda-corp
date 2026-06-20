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
      "Creación del sistema visual y la microcopia con Claude Design. Diseñador y copywriter colaboran para que el producto sea bello, accesible y coherente en lenguaje.",
    reads: "PRD + FRDs",
    writes:
      "design-tokens + DESIGN.md + components.md (inventario de componentes) + mocks/FDD por FRD + microcopia",
    team: [
      {
        role: "designer",
        label: "Designer",
        what: "Define el sistema de diseño con Claude Design (DESIGN.md + tokens + components.md) y los mocks por FRD.",
      },
      {
        role: "copywriter",
        label: "Copywriter",
        what: "Escribe la voz del producto y el microcopy (botones, vacíos, errores, onboarding).",
      },
    ],
  },
  {
    key: "architecture",
    name: "Arquitectura",
    description:
      "Diseño técnico de la solución. El arquitecto planifica la fundación (primitivas compartidas) y los artefactos de archivo de cada work order, luego escribe el blueprint, los ADRs y el Build Plan.",
    reads: "design-tokens + DESIGN.md + components.md + mocks/FDD por FRD",
    writes:
      "Blueprint + ADRs + Build Plan + work orders (con artifacts disjuntos por WO para oleadas sin colisión)",
    team: [
      {
        role: "architect",
        label: "Architect",
        what: "Planifica la fundación (primitivas compartidas), define los artifacts disjuntos de cada WO, escribe el blueprint, ADRs y Build Plan.",
      },
    ],
  },
  {
    key: "build",
    name: "Construcción",
    description:
      "La party forja FRD por FRD: fundación primero, luego N implementers en oleadas disjuntas por archivo (sin colisión); el Juez aplica 4 lentes + gate visual vs. mock; el motor commitea cada oleada (Option-B). TDD: RED → GREEN → refactor.",
    reads: "Blueprint + ADRs + Build Plan + work orders",
    writes: "Código verificado (GREEN) — la app funcionando",
    team: [
      {
        role: "implementer",
        label: "Implementer",
        what: "Construye cada WO end-to-end con TDD; bucle de fidelidad vs. mock (DR-056); reutiliza el inventario de componentes; escribe el Status Note al cerrar.",
      },
      {
        role: "reviewer",
        label: "Reviewer",
        what: "Gate por FRD: 4 lentes (corrección · seguridad · calidad · runtime/visual), tests adversariales, gate visual vs. mock.",
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
