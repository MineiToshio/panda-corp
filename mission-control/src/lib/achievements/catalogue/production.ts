/**
 * lib/achievements/catalogue/production.ts — Axis 6: Producción (FRD-10 v2)
 *
 * Sheer cumulative output (volume axis → mostly Común/Poco común).
 * docs/achievements.md §3 Axis 6.
 */

import { countAtMinPhase, ideasWhere, signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

/** Phase rank for "advanced past product" (design = 1). */
const DESIGN_RANK = 1;

export const PRODUCTION_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "Capataz novato",
    category: "Production",
    rarity: "Común",
    condition: "10 work orders completados.",
    check: (data) => unlockWhen(data, signalsFor(data).woClosed >= 10),
  },
  {
    name: "Mente inquieta",
    category: "Production",
    rarity: "Común",
    condition: "5 ideas capturadas.",
    check: (data) => unlockWhen(data, ideasWhere(data, () => true) >= 5),
  },
  {
    name: "Pipeline novato",
    category: "Production",
    rarity: "Común",
    condition: "5 proyectos avanzados más allá de producto.",
    check: (data) => unlockWhen(data, countAtMinPhase(data, DESIGN_RANK) >= 5),
  },
  {
    name: "El editor",
    category: "Production",
    rarity: "Común",
    condition: "5 ideas descartadas.",
    check: (data) => unlockWhen(data, ideasWhere(data, (s) => s === "discarded") >= 5),
  },
  {
    name: "Jefe de fábrica",
    category: "Production",
    rarity: "Poco común",
    condition: "50 work orders completados.",
    check: (data) => unlockWhen(data, signalsFor(data).woClosed >= 50),
  },
  {
    name: "Máquina de ideas",
    category: "Production",
    rarity: "Poco común",
    condition: "20 ideas capturadas.",
    check: (data) => unlockWhen(data, ideasWhere(data, () => true) >= 20),
  },
  {
    name: "Flujo continuo",
    category: "Production",
    rarity: "Poco común",
    condition: "25 proyectos avanzados más allá de producto.",
    check: (data) => unlockWhen(data, countAtMinPhase(data, DESIGN_RANK) >= 25),
  },
  {
    name: "El enjambre",
    category: "Production",
    rarity: "Poco común",
    condition: "100 subagentes coordinados.",
    check: (data) => unlockWhen(data, signalsFor(data).subagents >= 100),
  },
  {
    name: "El fordismo digital",
    category: "Production",
    rarity: "Raro",
    condition: "200 work orders completados.",
    check: (data) => unlockWhen(data, signalsFor(data).woClosed >= 200),
  },
  {
    name: "El ideólogo",
    category: "Production",
    rarity: "Raro",
    condition: "50 ideas capturadas.",
    check: (data) => unlockWhen(data, ideasWhere(data, () => true) >= 50),
  },
  {
    name: "El filtro implacable",
    category: "Production",
    rarity: "Raro",
    condition: "50 ideas descartadas.",
    check: (data) => unlockWhen(data, ideasWhere(data, (s) => s === "discarded") >= 50),
  },
  {
    name: "El ejército",
    category: "Production",
    rarity: "Raro",
    condition: "1000 subagentes coordinados.",
    check: (data) => unlockWhen(data, signalsFor(data).subagents >= 1000),
  },
  {
    name: "Maestro de ensamblaje",
    category: "Production",
    rarity: "Épico",
    condition: "500 work orders completados.",
    check: (data) => unlockWhen(data, signalsFor(data).woClosed >= 500),
  },
  {
    name: "La gran máquina",
    category: "Production",
    rarity: "Leyenda",
    condition: "1000 work orders completados.",
    check: (data) => unlockWhen(data, signalsFor(data).woClosed >= 1000),
  },
] as const;
