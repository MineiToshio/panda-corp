import type { Page } from "@playwright/test";

/**
 * Production-build smoke — the verdict of ONE route rendered by `next build && next start` (proposal 40).
 *
 * VERBATIM stack template (DR-059): byte-diffed + conformance-checked by /pandacorp:upgrade. No runtime imports (a
 * type-only import is erased) and erasable TypeScript only, so the factory's own suite runs the judge AND the browser
 * observer against the incident they exist for (a real Chromium on a strict-CSP fixture).
 *
 * WHY: every browser gate runs against `next dev`, whose CSP allows eval. personal-page-v2 f4ed29a: the production CSP
 * (script-src without 'unsafe-eval') blocked the MDX compile a Client Component did in the browser, so every blog post
 * rendered its error boundary with zero article content, for about two months, while smoke, visual, responsive, a11y
 * and the unit tests stayed green. A 200 response is not enough: the page is red on
 *   - a Content-Security-Policy violation (the console report, a `securitypolicyviolation` event, or the EvalError),
 *   - a rendered error boundary (an element marked `data-error-boundary`, or Next's default production error page),
 *   - an empty or missing `<main>`,
 *   - an HTTP status of 400 or more.
 */
export type ProdPageObservation = {
  readonly path: string;
  readonly status: number;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly cspViolations: readonly string[];
  /** False when the page never hydrated within the bound; absent when not observed. */
  readonly hydrated?: boolean;
  /** The text of the first `<main>`, or null when the page has none. */
  readonly mainText: string | null;
  readonly errorBoundary: boolean;
};

export type ProdPageVerdict = {
  readonly path: string;
  readonly green: boolean;
  readonly reasons: readonly string[];
};

const CSP_MESSAGE =
  /Content[ -]Security[ -]Policy|'unsafe-(?:eval|inline)'|Refused to (?:execute|evaluate|load|apply|connect|frame|create)/i;

/** Next's built-in production error page (no custom boundary rendered). */
export const NEXT_DEFAULT_ERROR =
  /Application error: a (?:client|server)-side exception has occurred/i;

/**
 * Judge one route of the production build.
 * @param o what the browser observed on the route
 * @returns the verdict, with every reason it is red
 */
export function judgeProdPage(o: ProdPageObservation): ProdPageVerdict {
  const reasons: string[] = [];
  if (!(o.status > 0 && o.status < 400)) reasons.push(`HTTP ${o.status || "no response"}`);
  const csp = [
    ...o.cspViolations,
    ...o.consoleErrors.filter((m) => CSP_MESSAGE.test(m)),
    ...o.pageErrors.filter((m) => CSP_MESSAGE.test(m)),
  ];
  if (csp.length) reasons.push(`CSP violation: ${csp[0].slice(0, 200)}`);
  if (o.hydrated === false) reasons.push("never hydrated");
  if (o.errorBoundary) reasons.push("rendered an error boundary");
  if (o.mainText === null) reasons.push("no <main> element");
  else if (!o.mainText.trim()) reasons.push("empty <main>");
  return { path: o.path, green: reasons.length === 0, reasons };
}

export type ObserveOptions = {
  /** Upper bound for hydration, in ms (a page that never hydrates is red). */
  readonly hydrationTimeoutMs?: number;
  /** The page must stay quiet this long (no new error, CSP event or script load) before its verdict is read. */
  readonly quietMs?: number;
  /** Upper bound for the whole settle window after hydration, in ms. */
  readonly maxSettleMs?: number;
};

const HYDRATED_MARKER = "data-hydrated";
const REACT_PRIVATE_PREFIXES = ["__reactContainer$", "__reactFiber$", "__reactProps$"] as const;
const SETTLE_POLL_MS = 100;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Visit one route and record what the browser observed, for `judgeProdPage`.
 *
 * The verdict is read only once the page is HYDRATED and has SETTLED. App Router hydration is time-sliced and a client
 * component can load its chunk lazily, so the ppv2 f4ed29a eval (and its error boundary) happens after `load`: read at
 * `load`, the page still shows its server-rendered `<main>` and a clean console. Hydrated = a `data-hydrated` marker
 * anywhere (the same product-owned contract as `_hydration.ts`), else React's private keys on the document, `<html>`,
 * `<body>` or `<main>` (matched by prefix; a React rename times out loud as "never hydrated", never a silent green).
 * Settled = no script request in flight and no new console error, page error or CSP event for `quietMs`, bounded by
 * `maxSettleMs`. No `networkidle`: a live SSE or websocket never lets it settle (DR-071).
 * @param page a fresh Playwright page (its listeners are attached before navigation)
 * @param route the path to visit
 * @param options the hydration and settle bounds
 * @returns the observation
 */
export async function observeProdPage(
  page: Page,
  route: string,
  options: ObserveOptions = {},
): Promise<ProdPageObservation> {
  const { hydrationTimeoutMs = 15_000, quietMs = 1_500, maxSettleMs = 10_000 } = options;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let lastActivity = Date.now();
  let scriptsInFlight = 0;
  const touch = () => {
    lastActivity = Date.now();
  };
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    consoleErrors.push(m.text());
    touch();
  });
  page.on("pageerror", (e) => {
    pageErrors.push(String(e));
    touch();
  });
  page.on("request", (r) => {
    if (r.resourceType() !== "script") return;
    scriptsInFlight++;
    touch();
  });
  const handleScriptDone = (r: { resourceType(): string }) => {
    if (r.resourceType() !== "script") return;
    scriptsInFlight = Math.max(0, scriptsInFlight - 1);
    touch();
  };
  page.on("requestfinished", handleScriptDone);
  page.on("requestfailed", handleScriptDone);
  await page.addInitScript(() => {
    const w = window as unknown as { __pcCsp?: string[] };
    w.__pcCsp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__pcCsp?.push(`${e.violatedDirective} blocked ${e.blockedURI || "inline"}`);
    });
  });
  const res = await page.goto(route, { waitUntil: "load" });
  const hydrated = await page
    .waitForFunction(
      ({ marker, prefixes }) => {
        if (document.querySelector(`[${marker}]`)) return true;
        const nodes: unknown[] = [
          document,
          document.documentElement,
          document.body,
          document.querySelector("main"),
        ];
        return nodes.some(
          (n) =>
            n !== null &&
            Object.keys(n as object).some((k) => prefixes.some((p) => k.startsWith(p))),
        );
      },
      { marker: HYDRATED_MARKER, prefixes: [...REACT_PRIVATE_PREFIXES] },
      { timeout: hydrationTimeoutMs },
    )
    .then(
      () => true,
      () => false,
    );
  touch();
  const readCsp = () =>
    page.evaluate(() => (window as unknown as { __pcCsp?: string[] }).__pcCsp ?? []);
  const settleStart = Date.now();
  let cspSeen = (await readCsp()).length;
  while (Date.now() - settleStart < maxSettleMs) {
    const csp = (await readCsp()).length;
    if (csp !== cspSeen) {
      cspSeen = csp;
      touch();
    }
    if (scriptsInFlight === 0 && Date.now() - lastActivity >= quietMs) break;
    await sleep(SETTLE_POLL_MS);
  }
  const cspViolations = await readCsp();
  const main = page.locator("main").first();
  const mainText = (await main.count()) ? await main.innerText() : null;
  const bodyText = await page.locator("body").innerText();
  const errorBoundary =
    (await page.locator("[data-error-boundary]").count()) > 0 || NEXT_DEFAULT_ERROR.test(bodyText);
  return {
    path: route,
    status: res?.status() ?? 0,
    hydrated,
    consoleErrors,
    pageErrors,
    cspViolations,
    mainText,
    errorBoundary,
  };
}
