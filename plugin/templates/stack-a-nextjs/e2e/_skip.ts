/**
 * Gate quarantine — the engine-driven skip mechanism for a `BLOCKED: needs-owner` route (BL-0011, DR-085).
 *
 * VERBATIM stack template (DR-059): byte-diffed + conformance-checked by /pandacorp:upgrade — the skip
 * LOGIC ships identically to every project, exactly like the spec files that consume it. The per-project
 * seed is routes.ts (the surface list); this file is the machinery that filters it.
 *
 * WHY (LESSON-0021): the whole-project gates (smoke/visual/responsive/shell + the baseline/close-out
 * verify.sh that runs them) assert over EVERY declared route. When ONE route's owning work order is
 * legitimately `BLOCKED: needs-owner` — an accepted incompleteness the owner must clear (a missing
 * secret, an external account) — that single node used to red-lock the ENTIRE gate, coupling unrelated
 * FRDs and the baseline to it (personal-page-v2 FRD-07 /contact without NEXT_PUBLIC_WEB3FORMS_KEY). A
 * blocked node is a tracked owner TODO, not a code defect: the gate must hold it ASIDE, not fail the set.
 *
 * FAIL-CLOSED, by construction:
 *   - The ONLY input is `PANDACORP_GATE_SKIP_ROUTES`, a comma-separated list of route paths. The BUILD
 *     ENGINE is the only writer, and it derives the list SOLELY from work orders whose frontmatter is
 *     `implementation_status: BLOCKED` + `blocked_reason: needs-owner` (see pandacorp-build.js). A route
 *     blocked for ANY OTHER reason — a real regression, `error`, `external`, or an unset env var — is
 *     NEVER in the list, so it still reds the gate. There is no way to quarantine a route from the spec
 *     side; the quarantine is proven upstream.
 *   - The env var is UNSET on every normal run and on the per-FRD `--since` gate, so `SKIP_ROUTES` is
 *     empty and every gate ranges over the full surface set (the default is zero quarantine).
 *   - Each skip is LOGGED LOUDLY (once, at import) so a quarantined route can never disappear silently.
 *
 * Path matching is EXACT after trimming, with i18n tolerance: a locale-prefixed live route (`/en/contact`)
 * matches a declared surface (`/contact`) and vice-versa, so the engine may pass either form. A skip entry
 * that matches nothing is reported (a stale/typo entry must not pass unnoticed).
 */

const RAW = (process.env.PANDACORP_GATE_SKIP_ROUTES ?? "").trim();

const normalize = (p: string): string => {
  let s = p.trim();
  if (!s) return s;
  if (!s.startsWith("/")) s = `/${s}`;
  // Drop a trailing slash (except the root) so "/contact/" === "/contact".
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
};

// Strip a leading 2-letter locale segment (`/en/contact` -> `/contact`) so a locale-prefixed live path
// and a locale-agnostic declared path compare equal regardless of which form the engine passed.
const stripLocale = (p: string): string => p.replace(/^\/[a-z]{2}(?=\/)/, "");

/** The quarantined route paths, normalized. Empty on every normal run (env unset). */
export const SKIP_ROUTES: readonly string[] = RAW
  ? RAW.split(",")
      .map(normalize)
      .filter((s) => s.length > 0)
  : [];

const skipSet = new Set(SKIP_ROUTES);
const skipSetNoLocale = new Set(SKIP_ROUTES.map(stripLocale));

/**
 * True iff `path` is a currently-quarantined `BLOCKED: needs-owner` route. Matches exactly, and also
 * modulo a leading locale segment on either side (so `/contact` and `/en/contact` are the same route).
 */
export const isSkipped = (path: string): boolean => {
  if (skipSet.size === 0) return false;
  const n = normalize(path);
  return skipSet.has(n) || skipSetNoLocale.has(stripLocale(n));
};

/** Filter a surface list to only the routes that are NOT quarantined. */
export const notSkipped = <T extends { readonly path: string }>(
  surfaces: readonly T[],
): readonly T[] => surfaces.filter((s) => !isSkipped(s.path));

// LOUD, one-time log of the quarantine so a skipped route is never invisible. Playwright surfaces
// stdout on a spec file's first import; the engine also logs the same set when it builds it.
if (SKIP_ROUTES.length > 0) {
  console.warn(
    `⚠ GATE QUARANTINE (BL-0011): ${SKIP_ROUTES.length} route(s) held ASIDE from the whole-project gate ` +
      `because their work order is BLOCKED: needs-owner — ${SKIP_ROUTES.join(", ")}. ` +
      `These are tracked owner TODOs, not regressions; every OTHER route is still asserted normally.`,
  );
}
