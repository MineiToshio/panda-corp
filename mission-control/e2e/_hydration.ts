import { expect, type Page } from "@playwright/test";

/**
 * Hydration-safe navigation for INTERACTING e2e specs (bench A-1: ~13 of one work order's 22 minutes
 * went to a pre-hydration race). VERBATIM stack template (DR-059) — propagated by /pandacorp:architecture,
 * conformance-checked by /pandacorp:upgrade.
 *
 * THE RACE: `page.goto` resolves long before React hydrates. Typed input then reaches only the DOM, the
 * submit never runs the React handler, and a `<form>` with no `method`/`action` falls back to a NATIVE GET
 * that navigates to `?field=value` — flaky tests, and (worse) form data in the URL.
 *
 * WHAT "HYDRATED" MEANS HERE: the FORM ITSELF is interactive. The helper waits on the first `form` (never
 * `main`: `main` is an ancestor and exists, and resolves, before the form below it hydrates). Two signals,
 * in this order:
 *   1. DOCUMENTED CONTRACT (preferred, product-owned): a `data-hydrated` attribute on the form, or on any
 *      ancestor (e.g. `<html>`), set from a client effect once the component is interactive. A project that
 *      needs a stronger guarantee than "React attached" (a form behind a lazy boundary, a store that loads
 *      after mount) sets it where it is true.
 *   2. FALLBACK, when no project marker exists: React attaches `__reactProps$<id>` / `__reactFiber$<id>` to
 *      a DOM node only when it hydrates that node, and its root-delegated listeners are live from then on.
 *      These keys are React-private, so they are matched by PREFIX only (the suffix is random per page load),
 *      and a React change that renames them makes this helper time out LOUDLY, never pass silently. The
 *      self-test in hydration.spec.ts pins the behavior.
 * `document.readyState === "complete"` is a precondition only (it does not imply hydration).
 *
 * No `networkidle`: a live SSE/websocket never lets it settle (DR-071). The wait is bounded by the
 * Playwright `timeout`, so a form that never hydrates FAILS the spec instead of hanging it.
 */

const HYDRATION_TIMEOUT_MS = 15_000;
const HYDRATED_MARKER = "data-hydrated";
const REACT_PRIVATE_PREFIXES = ["__reactProps$", "__reactFiber$"] as const;

type GotoHydratedOptions = {
  /** The interactive element to wait on (default: the first `form`). */
  readonly selector?: string;
  /** Upper bound for the whole wait, in ms. */
  readonly timeout?: number;
  /**
   * Pass `true` for a page that MAY have no form (a screenshot of every surface): when the server-rendered
   * document has none there is nothing interactive to wait for and the helper returns. Default `false`:
   * an interacting spec that finds no form has a bug, and it must fail loud.
   */
  readonly optional?: boolean;
};

/**
 * `page.goto` then wait until the page's form is hydrated and safe to type into and submit.
 * Use this instead of a bare `goto` in EVERY e2e spec that fills or submits a form.
 */
export async function gotoHydrated(
  page: Page,
  path: string,
  options: GotoHydratedOptions = {},
): Promise<void> {
  const { selector = "form", timeout = HYDRATION_TIMEOUT_MS, optional = false } = options;
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.readyState === "complete", undefined, { timeout });
  if (optional && (await page.locator(selector).count()) === 0) return;
  await expect(page.locator(selector).first()).toBeVisible({ timeout });
  await page.waitForFunction(
    ({ target, marker, prefixes }) => {
      const el = document.querySelector(target);
      if (!el) return false;
      if (el.closest(`[${marker}]`)) return true;
      return Object.keys(el).some((key) => prefixes.some((prefix) => key.startsWith(prefix)));
    },
    { target: selector, marker: HYDRATED_MARKER, prefixes: [...REACT_PRIVATE_PREFIXES] },
    { timeout },
  );
}

type PreHydrationGuardOptions = {
  /** Selector of a text field inside the form to type a sentinel value into. */
  readonly field: string;
  /** Selector of the submit control (default: the form's `[type=submit]` or first button). */
  readonly submit?: string;
};

const PRIVACY_SENTINEL = "pandacorp-pre-hydration-secret";

/**
 * PRIVACY GUARD. With JavaScript DISABLED (the page never hydrates — use
 * `test.use({ javaScriptEnabled: false })`), type a sentinel into the form and submit it NATIVELY. A guarded
 * form sends nothing and the URL stays exactly as it was; an unguarded client-handled form falls back to a
 * GET that puts the sentinel (in a real app: a name, an email, a message) into the URL and the server log.
 * Throws with the observed leak, so the spec goes RED when the guard is missing. Typical guard in the
 * product: `method="dialog"` on a client-handled form, or `method="post"` with a Server Action.
 */
export async function assertPreHydrationSubmitIsInert(
  page: Page,
  path: string,
  options: PreHydrationGuardOptions,
): Promise<void> {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
  await page.goto(path, { waitUntil: "domcontentloaded" });
  const startUrl = page.url();
  const seen = requests.length;
  await page.locator(options.field).first().fill(PRIVACY_SENTINEL);
  const form = page.locator("form").first();
  await form
    .locator(options.submit ?? "[type=submit], button")
    .first()
    .click();
  await page.waitForLoadState("domcontentloaded");
  const sent = requests.slice(seen).filter((entry) => entry.includes(PRIVACY_SENTINEL));
  if (page.url() !== startUrl || sent.length > 0) {
    throw new Error(
      `native pre-hydration submit leaked form data: url ${startUrl} -> ${page.url()}; requests carrying the value: ${JSON.stringify(sent)}`,
    );
  }
  const posted = requests.slice(seen).filter((entry) => !entry.startsWith("GET "));
  if (posted.length > 0) {
    throw new Error(
      `native pre-hydration submit sent a non-GET request: ${JSON.stringify(posted)}`,
    );
  }
}
