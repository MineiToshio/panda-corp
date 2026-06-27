/**
 * The surface manifest that drives the smoke + visual + responsive gates (DR-055/056/074).
 *
 * PER-PROJECT SEED — this file is NOT conformance-checked / byte-diffed by /pandacorp:upgrade.
 * Each project's route list differs (byte-diffing it would clobber it = data loss). Scaffold/upgrade
 * only CREATE this file if it is missing; they NEVER overwrite it. The byte-diffed/VERBATIM set is
 * the gate machinery — smoke.spec.ts, visual.spec.ts, responsive.spec.ts, _responsive-helper.ts,
 * playwright.config.ts — never routes.ts (nor _target.ts).
 *
 * Incremental blessing: each UI FRD appends its key surface(s) here; a surface's gate becomes REAL
 * only when its FRD gate flips `blessed: true` (the reviewer confirmed the route matches its mock and
 * committed its visual baseline). Until then the surface is present but not asserted (fail-closed
 * harness, no premature lock). `path` is the live route; `name` is its H1 / menu label.
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
   * mutating data, so a pixel baseline flaps and gets re-blessed forever). Such a surface still gets
   * the smoke gate (renders) + shell gate (reachable) + its components' unit tests — it just opts OUT
   * of the full-page screenshot diff. Don't set it on a static / mock-fidelity page (DR-074/088).
   */
  readonly visualBaseline?: boolean;
};

export const SURFACES: readonly Surface[] = [
  // Seed example — replace with this project's surfaces (one row per key UI route):
  // { id: "home", frd: "frd-01-<slug>", path: "/", name: "Home", blessed: false },
] as const;

export const BLESSED: readonly Surface[] = SURFACES.filter((s) => s.blessed);

/**
 * The surfaces that get a pixel-exact VISUAL baseline: blessed AND not opted out via
 * `visualBaseline:false` (a live-data dashboard whose full-page height is non-deterministic). Smoke
 * and shell still gate every BLESSED surface; only the screenshot diff honors this narrower set.
 */
export const VISUAL_BLESSED: readonly Surface[] = BLESSED.filter((s) => s.visualBaseline !== false);
