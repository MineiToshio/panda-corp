import { test } from "@playwright/test";
import { assertResponsive, reportBreakageOnly } from "./_responsive-helper";
import { notSkipped } from "./_skip";
import { MOBILE_WIDTH, TARGET_PLATFORM, TARGETS_MOBILE } from "./_target";
import { BLESSED } from "./routes";

/**
 * Responsive Gate (DR-074, amended 2026-06-30) — the SHIPPED, smart check that the app works across
 * device sizes. VERBATIM stack template (DR-059): it propagates byte-for-byte and is
 * conformance-checked by /pandacorp:upgrade, so a project's responsive enforcement can never silently
 * fall behind the standard.
 *
 * TWO tiers, chosen by the project's `target_platforms` (read at test time via ./_target):
 *   - ON the targeted platform → `assertResponsive` runs the FULL check, BLOCKING (fail-closed): no
 *     overflow / clip / sub-24px tap targets / occluded <main>.
 *   - OFF the targeted platform (a desktop-only app at a phone width, or a mobile-only app on
 *     desktop) → `reportBreakageOnly` runs the FUNCTIONAL "nothing breaks / everything reachable"
 *     subset only (clipped-off-canvas + occluded <main>), ADVISORY (never fails the gate). Cosmetic
 *     imperfection off-target is acceptable & low-priority (owner directive 2026-06-30); a real break
 *     where you cannot reach a feature is surfaced loudly without red-locking commits (DR-074 §5).
 *
 * `_target.ts` is PER-PROJECT (not byte-synced), so the desktop width lives HERE (a synced file).
 *
 * Quarantine (BL-0011): a route whose work order is `BLOCKED: needs-owner` is held ASIDE via
 * `notSkipped` (engine-driven `PANDACORP_GATE_SKIP_ROUTES`, empty on a normal run — fail-closed).
 */

/** Width used for the OFF-TARGET desktop advisory pass (mobile-only projects on desktop). */
const DESKTOP_WIDTH = 1280;

/** Blessed surfaces minus any BLOCKED: needs-owner route the engine quarantined (BL-0011). */
const GATED = notSkipped(BLESSED);

test("responsive harness present", () => {
  // Fail-closed sentinel: the harness is always present even before any surface is blessed.
});

if (TARGETS_MOBILE) {
  // The project targets mobile (mobile | responsive): full, blocking checks at the mobile width.
  for (const s of GATED) {
    test(`responsive · ${s.id} (${s.path}) @${MOBILE_WIDTH}px`, async ({ page }) => {
      await assertResponsive(page, s.path, { mobileWidth: MOBILE_WIDTH });
    });
  }
} else {
  // Desktop-only: mobile polish is low-priority, but functionality must still be reachable on a phone.
  // ADVISORY no-break check (never fails the gate) — surfaces hidden/unreachable content loudly.
  for (const s of GATED) {
    test(`responsive · ${s.id} (${s.path}) @${MOBILE_WIDTH}px — no-break advisory (${TARGET_PLATFORM})`, async ({
      page,
    }, testInfo) => {
      await reportBreakageOnly(page, s.path, { mobileWidth: MOBILE_WIDTH }, testInfo);
    });
  }
}

if (TARGET_PLATFORM === "mobile") {
  // Mobile-only: it must also not BREAK on a desktop width — ADVISORY no-break check (never blocks).
  for (const s of GATED) {
    test(`responsive · ${s.id} (${s.path}) @${DESKTOP_WIDTH}px — no-break advisory (desktop)`, async ({
      page,
    }, testInfo) => {
      await reportBreakageOnly(page, s.path, { mobileWidth: DESKTOP_WIDTH }, testInfo);
    });
  }
}
