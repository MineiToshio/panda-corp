import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";
import { assertLocation, type LocationCase } from "./_location";

const cases: LocationCase[] = [
  {
    family: "portfolio",
    href: "/portfolio/mission-control/spec",
    selected: "tab-spec",
    next: "tab-architecture",
    nextPath: "/portfolio/mission-control/architecture",
    content: "card-detail-spec",
  },
  {
    family: "standalone",
    href: "/projects/mission-control/spec",
    selected: "tab-spec",
    next: "tab-architecture",
    nextPath: "/projects/mission-control/architecture",
    content: "card-detail-spec",
  },
];
for (const target of cases) {
  test(`${target.family}: direct, reload, fresh paste, Back and Forward restore semantic selection`, async ({
    page,
    browser,
  }) => {
    await gotoHydrated(page, target.href, { selector: `[data-testid="${target.selected}"]` });
    await assertLocation(page, target);
    await page.reload();
    await assertLocation(page, target);
    const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    try {
      const pasted = await fresh.newPage();
      await pasted.goto(page.url());
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

test("AC-04-013.2 AC-04-013.3: the standalone query alias resolves before dialog focus ownership", async ({
  page,
}) => {
  await gotoHydrated(page, "/projects/mission-control?tab=spec", {
    selector: '[data-testid="tab-spec"]',
  });
  await expect(page).toHaveURL(/\/projects\/mission-control\/spec$/);
  const open = page.getByTestId("card-detail-spec").getByRole("button", { name: /^FRD-01 / });
  await open.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(open).toBeFocused();
  const spec = page.getByRole("tab", { name: "Spec", exact: true });
  await spec.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^Observabilidad/ })).toBeFocused();
});
