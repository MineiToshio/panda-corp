/**
 * lib/achievements/catalogue/guild.ts — Axis 7: Gremio (FRD-10 v2)
 *
 * Coordination, roles & build modes (event-derived).
 * docs/achievements.md §3 Axis 7.
 */

import { signalsFor, unlockWhen } from "./helpers";
import type { UniqueDefinition } from "./types";

export const GUILD_UNIQUES: readonly UniqueDefinition[] = [
  {
    name: "Equipo mínimo",
    category: "Guild",
    rarity: "Común",
    condition: "3 roles distintos coordinados.",
    check: (data) => unlockWhen(data, signalsFor(data).distinctRoles >= 3),
  },
  {
    name: "El líder de raid",
    category: "Guild",
    rarity: "Poco común",
    condition: "5 roles distintos coordinados.",
    check: (data) => unlockWhen(data, signalsFor(data).distinctRoles >= 5),
  },
  {
    name: "Modo profundo",
    category: "Guild",
    rarity: "Poco común",
    condition: "Un subagente corrió a esfuerzo máximo.",
    check: (data) => unlockWhen(data, signalsFor(data).hasXhighEffort),
  },
  {
    name: "El revisor incansable",
    category: "Guild",
    rarity: "Poco común",
    condition: "10 veredictos de revisión o gate.",
    check: (data) => {
      const sig = signalsFor(data);
      return unlockWhen(data, sig.reviewsApproved + sig.gatePasses >= 10);
    },
  },
  {
    name: "Coro completo",
    category: "Guild",
    rarity: "Raro",
    condition: "Los 6 roles del gremio coordinados.",
    check: (data) => unlockWhen(data, signalsFor(data).distinctRoles >= 6),
  },
  {
    name: "Probé todos los modos",
    category: "Guild",
    rarity: "Raro",
    condition: "Usaste los 4 modos de build.",
    check: (data) => unlockWhen(data, signalsFor(data).distinctModes >= 4),
  },
  {
    name: "El general",
    category: "Guild",
    rarity: "Raro",
    condition: "Un build con 50 o más agentes.",
    check: (data) => unlockWhen(data, signalsFor(data).maxAgentsPeak >= 50),
  },
  {
    name: "Comandante de fábrica",
    category: "Guild",
    rarity: "Raro",
    condition: "8 roles/agentes distintos coordinados.",
    check: (data) => unlockWhen(data, signalsFor(data).distinctRoles >= 8),
  },
  {
    name: "Cien manos",
    category: "Guild",
    rarity: "Épico",
    condition: "Un build con 100 agentes.",
    check: (data) => unlockWhen(data, signalsFor(data).maxAgentsPeak >= 100),
  },
] as const;
