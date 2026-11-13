// Planner shared constants and tiny helpers (BUILD-9): no logic of its own, imported by every sibling in `planner/`.

/** Longest chain of WOs one build unit may hold (BUILD-9). */
export const CHAIN_MAX = 3;
/** Default round width: the admission ceiling K_TECHO (BUILD-9). */
export const DEFAULT_CEILING = 2;
/** Files a `docs` unit may write (A2); used as its `artifacts` for overlap. */
export const DOCS_GLOBS = Object.freeze(["docs/**", "README.md", "DESIGN.md", ".env.example"]);

export const ZONE_RANK = Object.freeze({ none: 0, floor: 1, r1: 2 });
export const PENDING = new Set(["PLANNED", "IN_PROGRESS"]);
export const SLOT_STATES = new Set(["admitted", "running"]);
export const WRITE_STATES = new Set(["admitted", "running", "reported", "committed"]);
export const UNIT_DONE = new Set(["integrated", "reviewing", "patching", "verified", "landed"]);
export const STALLED_STATES = new Set(["parked", "blocked", "waiting_gate"]);
export const PLANNED_KINDS = new Set(["docs", "tests", "build", "patch"]);

export const norm = (s) => String(s ?? "").trim().toLowerCase();
export const uniq = (list) => [...new Set(list)];
export const maxZone = (zones) => zones.reduce((a, z) => (ZONE_RANK[z] > ZONE_RANK[a] ? z : a), "none");
export const normGlob = (g) => String(g ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
export const naturalCompare = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });

/** A unit built on an assumption (BUILD-12): dispatchable from its assume branch, never landed until the owner answers. */
export const isAssumed = (u) => u?.parked === "built_on_assumption";
