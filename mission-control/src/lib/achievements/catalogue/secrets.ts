/**
 * lib/achievements/catalogue/secrets.ts — Secret achievements (FRD-10 v2)
 *
 * Hidden with a cryptic hint until unlocked; the criterion is revealed ONLY on unlock.
 * Every unlock derives from a verifiable real signal (docs/achievements.md §5). ~18 secrets.
 */

import { phaseRows, representativeProject, signalsFor } from "./helpers";
import type { SecretDefinition } from "./types";

/** Unlock stamp for a signal-flag secret: provable project, no fabricated date. */
function flag(data: Parameters<SecretDefinition["check"]>[0], cond: boolean) {
  return cond ? { project: representativeProject(data) } : null;
}

export const SECRET_DEFINITIONS: readonly SecretDefinition[] = [
  {
    id: "void-side",
    hint: "Ves el vacío al otro lado.",
    criterion: "Toda tu base de ideas está vacía o sin nada activo.",
    check: (data) => {
      const active = data.ideas.filter(
        (i) =>
          i.status === "discovered" || i.status === "recommended" || i.status === "in-pipeline",
      );
      if (data.ideas.length === 0 || active.length > 0) return null;
      const discarded = data.ideas
        .filter((i) => i.status === "discarded")
        .sort((a, b) => a.slug.localeCompare(b.slug));
      const last = discarded[discarded.length - 1];
      return { project: last?.slug ?? "factory" };
    },
  },
  {
    id: "code-reviewed-code",
    hint: "El código revisó al código.",
    criterion: "Un agente revisor aprobó o corrigió el trabajo de otro agente.",
    check: (data) => {
      const s = signalsFor(data).firstReviewApproved;
      return s ? { project: s.project, date: s.at } : null;
    },
  },
  {
    id: "faster-than-expected",
    hint: "Va más rápido de lo esperado.",
    criterion: "Completaste un build en menos de un día.",
    check: (data) => {
      const h = signalsFor(data).fastestBuildHours;
      return flag(data, h > 0 && h <= 24);
    },
  },
  {
    id: "phoenix",
    hint: "Renace de sus cenizas.",
    criterion: "Un build se relanzó 3 veces y aun así terminó.",
    check: (data) => flag(data, signalsFor(data).maxRelaunchThenComplete >= 3),
  },
  {
    id: "persists",
    hint: "El que insiste, vence.",
    criterion: "Un work order rechazado 3 veces terminó aprobado.",
    check: (data) => flag(data, signalsFor(data).maxReopenThenPass >= 3),
  },
  {
    id: "full-orchestra",
    hint: "Toda la orquesta tocó a la vez.",
    criterion: "Los 6 roles del gremio estuvieron coordinados.",
    check: (data) => flag(data, signalsFor(data).distinctRoles >= 6),
  },
  {
    id: "max-effort",
    hint: "Esfuerzo máximo.",
    criterion: "Un subagente corrió a esfuerzo 'xhigh'.",
    check: (data) => flag(data, signalsFor(data).hasXhighEffort),
  },
  {
    id: "witching-hour",
    hint: "La hora de las brujas.",
    criterion: "Cerraste trabajo entre las 3 y las 4 de la madrugada.",
    check: (data) => flag(data, signalsFor(data).witchingHour),
  },
  {
    id: "army-of-hundred",
    hint: "Un ejército de cien.",
    criterion: "Lanzaste un build con 100 agentes.",
    check: (data) => flag(data, signalsFor(data).maxAgentsPeak >= 100),
  },
  {
    id: "swarm-awakened",
    hint: "El enjambre despertó.",
    criterion: "50 o más subagentes coordinados.",
    check: (data) => flag(data, signalsFor(data).subagents >= 50),
  },
  {
    id: "nothing-to-show",
    hint: "Nada que mostrar, todo por hacer.",
    criterion: "Tienes ideas capturadas pero ningún proyecto todavía.",
    check: (data) => {
      if (data.ideas.length > 0 && phaseRows(data).length === 0) {
        const first = [...data.ideas].sort((a, b) => a.slug.localeCompare(b.slug))[0];
        return { project: first?.slug ?? "factory" };
      }
      return null;
    },
  },
  {
    id: "forgotten-favorite",
    hint: "El favorito olvidado.",
    criterion: "Marcaste una idea como favorita y luego la descartaste.",
    check: (data) => {
      const idea = data.ideas.find((i) => i.favorite === true && i.status === "discarded");
      return idea ? { project: idea.slug } : null;
    },
  },
  {
    id: "four-modes",
    hint: "Cuatro modos, un maestro.",
    criterion: "Usaste los 4 modos de build.",
    check: (data) => flag(data, signalsFor(data).distinctModes >= 4),
  },
  {
    id: "friday-glory",
    hint: "Viernes de gloria.",
    criterion: "Completaste un build un viernes.",
    check: (data) => flag(data, signalsFor(data).fridayShip),
  },
  {
    id: "double-or-nothing",
    hint: "Doble o nada.",
    criterion: "Dos proyectos llegaron a producción el mismo día.",
    check: (data) => {
      const days = new Map<string, number>();
      for (const r of phaseRows(data)) {
        if (r.phase !== "release" || !r.updatedAt) continue;
        const day = r.updatedAt.slice(0, 10);
        days.set(day, (days.get(day) ?? 0) + 1);
      }
      for (const [day, n] of days) {
        if (n >= 2) return { project: representativeProject(data), date: `${day}T00:00:00Z` };
      }
      return null;
    },
  },
  {
    id: "invisible-perfectionist",
    hint: "El perfeccionista invisible.",
    criterion: "5 gates impecables, sin un solo reabierto.",
    check: (data) => flag(data, signalsFor(data).flawlessGates >= 5),
  },
  {
    id: "thousand-and-one",
    hint: "Mil y una órdenes.",
    criterion: "Cerraste 1001 work orders en total.",
    check: (data) => flag(data, signalsFor(data).woClosed >= 1001),
  },
  {
    id: "time-master",
    hint: "El maestro del tiempo.",
    criterion: "52 semanas seguidas de trabajo.",
    check: (data) => flag(data, signalsFor(data).weeklyStreak >= 52),
  },
] as const;
