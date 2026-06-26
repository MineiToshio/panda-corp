/**
 * ladderMeta — presentation copy for the "Rangos" tab (RankLadder).
 *
 * Two lookups that enrich the rank ladder so each row earns its horizontal space
 * (UI/UX research 2026-06-25: enrich the row, don't flee to a grid):
 *   - FAMILY_FLAVOR: a one-line RPG flavor caption per emblem family (keyed by the
 *     sprite slug, so the 3 grades of a family share one line).
 *   - ERAS: the 40 ranks grouped into named narrative bands ("eras") so the climb
 *     stays scannable and the summit reads as deliberately distant.
 *
 * Spanish copy (owner-facing). Feature-local — only the Rangos tab consumes it.
 */

/** One-line flavor caption per rank-family sprite slug. */
const FAMILY_FLAVOR: Readonly<Record<string, string>> = {
  human: "El punto de partida — todo gremio empieza con una sola persona.",
  "dawn-seeker": "Buscas la primera luz; el camino apenas comienza.",
  lightbearer: "Llevas la llama que guía a quienes vienen detrás.",
  oathkeeper: "Tu palabra es ley; el juramento no se rompe.",
  glyphwarden: "Custodias los glifos que dan forma a la obra.",
  "aether-warden": "Dominas la energía que fluye entre los mundos.",
  shardbearer: "Portas una esquirla de poder puro.",
  "knight-radiant": "Tu espada brilla con la luz de mil victorias.",
  realmcaller: "Invocas reinos enteros con una sola orden.",
  "dawn-herald": "Anuncias el amanecer de una nueva era.",
  stormlord: "El trueno responde a tu llamada.",
  ascendant: "Te elevas por encima de lo mortal.",
  "phoenix-ascendant": "Renaces de tus cenizas, más fuerte cada vez.",
  "leviathan-lord": "Las profundidades te obedecen.",
  "crimson-dragonlord": "El dragón carmesí vuela bajo tu estandarte.",
  "celestial-warden": "Vigilas el gremio desde las estrellas.",
  "dawn-sovereign": "Reinas sobre el alba eterna.",
  "eternal-oathbearer": "La cima — el juramento que nunca termina.",
} as const;

/** A named band of ranks (by 0-based rank index, inclusive). */
export type Era = {
  readonly name: string;
  readonly tagline: string;
  /** First rank index in the era (0-based, inclusive). */
  readonly from: number;
  /** Last rank index in the era (0-based, inclusive). */
  readonly to: number;
};

/**
 * The 40 ranks grouped into 6 narrative eras. Ranges are contiguous and cover the
 * full ladder [0, 39] so every rank belongs to exactly one era.
 */
export const ERAS: readonly Era[] = [
  { name: "El despertar", tagline: "Los primeros pasos del gremio", from: 0, to: 3 },
  { name: "Los portadores", tagline: "Llevar la luz a la obra", from: 4, to: 6 },
  {
    name: "Los guardianes",
    tagline: "Custodios del juramento, los glifos y el éter",
    from: 7,
    to: 15,
  },
  { name: "Los campeones", tagline: "Esquirlas, espadas y reinos", from: 16, to: 24 },
  { name: "Los ascendidos", tagline: "Heraldos, tormentas y trascendencia", from: 25, to: 33 },
  { name: "La trascendencia", tagline: "Más allá de lo mortal — la cima", from: 34, to: 39 },
] as const;

/** The flavor caption for a sprite family (empty string when unknown). */
export function flavorFor(sprite: string | undefined): string {
  return sprite !== undefined ? (FAMILY_FLAVOR[sprite] ?? "") : "";
}
