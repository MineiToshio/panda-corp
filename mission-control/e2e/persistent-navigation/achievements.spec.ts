import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";
import { assertLocation, type LocationCase } from "./_location";

const cases: LocationCase[] = [
  {
    family: "achievements",
    href: "/achievements/ranks",
    selected: "logros-tab-rangos",
    next: "logros-tab-resumen",
    nextPath: "/achievements/summary",
    content: "logros-tabs",
  },
];
for (const target of cases) {
  test(`${target.family}: direct, reload, fresh paste, Back and Forward restore semantic selection`, async ({
    page,
    browser,
  }) => {
    // The slowest route takes five full navigations here, too close to the 30 s default under gate load.
    test.slow();
    await gotoHydrated(page, target.href, { selector: `[data-testid="${target.selected}"]` });
    await assertLocation(page, target);
    await page.reload();
    await assertLocation(page, target);
    const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    try {
      const pasted = await fresh.newPage();
      await gotoHydrated(pasted, page.url(), { selector: '[data-testid="logros-tab-rangos"]' });
      await assertLocation(pasted, target);
    } finally {
      await fresh.close();
    }
    await page.getByTestId(target.next).click();
    await expect(page).toHaveURL(new RegExp(`${target.nextPath}$`));
    await expect(page.getByTestId(target.next)).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await assertLocation(page, target);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${target.nextPath}$`));
    await expect(page.getByTestId(target.next)).toHaveAttribute("aria-selected", "true");
  });
}
