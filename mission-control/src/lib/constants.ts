import type { IconName } from "@/components/core/Icon/iconData";
import type { CopyKey } from "@/lib/copy/copy";

/**
 * Mission Control — shared constants.
 *
 * No magic strings: all cross-cutting constant values live here.
 * FRD-11 build-mode catalog: IF-11-modes (blueprint §2).
 */

/** Copy-only build entry actions. Legacy power preferences have no meaning. */
export const BUILD_ENTRY_COPY = {
  title: "Construir o reanudar",
  group: "Acción de construcción",
  build: "Construir",
  resume: "Reanudar",
  target: "Objetivo: FRD o tarjeta",
  buildHint:
    "Construye el alcance conversado o el plan pendiente. El motor elige modelos y concurrencia.",
  resumeHint: "Continúa el mismo build desde su último punto seguro.",
  targetHint: "Construye solo el FRD o la tarjeta elegida.",
  targetAria: "Objetivo del build",
  placeholder: "Elige un FRD o tarjeta",
  empty: "No hay objetivos disponibles para construir.",
  choose: "Elige un objetivo para obtener el comando.",
  draft: "La sesión completa y valida el alcance del borrador antes de construir.",
  note: "Copia el comando y pégalo en tu sesión. Mission Control nunca lo ejecuta.",
  frdScope: "El comando construye el trabajo pendiente del FRD completo.",
} as const;

// ---------------------------------------------------------------------------
// FRD-17 — Self-suggestion thresholds (IF-17-suggest, WO-17-003)
// All magic numbers are centralized here per AC-17-003.6.
// ---------------------------------------------------------------------------

/**
 * Minimum number of ideas in the same board column to trigger a `bottleneck` suggestion.
 * (blueprint §4, REQ-17-004)
 */
export const BOTTLENECK_THRESHOLD = 5;

/**
 * A phase running longer than `VELOCITY_FACTOR × portfolio_median` triggers a `velocity` alert.
 * (blueprint §4, REQ-17-004)
 */
export const VELOCITY_FACTOR = 2;

/**
 * A shipped project older than `LAUNCH_REVIEW_DAYS` days triggers a `launch-review` suggestion.
 * Aligns with DR-043 (post-launch review cadence).
 * (blueprint §4, REQ-17-004)
 */
export const LAUNCH_REVIEW_DAYS = 30;

/**
 * Maximum number of events examined for velocity / unused-capability derivations.
 * Must be ≤ 200 (architecture §3 capped tail — AC-17-003.4).
 */
export const SELF_SUGGEST_EVENT_CAP = 200;

// ---------------------------------------------------------------------------
/** A persistent-shell destination; path ownership stays in the navigation resolver. */
export interface NavDestination {
  readonly id: string;
  readonly path: string;
  readonly labelKey: CopyKey;
  readonly miniKey: CopyKey;
  readonly icon: IconName;
  readonly tone: string;
}

/** Ordered Órbita destinations, shared by the sidebar and phone shortcuts. */
export const NAV_DESTINATIONS = [
  {
    id: "inicio",
    path: "/",
    labelKey: "shell.nav.inicio",
    miniKey: "shell.navMini.inicio",
    icon: "home",
    tone: "amber",
  },
  {
    id: "tablero",
    path: "/board",
    labelKey: "shell.nav.tablero",
    miniKey: "shell.navMini.tablero",
    icon: "kanban",
    tone: "teal",
  },
  {
    id: "portfolio",
    path: "/portfolio",
    labelKey: "shell.nav.portafolio",
    miniKey: "shell.navMini.portafolio",
    icon: "folder",
    tone: "blue",
  },
  {
    id: "propuestas",
    path: "/proposals",
    labelKey: "shell.nav.propuestas",
    miniKey: "shell.navMini.propuestas",
    icon: "bulb",
    tone: "pink",
  },
  {
    id: "logros",
    path: "/achievements",
    labelKey: "shell.nav.logros",
    miniKey: "shell.navMini.logros",
    icon: "trophy",
    tone: "gold",
  },
  {
    id: "documentacion",
    path: "/manual",
    labelKey: "shell.nav.documentacion",
    miniKey: "shell.navMini.documentacion",
    icon: "book",
    tone: "violet",
  },
  {
    id: "configuracion",
    path: "/configuration",
    labelKey: "shell.nav.configuracion",
    miniKey: "shell.navMini.configuracion",
    icon: "settings",
    tone: "slate",
  },
] as const satisfies readonly NavDestination[];

/** The shell destination identifier returned by navActive. */
export type NavDestinationId = (typeof NAV_DESTINATIONS)[number]["id"];
