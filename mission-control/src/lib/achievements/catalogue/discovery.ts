/**
 * lib/achievements/catalogue/discovery.ts — Axis 1: Descubrimiento (FRD-10 v2)
 *
 * First-times across the pipeline. Every unlock derives from a verifiable signal
 * (statuses / ideas / the real event stream via the signals layer). See
 * docs/achievements.md §3 Axis 1. This file is the canonical authoring pattern for
 * the other axes.
 */

import { firstAtMinPhase, fromStamp, nthShipped, signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

export const DISCOVERY_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "El primer ladrillo",
    category: "Discovery",
    rarity: "Común",
    condition: "Creaste tu primer proyecto.",
    check: (data) => fromStamp(firstAtMinPhase(data, 0)),
  },
  {
    name: "El primer spec",
    category: "Discovery",
    rarity: "Común",
    condition: "Documentaste tu primer MVP.",
    check: (data) => fromStamp(firstAtMinPhase(data, 1)),
  },
  {
    name: "El debut del diseñador",
    category: "Discovery",
    rarity: "Común",
    condition: "Tus primeros mockups aprobados.",
    check: (data) => fromStamp(firstAtMinPhase(data, 1)),
  },
  {
    name: "El blueprintero",
    category: "Discovery",
    rarity: "Poco común",
    condition: "Tu primera arquitectura técnica.",
    check: (data) => fromStamp(firstAtMinPhase(data, 2)),
  },
  {
    name: "La primera orden",
    category: "Discovery",
    rarity: "Común",
    condition: "Cerraste tu primer work order en verde.",
    check: (data) => {
      const s = signalsFor(data).firstGreenDone;
      return s ? { unlocked: true, project: s.project, date: s.at } : { unlocked: false };
    },
  },
  {
    name: "El primer veredicto",
    category: "Discovery",
    rarity: "Poco común",
    condition: "Una revisión aprobó tu trabajo por primera vez.",
    check: (data) => {
      const s = signalsFor(data).firstReviewApproved;
      return s ? { unlocked: true, project: s.project, date: s.at } : { unlocked: false };
    },
  },
  {
    name: "El gran tour",
    category: "Discovery",
    rarity: "Raro",
    condition: "Recorriste las fases del pipeline de punta a punta.",
    check: (data) => fromStamp(nthShipped(data, 1)),
  },
  {
    name: "El día del lanzamiento",
    category: "Discovery",
    rarity: "Raro",
    condition: "Tu primer producto en producción.",
    check: (data) => fromStamp(nthShipped(data, 1)),
  },
  {
    name: "Iteración cero",
    category: "Discovery",
    rarity: "Poco común",
    condition: "Volviste a construir la fábrica más de una vez.",
    check: (data) => unlockWhen(data, signalsFor(data).builds >= 2),
  },
  {
    name: "El primer enjambre",
    category: "Discovery",
    rarity: "Poco común",
    condition: "Lanzaste tu primera corrida del motor de build.",
    check: (data) => {
      const s = signalsFor(data).firstBuildLaunch;
      return s ? { unlocked: true, project: s.project, date: s.at } : { unlocked: false };
    },
  },
  {
    name: "Memoria de la fábrica",
    category: "Discovery",
    rarity: "Raro",
    condition: "Registraste tu primer ADR / blueprint.",
    check: (data) => fromStamp(firstAtMinPhase(data, 2)),
  },
] as const;
