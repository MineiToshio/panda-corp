/**
 * Production-build smoke — the verdict of ONE route rendered by `next build && next start` (proposal 40).
 *
 * VERBATIM stack template (DR-059): byte-diffed + conformance-checked by /pandacorp:upgrade. Pure, no imports, and
 * erasable TypeScript only, so the factory's own suite runs it against the incident it exists for.
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
export const NEXT_DEFAULT_ERROR = /Application error: a (?:client|server)-side exception has occurred/i;

/**
 * Judge one route of the production build.
 * @param o what the browser observed on the route
 * @returns the verdict, with every reason it is red
 */
export function judgeProdPage(o: ProdPageObservation): ProdPageVerdict {
  const reasons: string[] = [];
  if (!(o.status > 0 && o.status < 400)) reasons.push(`HTTP ${o.status || "no response"}`);
  const csp = [...o.cspViolations, ...o.consoleErrors.filter((m) => CSP_MESSAGE.test(m)), ...o.pageErrors.filter((m) => CSP_MESSAGE.test(m))];
  if (csp.length) reasons.push(`CSP violation: ${csp[0].slice(0, 200)}`);
  if (o.errorBoundary) reasons.push("rendered an error boundary");
  if (o.mainText === null) reasons.push("no <main> element");
  else if (!o.mainText.trim()) reasons.push("empty <main>");
  return { path: o.path, green: reasons.length === 0, reasons };
}
