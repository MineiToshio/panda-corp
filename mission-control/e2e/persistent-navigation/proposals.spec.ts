import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";
import { assertLocation, type LocationCase } from "./_location";

const cases: LocationCase[] = [
  {
    family: "proposals-summary",
    href: "/proposals",
    selected: "proposals-tab-resumen",
    next: "proposals-tab-memoria",
    nextPath: "/proposals/memory",
    content: "proposals-page",
  },
  {
    family: "proposals",
    href: "/proposals/backlog",
    selected: "proposals-tab-backlog",
    next: "proposals-tab-memoria",
    nextPath: "/proposals/memory",
    content: "backlog-panel",
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

test("read-only details restore in Manual, Configuration and Proposals without reopening transient confirmations", async ({
  page,
}) => {
  for (const target of [
    {
      href: "/proposals/backlog/BL-0001",
      id: "backlog-detail-modal",
      text: "BL-0001",
    },
  ]) {
    await page.goto(target.href);
    await expect(page.getByTestId(target.id)).toContainText(target.text);
    await page.reload();
    await expect(page.getByTestId(target.id)).toContainText(target.text);
  }
});
