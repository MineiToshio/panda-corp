import { expect, test } from "@playwright/test";
import { notSkipped } from "./_skip";
import { BLESSED } from "./routes";

/**
 * Design-token fidelity — ADVISORY gate (F4, pairs with the reviewer's visual lens, DR-091).
 * VERBATIM stack template (DR-059) — propagated by /pandacorp:architecture, conformance-checked by
 * /pandacorp:upgrade. This is the CHEAP first step of the visual lens: it catches hardcoded colors
 * that never came from a design token, before the reviewer spends a VLM pass on fidelity.
 *
 * For each BLESSED route it samples rendered elements, collects their computed color /
 * background-color / font-family, and checks each resolves to a value DERIVABLE from the :root CSS
 * custom properties (the design tokens resolved to their computed rgb). Offenders — colors NOT in
 * the token palette — are REPORTED via test annotations + console listing (advisory).
 *
 * IT ONLY FAILS on a GROSS violation: > 20 distinct hardcoded color values on a single route. Below
 * that it always passes (a punch-list, not a block) — so it can never red-lock a normal build; it
 * runs only in the FULL close-out suite (the per-FRD `--since` gate runs smoke + shell only, DR-106).
 * The allowed set is intentionally OVER-permissive (every :root var is resolved as a candidate color),
 * so the advisory biases toward pass and only a genuinely un-tokenized route trips the gross threshold.
 */

const GROSS_HARDCODED_COLORS = 20;

test("tokens harness present", () => {
  expect(BLESSED.length).toBeGreaterThanOrEqual(0);
});

for (const s of notSkipped(BLESSED)) {
  test(`tokens · ${s.id} (${s.path}) uses the design palette`, async ({ page }, testInfo) => {
    // Block the live transport so a streaming route can't hang the sampling (DR-071); the initial
    // server render is what we inspect.
    await page.route("**/api/live**", (r) => r.abort()).catch(() => {});
    await page.goto(s.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main, h1").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const report = await page.evaluate(() => {
      const TRANSPARENT = new Set(["rgba(0, 0, 0, 0)", "transparent", "rgba(0,0,0,0)"]);
      // Build the allowed palette: resolve every :root custom property as BOTH a color and a
      // font-family via a probe element (the browser normalizes var() → computed rgb / stack).
      const rootStyles = getComputedStyle(document.documentElement);
      const probe = document.createElement("span");
      probe.style.position = "absolute";
      probe.style.opacity = "0";
      probe.style.pointerEvents = "none";
      document.body.appendChild(probe);
      const allowedColors = new Set<string>();
      const allowedFonts = new Set<string>();
      for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (!prop || !prop.startsWith("--")) continue;
        probe.style.color = "";
        probe.style.color = `var(${prop})`;
        const c = getComputedStyle(probe).color;
        if (c && !TRANSPARENT.has(c)) allowedColors.add(c);
        probe.style.fontFamily = "";
        probe.style.fontFamily = `var(${prop})`;
        const f = getComputedStyle(probe).fontFamily;
        if (f) allowedFonts.add(f);
      }
      probe.remove();

      // Sample the rendered tree (bounded) and collect offenders.
      const els = Array.from(document.querySelectorAll("body *")).slice(0, 600);
      const colorOffenders = new Set<string>();
      const fontOffenders = new Set<string>();
      for (const el of els) {
        const cs = getComputedStyle(el as Element);
        for (const v of [cs.color, cs.backgroundColor]) {
          if (!v || TRANSPARENT.has(v)) continue;
          if (!allowedColors.has(v)) colorOffenders.add(v);
        }
        const ff = cs.fontFamily;
        if (ff && !allowedFonts.has(ff)) fontOffenders.add(ff);
      }
      return {
        allowed: allowedColors.size,
        colorOffenders: [...colorOffenders],
        fontOffenders: [...fontOffenders],
        sampled: els.length,
      };
    });

    if (report.colorOffenders.length > 0) {
      const msg = `tokens: ${report.colorOffenders.length} hardcoded color(s) not in the token palette on ${s.path}: ${report.colorOffenders.join(", ")}`;
      console.warn(`⚠ ${msg}`);
      testInfo.annotations.push({ type: "token-color-drift", description: msg });
    }
    if (report.fontOffenders.length > 0) {
      const msg = `tokens: font-family not from a token on ${s.path}: ${report.fontOffenders.join(" | ")}`;
      console.warn(`⚠ ${msg}`);
      testInfo.annotations.push({ type: "token-font-drift", description: msg });
    }

    // Advisory: only a GROSS violation reds the (full-suite) gate.
    expect(
      report.colorOffenders.length,
      `GROSS token violation on ${s.path}: ${report.colorOffenders.length} distinct hardcoded colors (> ${GROSS_HARDCODED_COLORS}). Move them onto design tokens.`,
    ).toBeLessThanOrEqual(GROSS_HARDCODED_COLORS);
  });
}
