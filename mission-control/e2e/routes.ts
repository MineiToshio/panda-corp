/**
 * The surface manifest that drives the smoke + visual gates (DR-055/056).
 *
 * Incremental blessing: every top-level surface is re-painted to its mock during Phase 2.
 * A surface's gate becomes REAL only when its FRD gate flips `blessed: true` (the reviewer
 * confirmed the route matches its mock and committed its visual baseline). Until then the
 * surface is not asserted — the harness is present (fail-closed) but the route is not yet
 * under fidelity lock. By close-out every surface is blessed and the full gate is real.
 *
 * `path` is the live route; `name` is its H1 / menu label (DR-062 cohesion). The workspace
 * route uses `mission-control` (the only `.pandacorp/`-marked project on this machine).
 */
export type Surface = {
  readonly id: string;
  readonly frd: string;
  readonly path: string;
  readonly name: string;
  readonly blessed: boolean;
  /**
   * Whether this surface gets a pixel-exact VISUAL baseline (default: true when blessed).
   * Set `false` for a LIVE-DATA dashboard whose full-page height is non-deterministic (it reads
   * mutating factory data, so a pixel baseline flaps and gets re-blessed forever). Such a surface
   * still gets the smoke gate (renders) + shell gate (reachable) + its components' unit tests — it
   * just opts OUT of the full-page screenshot diff. Don't set it on a static/mock-fidelity page.
   */
  readonly visualBaseline?: boolean;
};

export const SURFACES: readonly Surface[] = [
  // visualBaseline:false — live-data dashboard; full-page height is non-deterministic (smoke+shell still gate it).
  {
    id: "inicio",
    frd: "frd-18-dashboard",
    path: "/",
    name: "Inicio",
    blessed: true,
    visualBaseline: false,
  },
  { id: "tablero", frd: "frd-02-ideas-board", path: "/board", name: "Tablero", blessed: true },
  {
    id: "portfolio",
    frd: "frd-03-portfolio",
    path: "/portfolio",
    name: "Portfolio",
    blessed: true,
    // live-data dashboard (project rail height drifts with factory data) → no pixel baseline; smoke+shell still gate.
    visualBaseline: false,
  },
  {
    id: "propuestas",
    frd: "frd-17-proposals-inbox",
    path: "/proposals",
    name: "Propuestas",
    blessed: true,
  },
  {
    id: "logros",
    frd: "frd-09-gamification",
    path: "/achievements",
    name: "Logros",
    blessed: true,
  },
  {
    id: "documentacion",
    frd: "frd-08-documentation",
    path: "/manual",
    name: "Documentación",
    blessed: true,
  },
  {
    id: "configuracion",
    frd: "frd-07-configuration",
    path: "/configuration",
    name: "Configuración",
    blessed: false,
  },
  {
    id: "workspace",
    frd: "frd-04-project-workspace",
    path: "/projects/mission-control",
    name: "mission-control",
    blessed: false,
  },
] as const;

export const BLESSED: readonly Surface[] = SURFACES.filter((s) => s.blessed);

/**
 * The surfaces that get a pixel-exact VISUAL baseline: blessed AND not opted out via
 * `visualBaseline:false` (a live-data dashboard whose full-page height is non-deterministic). Smoke
 * and shell still gate every BLESSED surface; only the screenshot diff honors this narrower set.
 */
export const VISUAL_BLESSED: readonly Surface[] = BLESSED.filter((s) => s.visualBaseline !== false);
