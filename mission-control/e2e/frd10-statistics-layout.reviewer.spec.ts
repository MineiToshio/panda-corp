import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

/**
 * Reviewer-authored (DR-080): the statistics tab never overflows its viewport, at the
 * phone floor and at the desktop widths the last grid change touched.
 */
const WIDTHS = [320, 390, 768, 1024, 1280, 1440] as const;
for (const width of WIDTHS) {
  test(`AC-10-026.1 AC-10-028.5 statistics has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoHydrated(page, "/achievements/statistics", {
      selector: '[data-testid="informe-report"] button',
    });
    await expect(page.getByTestId("informe-report")).toBeVisible();
    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement as Element;
      const viewport = document.documentElement.clientWidth;
      const report = document.querySelector('[data-testid="informe-report"]') as Element;
      const clipped = [...report.querySelectorAll("*")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.right > viewport + 1;
        })
        .slice(0, 5)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`);
      return { scroll: root.scrollWidth - root.clientWidth, clipped };
    });
    expect(overflow).toEqual({ scroll: 0, clipped: [] });
  });
}

test("AC-10-026.1 the three ledgers hold eight rows each and align", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoHydrated(page, "/achievements/statistics", {
    selector: '[data-testid="informe-report"] button',
  });
  const columns = page.getByTestId("stat-ledger-column");
  await expect(columns).toHaveCount(3);
  const tops = await columns.evaluateAll((els) =>
    els.map((el) => [
      Math.round(el.getBoundingClientRect().top),
      Math.round(el.getBoundingClientRect().height),
      el.querySelectorAll('[data-testid="stat-ledger-row"]').length,
    ]),
  );
  expect(tops.map((row) => row[2])).toEqual([8, 8, 8]);
  expect(new Set(tops.map((row) => row[0])).size).toBe(1);
  expect(new Set(tops.map((row) => row[1])).size).toBe(1);
});

test("the statistics route hydrates without a mismatch", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
  });
  await gotoHydrated(page, "/achievements/statistics", {
    selector: '[data-testid="informe-report"] button',
  });
  await expect(page.getByTestId("informe-report")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [320, 390] as const) {
  test(`AC-10-022.3 stats-stream-error keeps a long source path inside ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await gotoHydrated(page, "/achievements/statistics", {
      selector: '[data-testid="informe-report"] button',
    });
    const notice = page
      .getByRole("alert")
      .filter({ hasText: "No se pudo leer el registro de uso" });
    await notice.locator("p").evaluate((node) => {
      // The oracle state draws this real unbreakable path, longer than the e2e fixture root.
      node.textContent =
        "/Users/owner/Proyectos/panda-corp/mission-control/docs/design/prototype/fixtures/home/.codex/dashboard-events.ndjson (missing)";
    });
    const scroll = await page.evaluate(() => {
      const root = document.scrollingElement as Element;
      return root.scrollWidth - root.clientWidth;
    });
    expect(scroll).toBe(0);
  });
}
