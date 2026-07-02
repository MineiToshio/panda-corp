import { expect, test } from "@playwright/test";
import { DEPLOY_TARGET } from "./_target";

/**
 * Header-Scan Gate (web-security.md SEC-1/SEC-2) — turns "security headers" from prose into a gate.
 *
 * Managed by Pandacorp — installed VERBATIM (DR-059); don't hand-edit (drift fails conformance).
 *
 * Tiered by the project's `deploy_target` (read from `.pandacorp/status.yaml`, DR-085), the same
 * pattern as the Responsive Gate's target_platforms (DR-074):
 *  - `external` (publicly reachable) → HARD assertions: every pre-approved header present with its
 *    literal value, a CSP present (enforce or report-only — report-only is the sanctioned v1 state),
 *    and no `X-Powered-By` banner.
 *  - `internal` / undeclared → ADVISORY: the same checks run and report loudly, but never fail —
 *    HSTS on 127.0.0.1 is meaningless, and a retrofit must not red-lock an internal tool.
 */

const HARD = DEPLOY_TARGET === "external";

const REQUIRED: Array<{ name: string; expected: RegExp }> = [
  { name: "strict-transport-security", expected: /max-age=\d{4,}/ },
  { name: "x-content-type-options", expected: /nosniff/ },
  { name: "referrer-policy", expected: /strict-origin-when-cross-origin|no-referrer/ },
  { name: "permissions-policy", expected: /geolocation=\(\)/ },
];

test("security headers are set (header-scan gate)", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  const problems: string[] = [];

  for (const { name, expected } of REQUIRED) {
    const value = headers[name];
    if (!value || !expected.test(value)) {
      problems.push(`missing/weak ${name} (got: ${value ?? "nothing"})`);
    }
  }

  // Clickjacking: either X-Frame-Options or CSP frame-ancestors
  const xfo = headers["x-frame-options"];
  const csp = headers["content-security-policy"] ?? headers["content-security-policy-report-only"];
  if (!xfo && !(csp && /frame-ancestors/.test(csp))) {
    problems.push("no clickjacking defense (X-Frame-Options or CSP frame-ancestors)");
  }

  // CSP must exist from day 1 — report-only is the sanctioned v1 state (web-security.md),
  // hardening to enforce is the security-auditor's ratchet at hardening/release.
  if (!csp) problems.push("no Content-Security-Policy (not even report-only)");

  if (headers["x-powered-by"]) problems.push("X-Powered-By banner exposed (remove it)");

  if (problems.length === 0) return;
  const report = `Header-scan (${DEPLOY_TARGET}): ${problems.join("; ")}`;
  if (HARD) expect(problems, report).toEqual([]);
  else console.warn(`⚠ ADVISORY ${report} — becomes BLOCKING when deploy_target is external.`);
});
