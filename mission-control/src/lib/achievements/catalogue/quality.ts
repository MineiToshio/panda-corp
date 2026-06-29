/**
 * lib/achievements/catalogue/quality.ts — Axis 3: Calidad (FRD-10 v2)
 *
 * Flawless & zero-rejection. Derives from gate/review verdicts + findings.
 * docs/achievements.md §3 Axis 3.
 */

import { shippedCount, signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

export const QUALITY_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "Pulcro",
    category: "Quality",
    rarity: "Común",
    condition: "Pasaste tu primer gate de revisión.",
    check: (data) => {
      const s = signalsFor(data).firstGatePass;
      return s ? { unlocked: true, project: s.project, date: s.at } : { unlocked: false };
    },
  },
  {
    name: "Revisado y bendecido",
    category: "Quality",
    rarity: "Común",
    condition: "Una revisión aprobó tu trabajo.",
    check: (data) => unlockWhen(data, signalsFor(data).reviewsApproved >= 1),
  },
  {
    name: "Primer intento",
    category: "Quality",
    rarity: "Raro",
    condition: "Un gate aprobado sin un solo reabierto.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, sig.flawlessGates >= 1, sig.firstGatePass?.at);
    },
  },
  {
    name: "Sin una mancha",
    category: "Quality",
    rarity: "Poco común",
    condition: "3 gates impecables (sin reabiertos).",
    check: (data) => unlockWhen(data, signalsFor(data).flawlessGates >= 3),
  },
  {
    name: "Cero hallazgos",
    category: "Quality",
    rarity: "Raro",
    condition: "Pasaste gates sin que la revisión levantara hallazgos.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, sig.gatePasses >= 1 && sig.findings === 0);
    },
  },
  {
    name: "Manos firmes",
    category: "Quality",
    rarity: "Raro",
    condition: "5 gates impecables a lo largo de la fábrica.",
    check: (data) => unlockWhen(data, signalsFor(data).flawlessGates >= 5),
  },
  {
    name: "Lanzamiento impecable",
    category: "Quality",
    rarity: "Épico",
    condition: "Un producto en producción con gates impecables.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, shippedCount(data) >= 1 && sig.flawlessGates >= 1);
    },
  },
  {
    name: "El perfeccionista práctico",
    category: "Quality",
    rarity: "Épico",
    condition: "7 gates impecables.",
    check: (data) => unlockWhen(data, signalsFor(data).flawlessGates >= 7),
  },
  {
    name: "Calidad sostenida",
    category: "Quality",
    rarity: "Épico",
    condition: "25 gates de revisión aprobados.",
    check: (data) => unlockWhen(data, signalsFor(data).gatePasses >= 25),
  },
  {
    name: "El cirujano",
    category: "Quality",
    rarity: "Leyenda",
    condition: "10 gates impecables.",
    check: (data) => unlockWhen(data, signalsFor(data).flawlessGates >= 10),
  },
] as const;
