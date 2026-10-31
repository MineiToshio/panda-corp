import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";
import { assertLocation, type LocationCase } from "./_location";

const cases: LocationCase[] = [
  {
    family: "configuration",
    href: "/configuration/rules/DR-009",
    selected: "config-tab-rules",
    next: "config-tab-standards",
    nextPath: "/configuration/standards",
    content: "rule-detail",
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
      href: "/configuration/standards/quality.md?severity=MUST",
      id: "standard-markdown-body",
      text: "Quality",
      selected: "config-tab-standards",
    },
    {
      href: "/configuration/agents/reviewer",
      id: "agent-dialog-modal",
      text: "Herramientas:",
      selected: "config-tab-agents",
    },
  ]) {
    await gotoHydrated(page, target.href, { selector: `[data-testid="${target.selected}"]` });
    await expect(page.getByTestId(target.id)).toContainText(target.text);
    await page.reload();
    await expect(page.getByTestId(target.id)).toContainText(target.text);
  }
});
