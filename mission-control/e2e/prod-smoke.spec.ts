import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { judgeProdPage, observeProdPage } from "./_prod-smoke";
import { BLESSED } from "./routes";

/**
 * Production-Build Smoke (proposal 40) — every blessed route plus one sample per dynamic route, rendered by
 * `next build && next start` (playwright.config.ts switches its webServer when PANDACORP_PROD_SMOKE is set), red on a
 * CSP violation, a rendered error boundary, an empty <main> or a page that never hydrates, read only once the page has
 * hydrated and settled (`observeProdPage`). VERBATIM stack template (DR-059).
 *
 * It runs ONLY under PANDACORP_PROD_SMOKE: the build engine's `prod-smoke` step sets it, in a detached worktree at
 * HEAD, in parallel with the visual QA pass. Under `next dev` (every other verify.sh run) it is skipped.
 *
 * Dynamic routes: list one concrete sample per dynamic route in the optional per-project `e2e/prod-samples.json`
 * (a JSON array of paths, e.g. ["/blog/hello-world"]). With no route at all, `/` is visited.
 * Error boundaries: a custom `error.tsx` marks its root `data-error-boundary` so this smoke can see it.
 */
const SAMPLES_FILE = path.resolve("e2e", "prod-samples.json");
const samples: string[] = existsSync(SAMPLES_FILE)
  ? (JSON.parse(readFileSync(SAMPLES_FILE, "utf8")) as unknown[]).filter(
      (p): p is string => typeof p === "string",
    )
  : [];
const declared = [...new Set([...BLESSED.map((s) => s.path), ...samples])];
const ROUTES = declared.length ? declared : ["/"];
const REPORT = process.env.PANDACORP_PROD_SMOKE_REPORT;

// biome-ignore lint/suspicious/noSkippedTests: deliberate env gate, the engine sets PANDACORP_PROD_SMOKE for this step only
test.skip(
  !process.env.PANDACORP_PROD_SMOKE,
  "the production-build smoke runs only under PANDACORP_PROD_SMOKE (next build && next start)",
);

for (const route of ROUTES) {
  test(`prod-smoke · ${route} renders in the production build`, async ({ page }) => {
    test.setTimeout(60_000);
    const verdict = judgeProdPage(await observeProdPage(page, route));
    if (REPORT) appendFileSync(REPORT, `${JSON.stringify(verdict)}\n`);
    expect(verdict.reasons, `${route} in the production build`).toEqual([]);
  });
}
