/**
 * lib/achievements/predicates.ts — Unique & secret definition tables (FRD-10)
 *
 * Pure data tables whose entries carry unlock-check predicates, plus the shared
 * helpers those predicates use. No I/O, never mutated at runtime.
 * Split out of achievements.ts/definitions.ts to keep files ≤500 lines.
 *
 * Source: docs/achievements.md §3. Prototype data in prototype/index.html.
 */

import type { ReaderData } from "./stats";
import type { Rarity } from "./tiers";

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Unique achievement data tables (from docs/achievements.md)
// ─────────────────────────────────────────────────────────────────────────────

/** Category of a unique achievement (AC-10-003.1). */
export type UniqueCategory = "Discovery" | "Speed" | "Quality" | "Consistency" | "Mastery";

/** Definition of a unique achievement (data table — never mutated). */
export type UniqueDefinition = {
  readonly name: string;
  readonly category: UniqueCategory;
  /**
   * Per-trophy rarity (FRD-10 v2, docs/achievements.md §2). Optional during the v2
   * migration: a definition without an explicit grade surfaces as "Común" (the floor)
   * via computeUniques. The v2 catalogue assigns every trophy an explicit grade.
   */
  readonly rarity?: Rarity;
  /** Human-readable condition (shown when locked — AC-10-003.3). */
  readonly condition: string;
  /**
   * Pure predicate that determines if this achievement is unlocked.
   *
   * Takes already-read data; no I/O.
   * Must be derived from a verifiable result (AC-10-003.2 negative AC).
   *
   * Returns { unlocked: false } or { unlocked: true, date, project }.
   */
  readonly check: (
    data: ReaderData,
  ) => { unlocked: false } | { unlocked: true; date: string; project: string };
};

/**
 * All unique achievement definitions.
 *
 * Source: docs/achievements.md §3 (names, categories) + prototype/index.html ONETIME array (unlock conditions).
 *
 * Categories: Discovery (6), Speed (3), Quality (2), Consistency (2), Mastery (2) = 15 total.
 */
export const UNIQUE_DEFINITIONS: readonly UniqueDefinition[] = [
  // ── Discovery ─────────────────────────────────────────────────────────────
  {
    name: "El día del lanzamiento",
    category: "Discovery",
    condition: "Tu primer producto en producción.",
    check: (data) => {
      const shipped = _firstShippedProject(data);
      if (!shipped) return { unlocked: false };
      return { unlocked: true, date: shipped.date, project: shipped.project };
    },
  },
  {
    name: "El primer spec",
    category: "Discovery",
    condition: "Documentaste tu primer MVP.",
    check: (data) => {
      // Unlocked when any project has advanced past product (has a PRD/spec)
      const ev = _firstAchievementEvent(data, "prd");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El debut del diseñador",
    category: "Discovery",
    condition: "Tus primeros mockups aprobados.",
    check: (data) => {
      // Unlocked when a project reaches or passes the design phase
      const ev = _firstPhaseEvent(data, "design");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El blueprintero",
    category: "Discovery",
    condition: "Tu primera arquitectura técnica.",
    check: (data) => {
      const ev = _firstPhaseEvent(data, "architecture");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "Iteración cero",
    category: "Discovery",
    condition: "Mejoraste un producto ya lanzado.",
    check: (data) => {
      const ev = _firstAchievementEvent(data, "iteration");
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El gran tour",
    category: "Discovery",
    condition: "Recorriste las 6 fases del pipeline de punta a punta.",
    check: (data) => {
      // Unlocked when any project reaches the launched "release" phase (all 6 rooms completed)
      const shipped = _firstShippedProject(data);
      if (!shipped) return { unlocked: false };
      return { unlocked: true, date: shipped.date, project: shipped.project };
    },
  },

  // ── Speed ─────────────────────────────────────────────────────────────────
  {
    name: "48 horas de locura",
    category: "Speed",
    condition: "De idea a producto lanzado en menos de 48 horas.",
    check: (data) => {
      // Unlocked when a "speed" event records ≤ 2 days (speed:1 or speed:2)
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (ev.event === "achievement" && ev.status === "ok" && typeof ev.task === "string") {
          const match = ev.task.match(/^speed:(\d+)$/);
          if (match) {
            const days = parseInt(match[1] ?? "0", 10);
            if (days > 0 && days <= 2) {
              return { unlocked: true, date: ev.at, project: ev.project ?? "" };
            }
          }
        }
      }
      return { unlocked: false };
    },
  },
  {
    name: "Ship it Friday",
    category: "Speed",
    condition: "Lanzaste algo a producción un viernes por la tarde.",
    check: (data) => {
      // Unlocked when there is a "release" achievement event on a Friday
      // AND a shipped project exists (verifiable result)
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (ev.event === "achievement" && ev.status === "ok" && ev.task === "release") {
          const d = new Date(ev.at);
          // getUTCDay() === 5 is Friday
          if (d.getUTCDay() === 5) {
            return { unlocked: true, date: ev.at, project: ev.project ?? "" };
          }
        }
      }
      return { unlocked: false };
    },
  },
  {
    name: "La maratón",
    category: "Speed",
    condition: "Una sesión de implementación con 20+ work orders seguidos.",
    check: (data) => {
      // Unlocked when 20+ consecutive WO achievement events occur within 24h
      const events = data.eventsSnapshot?.events ?? [];
      const woEvents = events.filter(
        (ev) =>
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.workOrder === "string" &&
          ev.workOrder.length > 0,
      );
      if (woEvents.length < 20) return { unlocked: false };
      // Check if any 20-event window spans ≤ 24h
      for (let i = 0; i <= woEvents.length - 20; i++) {
        const first = woEvents[i];
        const last = woEvents[i + 19];
        if (!first || !last) continue;
        const t0 = new Date(first.at).getTime();
        const t1 = new Date(last.at).getTime();
        if (Number.isFinite(t0) && Number.isFinite(t1) && t1 - t0 <= 24 * 3_600_000) {
          return { unlocked: true, date: first.at, project: first.project ?? "" };
        }
      }
      return { unlocked: false };
    },
  },

  // ── Quality ───────────────────────────────────────────────────────────────
  {
    name: "Primer intento",
    category: "Quality",
    condition: "Un producto pasó todas las fases sin un solo rechazo en revisión.",
    check: (data) => {
      // Unlocked when a "flawless" achievement event exists
      const events = data.eventsSnapshot?.events ?? [];
      const ev = events.find(
        (e) => e.event === "achievement" && e.status === "ok" && e.task === "flawless",
      );
      if (!ev) return { unlocked: false };
      return { unlocked: true, date: ev.at, project: ev.project ?? "" };
    },
  },
  {
    name: "El perfeccionista práctico",
    category: "Quality",
    condition: "3 productos seguidos sin rechazos en diseño.",
    check: (data) => {
      // Unlocked when 3+ consecutive flawless events
      const events = data.eventsSnapshot?.events ?? [];
      const flawlessEvents = events.filter(
        (e) => e.event === "achievement" && e.status === "ok" && e.task === "flawless",
      );
      if (flawlessEvents.length >= 3) {
        const ev = flawlessEvents[2];
        if (ev) return { unlocked: true, date: ev.at, project: ev.project ?? "" };
      }
      return { unlocked: false };
    },
  },

  // ── Consistency ───────────────────────────────────────────────────────────
  {
    name: "El fundador madrugador",
    category: "Consistency",
    condition: "Cerraste un work order antes de las 8am.",
    check: (data) => {
      // Unlocked when any WO achievement event is before 08:00 UTC
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.workOrder === "string" &&
          ev.workOrder.length > 0
        ) {
          const d = new Date(ev.at);
          if (Number.isFinite(d.getTime()) && d.getUTCHours() < 8) {
            return { unlocked: true, date: ev.at, project: ev.project ?? "" };
          }
        }
      }
      return { unlocked: false };
    },
  },
  {
    name: "El último en apagar",
    category: "Consistency",
    condition: "Cerraste un work order después de medianoche.",
    check: (data) => {
      // Unlocked when any WO achievement event is at or after 00:00 UTC (midnight)
      // Midnight = hours 0 (00:00..00:59) — i.e. getUTCHours() === 0
      const events = data.eventsSnapshot?.events ?? [];
      for (const ev of events) {
        if (
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.workOrder === "string" &&
          ev.workOrder.length > 0
        ) {
          const d = new Date(ev.at);
          if (Number.isFinite(d.getTime()) && d.getUTCHours() === 0) {
            return { unlocked: true, date: ev.at, project: ev.project ?? "" };
          }
        }
      }
      return { unlocked: false };
    },
  },

  // ── Mastery ───────────────────────────────────────────────────────────────
  {
    name: "La trilogía",
    category: "Mastery",
    condition: "3 productos vivos en producción al mismo tiempo.",
    check: (data) => {
      const shippedCount = data.statuses.filter(
        (sr) => sr.present && sr.status !== null && sr.status.phase === "release",
      ).length;
      if (shippedCount < 3) return { unlocked: false };
      // Use the 3rd shipped project's date
      const sorted = [...data.statuses]
        .filter((sr) => sr.present && sr.status !== null && sr.status.phase === "release")
        .sort((a, b) => {
          const da = (a.present && a.status ? a.status.updatedAt : undefined) ?? "";
          const db = (b.present && b.status ? b.status.updatedAt : undefined) ?? "";
          return da.localeCompare(db);
        });
      const third = sorted[2];
      if (!third?.present || !third.status) return { unlocked: false };
      return {
        unlocked: true,
        date: third.status.updatedAt ?? "",
        project: third.status.project ?? "",
      };
    },
  },
  {
    name: "Coleccionista de estados",
    category: "Mastery",
    condition: "Un producto que pasó por todos los estados del tablero.",
    check: (data) => {
      // Unlocked when any project reached the launched "release" phase (covered all phases)
      const shipped = _firstShippedProject(data);
      if (!shipped) return { unlocked: false };
      return { unlocked: true, date: shipped.date, project: shipped.project };
    },
  },
] as const;

// ─── Helper functions for unique checks ──────────────────────────────────────

/** Returns the first shipped project's date + project name, or null. */
function _firstShippedProject(data: ReaderData): { date: string; project: string } | null {
  const shippedStatuses = data.statuses.filter(
    (sr) => sr.present && sr.status !== null && sr.status.phase === "release",
  );
  if (shippedStatuses.length === 0) return null;
  // Return earliest by updatedAt
  const sorted = [...shippedStatuses].sort((a, b) => {
    const da = (a.present && a.status ? a.status.updatedAt : undefined) ?? "";
    const db = (b.present && b.status ? b.status.updatedAt : undefined) ?? "";
    return da.localeCompare(db);
  });
  const first = sorted[0];
  if (!first?.present || !first.status) return null;
  return { date: first.status.updatedAt ?? "", project: first.status.project ?? "" };
}

/** Returns the first "achievement" event matching a specific task, or null. */
function _firstAchievementEvent(
  data: ReaderData,
  task: string,
): { at: string; project?: string } | null {
  const events = data.eventsSnapshot?.events ?? [];
  return (
    events.find((ev) => ev.event === "achievement" && ev.status === "ok" && ev.task === task) ??
    null
  );
}

/** Returns the first "achievement" event with task="phase:<phaseName>", or null. */
function _firstPhaseEvent(
  data: ReaderData,
  phaseName: string,
): { at: string; project?: string } | null {
  const events = data.eventsSnapshot?.events ?? [];
  return (
    events.find(
      (ev) => ev.event === "achievement" && ev.status === "ok" && ev.task === `phase:${phaseName}`,
    ) ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2. Secret achievement data tables (from docs/achievements.md)
// ─────────────────────────────────────────────────────────────────────────────

/** Secret achievement definition (data table — never mutated). */
export type SecretDefinition = {
  readonly id: string;
  /** Cryptic hint — always visible (AC-10-004.1). */
  readonly hint: string;
  /**
   * What triggered the achievement — revealed ONLY when unlocked (AC-10-004.2).
   * This field is in the definition for traceability; it is only surfaced in the
   * output Secret when unlocked.
   */
  readonly criterion: string;
  /**
   * Pure predicate returning unlock state from verifiable reader data (AC-10-004.3).
   * Returns null when locked, or { date?, project } when unlocked.
   *
   * `date` is OPTIONAL: it is only present when a VERIFIABLE timestamp exists in
   * the source (e.g. a triggering event's `at`). When the unlock condition is
   * provable but no source carries a timestamp (e.g. derived purely from idea
   * cards, which have no date field), `date` is omitted rather than fabricated —
   * the honesty contract (AC-10-004.3 / blueprint §5) forbids inventing a date.
   */
  readonly check: (data: ReaderData) => null | { date?: string; project: string };
};

/**
 * All secret achievement definitions.
 *
 * Source: docs/achievements.md §3 Secrets.
 * 3 secrets (hidden with cryptic hints until unlocked).
 */
export const SECRET_DEFINITIONS: readonly SecretDefinition[] = [
  {
    id: "void-side",
    hint: "Ocurre cuando ves el vacío al otro lado.",
    criterion: "Toda tu base de ideas está vacía o sin elementos activos.",
    check: (data) => {
      // Unlocked when the idea base has no active ideas (all discarded, or empty)
      const activeIdeas = data.ideas.filter(
        (idea) =>
          idea.status === "discovered" ||
          idea.status === "recommended" ||
          idea.status === "in-pipeline",
      );
      if (data.ideas.length > 0 && activeIdeas.length === 0) {
        // Idea cards carry NO date field, so there is no verifiable timestamp to
        // anchor the unlock to. Honesty contract (AC-10-004.3 / blueprint §5):
        // omit the date rather than fabricate one. The unlock condition itself is
        // provable from the cards; the project is the latest discarded idea.
        const discardedSorted = [...data.ideas]
          .filter((i) => i.status === "discarded")
          .sort((a, b) => a.slug.localeCompare(b.slug));
        const last = discardedSorted[discardedSorted.length - 1];
        return { project: last?.slug ?? "factory" };
      }
      return null;
    },
  },
  {
    id: "code-reviewed-code",
    hint: "El código revisó al código.",
    criterion: "Un agente revisor corrigió o completó el trabajo de otro agente.",
    check: (data) => {
      // Unlocked when there is a "review" event from a reviewer agent with status=ok
      const events = data.eventsSnapshot?.events ?? [];
      const reviewerEvent = events.find(
        (ev) =>
          ev.event === "review" &&
          ev.status === "ok" &&
          typeof ev.agent === "string" &&
          ev.agent.toLowerCase().includes("reviewer"),
      );
      if (!reviewerEvent) return null;
      return { date: reviewerEvent.at, project: reviewerEvent.project ?? "" };
    },
  },
  {
    id: "faster-than-expected",
    hint: "Va más rápido de lo esperado.",
    criterion: "Completaste el pipeline completo (producto → operación) en un solo día.",
    check: (data) => {
      // Unlocked when design, architecture, implementation, and release phase events
      // all occur on the same UTC day
      const events = data.eventsSnapshot?.events ?? [];
      const phaseEvents = events.filter(
        (ev) =>
          ev.event === "achievement" &&
          ev.status === "ok" &&
          typeof ev.task === "string" &&
          ev.task.startsWith("phase:"),
      );
      // Group phase events by UTC date
      const dateMap = new Map<string, Set<string>>();
      for (const ev of phaseEvents) {
        const d = new Date(ev.at);
        if (!Number.isFinite(d.getTime())) continue;
        const dateKey = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const phases = dateMap.get(dateKey) ?? new Set<string>();
        phases.add(ev.task ?? "");
        dateMap.set(dateKey, phases);
      }
      // Also check for a "release" event on the same day
      const releaseEvents = events.filter(
        (ev) => ev.event === "achievement" && ev.status === "ok" && ev.task === "release",
      );
      for (const relEv of releaseEvents) {
        const d = new Date(relEv.at);
        if (!Number.isFinite(d.getTime())) continue;
        const dateKey = d.toISOString().slice(0, 10);
        const phasesOnDay = dateMap.get(dateKey);
        if (phasesOnDay && phasesOnDay.size >= 3) {
          return { date: relEv.at, project: relEv.project ?? "" };
        }
      }
      return null;
    },
  },
] as const;
