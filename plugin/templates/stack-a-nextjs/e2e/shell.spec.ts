import { expect, type Page, test } from "@playwright/test";
import { MOBILE_WIDTH, TARGETS_MOBILE } from "./_target";
import { SURFACES } from "./routes";
import { HAS_SHELL, NAV_DESTINATIONS, NAV_TOGGLE, SHELL_EXEMPT, SHELL_SELECTOR } from "./shell";

/**
 * Shell-Presence Gate (DR-075) — the SHIPPED, deterministic, fail-closed fix for "a whole nav menu
 * went missing and passed green". The visual gate (visual.spec) is a SELF-baseline regression guard:
 * it proves CONSISTENCY (matches its own committed baseline), NOT FIDELITY — a build rendered
 * menu-less → menu-less baseline → green. This gate asserts the app against the PROTOTYPE's nav
 * contract (shell.ts), author-declared at design time, so a missing/incomplete shell is RED, never
 * silently blessed. VERBATIM stack template (DR-059): byte-diffed + conformance-checked by
 * /pandacorp:upgrade. The per-project seed is shell.ts (never byte-diffed).
 *
 * It iterates SURFACES (every declared route minus the author-declared SHELL_EXEMPT), NOT BLESSED:
 * the MC failure is a route that shipped BLESSED while the shell was absent, so gating on `blessed`
 * would inherit the same blind spot. Empty NAV_DESTINATIONS ⇒ no shell ⇒ vacuous pass.
 *
 * Settle-first (mirror _responsive-helper, DR-071): abort the live transport (an open SSE never lets
 * networkidle settle) → domcontentloaded → fonts.ready → <main> visible → THEN web-first
 * auto-retrying assertions (which absorb client-side hydration of the nav). Never networkidle, never
 * a bare .count() (no retry), never waitForTimeout.
 */

const LIVE_ENDPOINT_GLOB = "**/api/live**";

const matchesExempt = (path: string): boolean =>
  SHELL_EXEMPT.some((p) => (p.endsWith("/**") ? path.startsWith(p.slice(0, -2)) : path === p));

async function settle(page: Page, url: string): Promise<void> {
  await page.route(LIVE_ENDPOINT_GLOB, (r) => r.abort());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main").first()).toBeVisible();
}

test("shell harness present", () => {
  // Fail-closed sentinel: the harness is always present even before a shell contract is declared.
  expect(NAV_DESTINATIONS.length).toBeGreaterThanOrEqual(0);
});

if (HAS_SHELL) {
  const [firstDest] = NAV_DESTINATIONS;
  const gated = SURFACES.filter((s) => !matchesExempt(s.path));

  // (1) The persistent shell landmark is VISIBLE on every non-exempt route — catches "shell missing
  //     on a page" (visible, not merely attached: a display:none / off-canvas nav is not a shell).
  for (const s of gated) {
    test(`shell · landmark visible on ${s.id} (${s.path})`, async ({ page }) => {
      await settle(page, s.path);
      await expect(
        page.locator(SHELL_SELECTOR).first(),
        `no visible app shell (${SHELL_SELECTOR}) on ${s.path}`,
      ).toBeVisible();
    });
  }

  // (2) Every prototype nav destination is a VISIBLE link INSIDE the shell, pointing to its CORRECT
  //     path — kills dead hrefs (href="/"/"#"/404), page-wide stray links, and an empty landmark.
  test("shell · every nav destination is reachable from the shell", async ({ page }) => {
    if (!firstDest) return;
    await settle(page, firstDest.path);
    const shell = page.locator(SHELL_SELECTOR).first();
    await expect(shell, `no visible app shell (${SHELL_SELECTOR})`).toBeVisible();
    for (const d of NAV_DESTINATIONS) {
      const link = shell.getByRole("link", { name: d.label, exact: true });
      await expect(link, `nav link "${d.label}" missing/invisible inside the shell`).toBeVisible();
      const href = await link.getAttribute("href");
      expect(href, `nav link "${d.label}" → "${href}"; expected "${d.path}"`).toBe(d.path);
    }
  });

  // (3) Each declared destination actually 2xx-renders — a nav link to a route that errors/404s is a
  //     broken shell. Once per destination, not per route.
  for (const d of NAV_DESTINATIONS) {
    test(`shell · destination ${d.path} resolves`, async ({ page }) => {
      await page.route(LIVE_ENDPOINT_GLOB, (r) => r.abort());
      const res = await page.goto(d.path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${d.path} HTTP status`).toBeLessThan(400);
      await expect(page.locator("main, h1").first()).toBeVisible();
    });
  }

  // (4) Mobile: the nav is reachable — visible directly, OR revealed by the author-declared toggle
  //     (the responsive gate checks overflow / tap-targets, NOT nav reachability). Runs only when the
  //     project's target_platforms includes mobile (_target.ts).
  if (TARGETS_MOBILE) {
    test(`shell · mobile nav reachable @${MOBILE_WIDTH}px`, async ({ page }) => {
      if (!firstDest) return;
      await page.setViewportSize({ width: MOBILE_WIDTH, height: 844 });
      await settle(page, firstDest.path);
      const firstLink = page
        .locator(SHELL_SELECTOR)
        .first()
        .getByRole("link", { name: firstDest.label, exact: true });
      if (await firstLink.isVisible()) return; // nav visible without a toggle — ok
      const toggle = page.locator(NAV_TOGGLE).first();
      await expect(toggle, "mobile nav hidden and no data-nav-toggle reveals it").toBeVisible();
      await toggle.click();
      await expect(firstLink, "data-nav-toggle did not reveal the nav").toBeVisible();
    });
  }
} else {
  test("shell · skipped (no NAV_DESTINATIONS — app has no persistent shell)", () => {
    // Single-screen tool / landing / API / scraper: vacuous pass by design (DR-075).
  });
}
