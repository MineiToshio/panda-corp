import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";
import { assertLocation, type LocationCase } from "./_location";

const cases: LocationCase[] = [
  {
    family: "board",
    href: "/board/idea-in-pipeline/spec",
    selected: "card-detail-tab-spec",
    next: "card-detail-tab-arquitectura",
    nextPath: "/board/idea-in-pipeline/architecture",
    content: "card-detail-panel-spec",
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

test("Board document reader and campaign phase restore through direct URLs and refresh", async ({
  page,
}) => {
  await page.goto("/board/idea-in-pipeline/documents/docs%2Fproduct%2Fprd.md#vision");
  await expect(page.getByTestId("card-detail-doc-reader")).toContainText("factory dashboard");
  await page.reload();
  await expect(page.getByTestId("card-detail-doc-reader")).toContainText("factory dashboard");
  await gotoHydrated(page, "/board/idea-in-pipeline/campaign?phase=design", {
    selector: '[data-testid="card-detail-tab-campana"]',
  });
  await expect(page.getByRole("region", { name: "Diseño", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Diseño", exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("phase")).toBe("design");
});

test("AC-02-010.11 AC-02-016.6 AC-25-001.1 AC-25-002.1 campaign rooms and arrows keep the sheet pinned across browser history", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/campaign?phase=design", {
    selector: '[data-testid="campaign-phase-design"]',
  });
  const design = page.getByRole("button", { name: /3\. Diseño:/ });
  await design.click();
  await expect(page.getByRole("region", { name: "Diseño", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fase siguiente: Arquitectura", exact: true }).click();
  await expect(page).toHaveURL(/phase=architecture/);
  await expect(page.getByRole("region", { name: "Arquitectura", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Diseño", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("region", { name: "Arquitectura", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Arquitectura", exact: true })).toBeVisible();
});
