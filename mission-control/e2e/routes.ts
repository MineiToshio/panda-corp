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
};

export const SURFACES: readonly Surface[] = [
  { id: "inicio", frd: "frd-18-dashboard", path: "/", name: "Inicio", blessed: true },
  { id: "tablero", frd: "frd-02-ideas-board", path: "/board", name: "Tablero", blessed: true },
  {
    id: "portfolio",
    frd: "frd-03-portfolio",
    path: "/portfolio",
    name: "Portfolio",
    blessed: false,
  },
  {
    id: "propuestas",
    frd: "frd-17-proposals-inbox",
    path: "/proposals",
    name: "Propuestas",
    blessed: false,
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
    blessed: false,
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
