/**
 * lib/achievements/catalogue/resilience.ts — Axis 8: Temple (FRD-10 v2)
 *
 * Recovering from setbacks (relaunches, reopened gates, findings).
 * docs/achievements.md §3 Axis 8.
 */

import { shippedCount, signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

export const RESILIENCE_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "De vuelta a la carga",
    category: "Resilience",
    rarity: "Poco común",
    condition: "Un build se reanudó tras una interrupción.",
    check: (data) => unlockWhen(data, signalsFor(data).relaunches >= 1),
  },
  {
    name: "No me rindo",
    category: "Resilience",
    rarity: "Poco común",
    condition: "Un work order rechazado terminó aprobado.",
    check: (data) => unlockWhen(data, signalsFor(data).maxReopenThenPass >= 1),
  },
  {
    name: "El bombero",
    category: "Resilience",
    rarity: "Poco común",
    condition: "Apagaste el fuego: hubo hallazgos y aun así pasaste gates.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, sig.findings >= 1 && sig.gatePasses >= 1);
    },
  },
  {
    name: "El ave fénix",
    category: "Resilience",
    rarity: "Raro",
    condition: "Un build se relanzó 3 veces y aun así terminó.",
    check: (data) => unlockWhen(data, signalsFor(data).maxRelaunchThenComplete >= 3),
  },
  {
    name: "La perseverancia",
    category: "Resilience",
    rarity: "Raro",
    condition: "Un work order rechazado 3 veces terminó aprobado.",
    check: (data) => unlockWhen(data, signalsFor(data).maxReopenThenPass >= 3),
  },
  {
    name: "Maratón sin caídas",
    category: "Resilience",
    rarity: "Raro",
    condition: "Un build completó 40+ work orders sin un solo relanzamiento.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, sig.builds >= 1 && sig.relaunches === 0 && sig.woClosed >= 40);
    },
  },
  {
    name: "Curtido en mil batallas",
    category: "Resilience",
    rarity: "Épico",
    condition: "Sobreviviste 10 relanzamientos de build.",
    check: (data) => unlockWhen(data, signalsFor(data).relaunches >= 10),
  },
  {
    name: "El temple del acero",
    category: "Resilience",
    rarity: "Leyenda",
    condition: "Lanzaste pese a 5 work orders reabiertos por el camino.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, sig.maxReopenThenPass >= 5 && shippedCount(data) >= 1);
    },
  },
] as const;
