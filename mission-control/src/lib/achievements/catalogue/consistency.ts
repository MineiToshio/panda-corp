/**
 * lib/achievements/catalogue/consistency.ts — Axis 4: Consistencia (FRD-10 v2)
 *
 * Streaks & cadence from the real green-WO close timestamps.
 * docs/achievements.md §3 Axis 4.
 */

import { signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

export const CONSISTENCY_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "El ritmo",
    category: "Consistency",
    rarity: "Común",
    condition: "Cerraste trabajo en 3 días distintos.",
    check: (data) => unlockWhen(data, signalsFor(data).activeDays >= 3),
  },
  {
    name: "Semanas seguidas",
    category: "Consistency",
    rarity: "Común",
    condition: "2 semanas seguidas con trabajo cerrado.",
    check: (data) => unlockWhen(data, signalsFor(data).weeklyStreak >= 2),
  },
  {
    name: "El fundador madrugador",
    category: "Consistency",
    rarity: "Poco común",
    condition: "Cerraste un work order antes de las 8 de la mañana.",
    check: (data) => unlockWhen(data, signalsFor(data).earlyBird),
  },
  {
    name: "El último en apagar",
    category: "Consistency",
    rarity: "Poco común",
    condition: "Cerraste un work order pasada la medianoche.",
    check: (data) => unlockWhen(data, signalsFor(data).afterMidnight),
  },
  {
    name: "Guerrero de fin de semana",
    category: "Consistency",
    rarity: "Poco común",
    condition: "Cerraste trabajo un sábado Y un domingo.",
    check: (data) => unlockWhen(data, signalsFor(data).weekendWarrior),
  },
  {
    name: "Cinco días de fuego",
    category: "Consistency",
    rarity: "Raro",
    condition: "Cerraste trabajo en 5 días distintos.",
    check: (data) => unlockWhen(data, signalsFor(data).activeDays >= 5),
  },
  {
    name: "El constructor constante",
    category: "Consistency",
    rarity: "Raro",
    condition: "8 semanas seguidas sin parar.",
    check: (data) => unlockWhen(data, signalsFor(data).weeklyStreak >= 8),
  },
  {
    name: "Maratonista del mes",
    category: "Consistency",
    rarity: "Épico",
    condition: "Cerraste trabajo en 30 días distintos.",
    check: (data) => unlockWhen(data, signalsFor(data).activeDays >= 30),
  },
  {
    name: "Medio año sin parar",
    category: "Consistency",
    rarity: "Épico",
    condition: "26 semanas seguidas con trabajo.",
    check: (data) => unlockWhen(data, signalsFor(data).weeklyStreak >= 26),
  },
  {
    name: "El año del fundador",
    category: "Consistency",
    rarity: "Leyenda",
    condition: "52 semanas seguidas con trabajo.",
    check: (data) => unlockWhen(data, signalsFor(data).weeklyStreak >= 52),
  },
] as const;
