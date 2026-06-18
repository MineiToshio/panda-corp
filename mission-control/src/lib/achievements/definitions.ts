/**
 * lib/achievements/definitions.ts — Chain data tables (FRD-10)
 *
 * Pure data + the chain definition types. No I/O, never mutated at runtime.
 * Split out of achievements.ts to keep files ≤500 lines.
 * The unique/secret definition tables (which carry unlock predicates) live in ./predicates.
 *
 * Thresholds/tier names from docs/achievements.md. Prototype data tables in prototype/index.html.
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Chain data tables (from docs/achievements.md + prototype data)
// ─────────────────────────────────────────────────────────────────────────────

/** Tier entry: [threshold, name] pair (thresholds/names from docs/achievements.md). */
export type TierEntry = {
  readonly threshold: number;
  readonly name: string;
};

/** Chain definition (data table — never mutated at runtime). */
export type ChainDefinition = {
  readonly statKey: string;
  readonly label: string;
  readonly tiers: readonly TierEntry[];
  /** True for "lower is better" chains (speed / record idea→launch). */
  readonly lowerIsBetter?: boolean;
};

/**
 * All cumulative chain definitions.
 *
 * Source: docs/achievements.md §2 (thresholds) and prototype/index.html CHAINS array (tier names).
 * Tier names are fun and scale in grandeur per FRD-10.
 */
export const CHAIN_DEFINITIONS: readonly ChainDefinition[] = [
  {
    statKey: "shipped",
    label: "Productos lanzados",
    tiers: [
      { threshold: 1, name: "El primer ladrillo" },
      { threshold: 5, name: "Maestro de obras" },
      { threshold: 10, name: "El arquitecto" },
      { threshold: 25, name: "El magnate digital" },
      { threshold: 50, name: "El oráculo de la fábrica" },
    ],
  },
  {
    statKey: "ideas",
    label: "Ideas capturadas",
    tiers: [
      { threshold: 5, name: "Mente inquieta" },
      { threshold: 20, name: "Máquina de ideas" },
      { threshold: 50, name: "El ideólogo" },
      { threshold: 100, name: "La tormenta de ideas" },
    ],
  },
  {
    statKey: "workorders",
    label: "Work orders completados",
    tiers: [
      { threshold: 10, name: "Capataz novato" },
      { threshold: 50, name: "Jefe de fábrica" },
      { threshold: 200, name: "El fordismo digital" },
      { threshold: 500, name: "Maestro de ensamblaje" },
      { threshold: 1000, name: "La gran máquina" },
    ],
  },
  {
    statKey: "phases",
    label: "Fases completadas",
    tiers: [
      { threshold: 5, name: "Pipeline novato" },
      { threshold: 25, name: "Flujo continuo" },
      { threshold: 75, name: "El proceso es el producto" },
      { threshold: 200, name: "Maestro del pipeline" },
    ],
  },
  {
    statKey: "iterations",
    label: "Iteraciones desplegadas",
    tiers: [
      { threshold: 1, name: "El primer parche" },
      { threshold: 10, name: "Amigo del usuario" },
      { threshold: 25, name: "El hacedor incansable" },
      { threshold: 50, name: "El producto vivo" },
    ],
  },
  {
    statKey: "flawless",
    label: "Lanzamientos impecables",
    tiers: [
      { threshold: 1, name: "Primera vez sin reparos" },
      { threshold: 3, name: "Artesano" },
      { threshold: 7, name: "Orfebre del software" },
      { threshold: 15, name: "Manos de cirujano" },
    ],
  },
  {
    statKey: "discarded",
    label: "Ideas descartadas",
    tiers: [
      { threshold: 5, name: "El editor" },
      { threshold: 20, name: "Cirujano de ideas" },
      { threshold: 50, name: "El filtro implacable" },
      { threshold: 100, name: "El asesino de darlings" },
    ],
  },
  {
    statKey: "prds",
    label: "PRDs escritos",
    tiers: [
      { threshold: 3, name: "Escribidor de requisitos" },
      { threshold: 10, name: "El visionario documentado" },
      { threshold: 25, name: "El PM fantasma" },
      { threshold: 50, name: "La biblia del producto" },
    ],
  },
  {
    statKey: "adrs",
    label: "ADRs registrados",
    tiers: [
      { threshold: 3, name: "El que toma notas" },
      { threshold: 15, name: "Memoria institucional" },
      { threshold: 40, name: "El libro de la fábrica" },
      { threshold: 100, name: "El gran grimorio" },
    ],
  },
  {
    statKey: "agents",
    label: "Agentes coordinados",
    tiers: [
      { threshold: 3, name: "Equipo mínimo" },
      { threshold: 6, name: "El líder de raid" },
      { threshold: 10, name: "Comandante de fábrica" },
      { threshold: 15, name: "El maestro titiritero" },
    ],
  },
  {
    statKey: "streak",
    label: "Racha récord (semanas)",
    tiers: [
      { threshold: 2, name: "Semanas seguidas" },
      { threshold: 8, name: "El constructor constante" },
      { threshold: 26, name: "Medio año sin parar" },
      { threshold: 52, name: "El año del fundador" },
    ],
  },
  {
    statKey: "speed",
    label: "Récord idea→launch (días)",
    lowerIsBetter: true,
    tiers: [
      { threshold: 30, name: "Sprint decente" },
      { threshold: 14, name: "El cohete" },
      { threshold: 7, name: "La semana perfecta" },
      { threshold: 3, name: "Modo dios activado" },
    ],
  },
] as const;
