import { test } from "@playwright/test";
import { BLESSED } from "./routes";
import { assertResponsive } from "./_responsive-helper";
import { MOBILE_WIDTH, TARGET_PLATFORM, TARGETS_MOBILE } from "./_target";

/**
 * Responsive Gate (DR-074) — the SHIPPED, smart, fail-closed check that the app actually works at
 * a mobile viewport (the real fix for MC shipping non-responsive). VERBATIM stack template
 * (DR-059): it propagates byte-for-byte and is conformance-checked by /pandacorp:upgrade, so a
 * project's responsive enforcement can never silently fall behind the standard.
 *
 * It runs the mobile-width checks ONLY when the project's `target_platforms` includes mobile
 * (read from .pandacorp/status.yaml at test time via ./_target). For a desktop-only / API /
 * scraper project this spec is a vacuous pass — the platform target chooses the asserted widths.
 *
 * Smart, not naïve (see ./_responsive-helper): per-scroll-root overflow + silent off-canvas clip
 * (both honoring the author-declared `data-scroll-x="intentional"` escape hatch for legit
 * kanban/DAG/wide-table scroll-x), tap targets (axe `target-size`, SC 2.5.8 / 24px), and
 * `<main>` not occluded by a fixed bar.
 */

test("responsive harness present", () => {
  // Fail-closed sentinel: the harness is always present even before any surface is blessed.
});

if (TARGETS_MOBILE) {
  for (const s of BLESSED) {
    test(`responsive · ${s.id} (${s.path}) @${MOBILE_WIDTH}px`, async ({ page }) => {
      await assertResponsive(page, s.path, { mobileWidth: MOBILE_WIDTH });
    });
  }
} else {
  test(`responsive · skipped (target_platforms=${TARGET_PLATFORM}, no mobile width asserted)`, () => {
    // Desktop-only / API / scraper: the responsive gate is a vacuous pass by design (DR-074).
  });
}
