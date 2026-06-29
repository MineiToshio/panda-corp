/**
 * lib/achievements/catalogue/mastery.ts — Axis 5: Maestría (FRD-10 v2)
 *
 * Scope & ownership across the portfolio (statuses-derived).
 * docs/achievements.md §3 Axis 5.
 */

import {
  countAtPhase,
  fromStamp,
  hasBothDeployTargets,
  hasTargetPlatform,
  nthShipped,
  phaseRows,
  shippedCount,
  unlockWhen,
} from "./helpers";
import type { UniqueDefinition } from "./types";

export const MASTERY_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "Coleccionista de estados",
    category: "Mastery",
    rarity: "Poco común",
    condition: "Un producto que pasó por todos los estados del tablero.",
    check: (data) => fromStamp(nthShipped(data, 1)),
  },
  {
    name: "El portafolio",
    category: "Mastery",
    rarity: "Raro",
    condition: "5 proyectos distintos creados.",
    check: (data) => unlockWhen(data, phaseRows(data).length >= 5),
  },
  {
    name: "Dos frentes",
    category: "Mastery",
    rarity: "Raro",
    condition: "2 proyectos en construcción al mismo tiempo.",
    check: (data) => unlockWhen(data, countAtPhase(data, "implementation") >= 2),
  },
  {
    name: "Multiplataforma",
    category: "Mastery",
    rarity: "Poco común",
    condition: "Lanzaste un producto responsive.",
    check: (data) => unlockWhen(data, hasTargetPlatform(data, "responsive")),
  },
  {
    name: "Interno y externo",
    category: "Mastery",
    rarity: "Raro",
    condition: "Lanzaste tanto un producto interno como uno externo.",
    check: (data) => unlockWhen(data, hasBothDeployTargets(data, "internal", "external")),
  },
  {
    name: "Maestro de obras",
    category: "Mastery",
    rarity: "Raro",
    condition: "5 productos lanzados.",
    check: (data) => fromStamp(nthShipped(data, 5)),
  },
  {
    name: "La trilogía",
    category: "Mastery",
    rarity: "Épico",
    condition: "3 productos vivos en producción al mismo tiempo.",
    check: (data) => fromStamp(nthShipped(data, 3)),
  },
  {
    name: "El arquitecto",
    category: "Mastery",
    rarity: "Épico",
    condition: "10 productos lanzados.",
    check: (data) => fromStamp(nthShipped(data, 10)),
  },
  {
    name: "El imperio",
    category: "Mastery",
    rarity: "Leyenda",
    condition: "5 productos vivos en producción al mismo tiempo.",
    check: (data) => unlockWhen(data, shippedCount(data) >= 5, nthShipped(data, 5)?.date),
  },
  {
    name: "El magnate digital",
    category: "Mastery",
    rarity: "Leyenda",
    condition: "25 productos lanzados.",
    check: (data) => fromStamp(nthShipped(data, 25)),
  },
] as const;
