/**
 * The app-shell nav contract that drives the Shell-Presence Gate (DR-075).
 *
 * PER-PROJECT SEED — NOT conformance-checked / byte-diffed by /pandacorp:upgrade (each project's
 * shell differs; byte-diffing would clobber it = data loss). blueprint/upgrade only CREATE this file
 * if it is missing; they NEVER overwrite it. The byte-diffed VERBATIM gate is shell.spec.ts (never
 * shell.ts, exactly like routes.ts / _target.ts).
 *
 * AUTHOR-DECLARED, PROTOTYPE-ANCHORED: the expected nav is the DESIGN CONTRACT, seeded by
 * /pandacorp:design (or /pandacorp:adopt) from the approved whole-app prototype's persistent nav
 * (docs/design/prototype/) — NOT derived from the app's own routes. Deriving from the app would be
 * the same "consistency-not-fidelity" trap the gate exists to kill: a build that DROPS a destination
 * and trims its routes to match would pass green. The contract drifts only when the prototype itself
 * changes, exactly like a blessed visual baseline.
 *
 * EMPTY NAV_DESTINATIONS ⇒ this app has no persistent shell (a single-screen tool / landing / API /
 * scraper) ⇒ shell.spec.ts is a vacuous pass (fail-closed harness, no premature lock).
 */

/** The persistent-shell landmark — author-declared. One element; prefer a semantic nav or a data hook. */
export const SHELL_SELECTOR = "[data-app-shell]";

export type NavDestination = {
  /** The visible link label — must match the prototype's nav text. */
  readonly label: string;
  /** The route the destination links to — must match a real path in routes.ts. */
  readonly path: string;
};

/**
 * The prototype's TOP-LEVEL nav destinations — seeded from the prototype, NOT from routes.ts SURFACES.
 * SURFACES is every gated route, a SUPERSET of the topbar destinations (detail / modal / auth / sub
 * pages are routes but not top-level nav). Empty ⇒ no shell ⇒ vacuous pass.
 */
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  // The prototype topbar() six destinations (index.html ~L646-652) — FRD-19 nav contract.
  // Mirrors docs/frds/frd-19-app-shell/mocks/README.md and the Nav/ProposalsBadge link list.
  { label: "Inicio", path: "/" },
  { label: "Tablero", path: "/board" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "Propuestas", path: "/proposals" },
  { label: "Logros", path: "/achievements" },
  { label: "Documentación", path: "/manual" },
] as const;

/**
 * Routes that legitimately render WITHOUT / OUTSIDE the persistent shell, or are sub-destinations
 * reached from inside another surface (not top-level nav). Author-declared escape hatch — the exact
 * DR-074 `data-scroll-x="intentional"` pattern, for "this route has no topbar by design". A trailing
 * `/**` matches the whole subtree; otherwise the match is exact.
 */
export const SHELL_EXEMPT: readonly string[] = [
  // Drill-in surfaces with their own in-context header + back control (FRD-19 AC-19-004).
  // Mirrored by the app in src/components/modules/AppShell/shellScope.ts — keep in sync.
  "/projects/**",
  "/configuration",
] as const;

/**
 * Optional mobile drawer/hamburger trigger (author-declared). Empty selector ⇒ the nav must be
 * visible at the mobile width without a toggle.
 */
export const NAV_TOGGLE = "[data-nav-toggle]";

/** Derived: the app declares a persistent shell iff it has at least one nav destination. */
export const HAS_SHELL: boolean = NAV_DESTINATIONS.length > 0;
