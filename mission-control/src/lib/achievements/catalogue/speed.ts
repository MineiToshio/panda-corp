/**
 * lib/achievements/catalogue/speed.ts — Axis 2: Velocidad (FRD-10 v2)
 *
 * Turnaround & throughput bursts. Honest "speed" = real BUILD duration
 * (BuildLaunch→BuildComplete) + green-WO bursts — derivable from the event stream
 * (idea→launch wall-clock has no verifiable start timestamp, so it is NOT used).
 * docs/achievements.md §3 Axis 2.
 */

import { fromStamp, hasBurst, signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

/** Build completed within `hours` (and a build duration exists). */
function buildWithin(data: Parameters<UniqueDefinition["check"]>[0], hours: number): boolean {
  const h = signalsFor(data).fastestBuildHours;
  return h > 0 && h <= hours;
}

export const SPEED_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "El primer impulso",
    category: "Speed",
    rarity: "Común",
    condition: "Cerraste 5 work orders en verde.",
    check: (data) => unlockWhen(data, signalsFor(data).greenDoneEvents >= 5),
  },
  {
    name: "Sprint decente",
    category: "Speed",
    rarity: "Común",
    condition: "Completaste tu primer build de punta a punta.",
    check: (data) => unlockWhen(data, signalsFor(data).builds >= 1),
  },
  {
    name: "Sin frenos",
    category: "Speed",
    rarity: "Poco común",
    condition: "3 work orders cerrados dentro de una misma hora.",
    check: (data) => fromStamp(hasBurst(data, 3, 1)),
  },
  {
    name: "El sprint relámpago",
    category: "Speed",
    rarity: "Poco común",
    condition: "10 work orders cerrados en menos de 24 horas.",
    check: (data) => fromStamp(hasBurst(data, 10, 24)),
  },
  {
    name: "Build en un día",
    category: "Speed",
    rarity: "Raro",
    condition: "Un build completo en menos de 24 horas.",
    check: (data) => unlockWhen(data, buildWithin(data, 24)),
  },
  {
    name: "La maratón",
    category: "Speed",
    rarity: "Raro",
    condition: "20 work orders cerrados en una sola sesión (24 horas).",
    check: (data) => fromStamp(hasBurst(data, 20, 24)),
  },
  {
    name: "El cohete",
    category: "Speed",
    rarity: "Raro",
    condition: "Un build completo en menos de 12 horas.",
    check: (data) => unlockWhen(data, buildWithin(data, 12)),
  },
  {
    name: "48 horas de locura",
    category: "Speed",
    rarity: "Épico",
    condition: "Un build completo en menos de 48 horas.",
    check: (data) => unlockWhen(data, buildWithin(data, 48)),
  },
  {
    name: "La semana perfecta",
    category: "Speed",
    rarity: "Épico",
    condition: "Un build completo en menos de 6 horas.",
    check: (data) => unlockWhen(data, buildWithin(data, 6)),
  },
  {
    name: "Modo dios activado",
    category: "Speed",
    rarity: "Leyenda",
    condition: "Un build completo en menos de 2 horas.",
    check: (data) => unlockWhen(data, buildWithin(data, 2)),
  },
] as const;
