/**
 * lib/achievements/definitions.ts — Chain data tables (FRD-10)
 *
 * Pure data + the chain definition types. No I/O, never mutated at runtime.
 * Split out of achievements.ts to keep files ≤500 lines.
 * The unique/secret definition tables (which carry unlock predicates) live in ./predicates.
 *
 * v2 (WO-10-013): chains grouped into narrative **sagas** + new chains anchored to the real
 * signal layer. Thresholds/tier names from docs/achievements.md §6.
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Chain data tables (from docs/achievements.md + prototype data)
// ─────────────────────────────────────────────────────────────────────────────

/** Tier entry: [threshold, name] pair (thresholds/names from docs/achievements.md). */
export type TierEntry = {
  readonly threshold: number;
  readonly name: string;
};

/** Narrative saga a chain belongs to (Misiones grouping, FRD-10 v2 §6). */
export type Saga = "La Construcción" | "Las Ideas" | "El Oficio" | "El Gremio" | "El Tiempo";

/** Display order of the sagas on the Misiones tab. */
export const SAGA_ORDER: readonly Saga[] = [
  "La Construcción",
  "Las Ideas",
  "El Oficio",
  "El Gremio",
  "El Tiempo",
];

/** Icon per saga (Tabler). */
export const SAGA_ICONS: Record<Saga, string> = {
  "La Construcción": "ti-building-factory-2",
  "Las Ideas": "ti-bulb",
  "El Oficio": "ti-award",
  "El Gremio": "ti-users-group",
  "El Tiempo": "ti-clock-hour-4",
};

/** Chain definition (data table — never mutated at runtime). */
export type ChainDefinition = {
  readonly statKey: string;
  readonly label: string;
  /** Narrative saga this chain belongs to (Misiones grouping). */
  readonly saga: Saga;
  readonly tiers: readonly TierEntry[];
  /** True for "lower is better" chains (speed / record idea→launch). */
  readonly lowerIsBetter?: boolean;
};

/**
 * All cumulative chain definitions, in saga order.
 *
 * Source: docs/achievements.md §6 (thresholds + sagas). Tier names scale in grandeur (FRD-10).
 * v2 re-anchors every event-based chain to the real signal layer (see stats.ts).
 */
export const CHAIN_DEFINITIONS: readonly ChainDefinition[] = [
  // ── Saga "La Construcción" ───────────────────────────────────────────────
  {
    statKey: "shipped",
    label: "Productos lanzados",
    saga: "La Construcción",
    tiers: [
      { threshold: 1, name: "El primer ladrillo" },
      { threshold: 5, name: "Maestro de obras" },
      { threshold: 10, name: "El arquitecto" },
      { threshold: 25, name: "El magnate digital" },
      { threshold: 50, name: "El oráculo de la fábrica" },
    ],
  },
  {
    statKey: "workorders",
    label: "Work orders completados",
    saga: "La Construcción",
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
    saga: "La Construcción",
    tiers: [
      { threshold: 5, name: "Pipeline novato" },
      { threshold: 25, name: "Flujo continuo" },
      { threshold: 75, name: "El proceso es el producto" },
      { threshold: 200, name: "Maestro del pipeline" },
    ],
  },
  {
    statKey: "builds",
    label: "Builds completados",
    saga: "La Construcción",
    tiers: [
      { threshold: 1, name: "Primera corrida" },
      { threshold: 5, name: "Línea de montaje" },
      { threshold: 15, name: "Fábrica en marcha" },
      { threshold: 40, name: "La gran cadena" },
    ],
  },
  {
    statKey: "subagents",
    label: "Subagentes coordinados",
    saga: "La Construcción",
    tiers: [
      { threshold: 50, name: "Pequeña cuadrilla" },
      { threshold: 250, name: "El pelotón" },
      { threshold: 1000, name: "El batallón" },
      { threshold: 3000, name: "El enjambre infinito" },
    ],
  },
  // ── Saga "Las Ideas" ─────────────────────────────────────────────────────
  {
    statKey: "ideas",
    label: "Ideas capturadas",
    saga: "Las Ideas",
    tiers: [
      { threshold: 5, name: "Mente inquieta" },
      { threshold: 20, name: "Máquina de ideas" },
      { threshold: 50, name: "El ideólogo" },
      { threshold: 100, name: "La tormenta de ideas" },
    ],
  },
  {
    statKey: "discarded",
    label: "Ideas descartadas",
    saga: "Las Ideas",
    tiers: [
      { threshold: 5, name: "El editor" },
      { threshold: 20, name: "Cirujano de ideas" },
      { threshold: 50, name: "El filtro implacable" },
      { threshold: 100, name: "El asesino de darlings" },
    ],
  },
  {
    statKey: "prds",
    label: "PRDs / specs",
    saga: "Las Ideas",
    tiers: [
      { threshold: 1, name: "Escribidor de requisitos" },
      { threshold: 5, name: "El visionario documentado" },
      { threshold: 15, name: "El PM fantasma" },
      { threshold: 30, name: "La biblia del producto" },
    ],
  },
  {
    statKey: "adrs",
    label: "ADRs / blueprints",
    saga: "Las Ideas",
    tiers: [
      { threshold: 1, name: "El que toma notas" },
      { threshold: 5, name: "Memoria institucional" },
      { threshold: 15, name: "El libro de la fábrica" },
      { threshold: 40, name: "El gran grimorio" },
    ],
  },
  // ── Saga "El Oficio" ─────────────────────────────────────────────────────
  {
    statKey: "flawless",
    label: "Lanzamientos impecables",
    saga: "El Oficio",
    tiers: [
      { threshold: 1, name: "Primera vez sin reparos" },
      { threshold: 3, name: "Artesano" },
      { threshold: 7, name: "Orfebre del software" },
      { threshold: 15, name: "Manos de cirujano" },
    ],
  },
  {
    statKey: "gates",
    label: "Gates verdes",
    saga: "El Oficio",
    tiers: [
      { threshold: 1, name: "Primer visto bueno" },
      { threshold: 10, name: "El inspector" },
      { threshold: 25, name: "Maestro de calidad" },
      { threshold: 60, name: "El sello verde" },
    ],
  },
  {
    statKey: "reviews",
    label: "Reviews aprobadas",
    saga: "El Oficio",
    tiers: [
      { threshold: 1, name: "Primera aprobación" },
      { threshold: 10, name: "Revisado y aprobado" },
      { threshold: 40, name: "Aval del gremio" },
      { threshold: 100, name: "Aprobación unánime" },
    ],
  },
  {
    statKey: "findings",
    label: "Hallazgos atendidos",
    saga: "El Oficio",
    tiers: [
      { threshold: 1, name: "Primer hallazgo" },
      { threshold: 10, name: "Cazador de bugs" },
      { threshold: 30, name: "Exterminador" },
      { threshold: 80, name: "El gran filtro" },
    ],
  },
  // ── Saga "El Gremio" ─────────────────────────────────────────────────────
  {
    statKey: "agents",
    label: "Agentes coordinados",
    saga: "El Gremio",
    tiers: [
      { threshold: 3, name: "Equipo mínimo" },
      { threshold: 6, name: "El líder de raid" },
      { threshold: 10, name: "Comandante de fábrica" },
      { threshold: 15, name: "El maestro titiritero" },
    ],
  },
  {
    statKey: "modes",
    label: "Modos de build usados",
    saga: "El Gremio",
    tiers: [
      { threshold: 1, name: "Un modo" },
      { threshold: 2, name: "Dos modos" },
      { threshold: 3, name: "Tres modos" },
      { threshold: 4, name: "Maestro de los modos" },
    ],
  },
  {
    statKey: "iterations",
    label: "Relanzamientos sobrevividos",
    saga: "El Gremio",
    tiers: [
      { threshold: 1, name: "De vuelta a la carga" },
      { threshold: 3, name: "El ave fénix" },
      { threshold: 8, name: "Imparable" },
      { threshold: 20, name: "El temple del acero" },
    ],
  },
  // ── Saga "El Tiempo" ─────────────────────────────────────────────────────
  {
    statKey: "streak",
    label: "Racha récord (semanas)",
    saga: "El Tiempo",
    tiers: [
      { threshold: 2, name: "Semanas seguidas" },
      { threshold: 8, name: "El constructor constante" },
      { threshold: 26, name: "Medio año sin parar" },
      { threshold: 52, name: "El año del fundador" },
    ],
  },
  {
    statKey: "activedays",
    label: "Días activos",
    saga: "El Tiempo",
    tiers: [
      { threshold: 3, name: "Primeros pasos" },
      { threshold: 10, name: "El constante" },
      { threshold: 30, name: "El imparable" },
      { threshold: 100, name: "El incansable" },
    ],
  },
  {
    statKey: "speed",
    label: "Récord idea→launch (días)",
    saga: "El Tiempo",
    lowerIsBetter: true,
    tiers: [
      { threshold: 30, name: "Sprint decente" },
      { threshold: 14, name: "El cohete" },
      { threshold: 7, name: "La semana perfecta" },
      { threshold: 3, name: "Modo dios activado" },
    ],
  },
] as const;
