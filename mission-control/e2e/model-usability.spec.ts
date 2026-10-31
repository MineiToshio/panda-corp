/* eslint-disable testing-library/prefer-screen-queries -- Playwright Page/Locator queries are not RTL render-result queries. */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

async function openModel(page: Page): Promise<Locator> {
  await gotoHydrated(page, "/portfolio?project=Mission%20Control&tab=architecture", {
    selector: '[data-testid="data-model-viewer"] input',
  });
  await page.getByRole("button", { name: "Diagrama", exact: true }).click();
  await expect(page.getByTestId("model-viewport")).toBeVisible();
  return page.getByTestId("data-model-viewer");
}

test("AC-02-015.2 AC-02-015.5: only relationship rows activate connectors and toggle explicitly", async ({
  page,
}) => {
  const viewer = await openModel(page);
  await viewer.locator("summary").filter({ hasText: "Relaciones" }).click();
  const ownership = viewer.getByRole("button", { name: "Ver relación Posee", exact: true });
  await ownership.click();
  await expect(ownership).toHaveAttribute("aria-pressed", "true");
  await ownership.press("Enter");
  await expect(ownership).toHaveAttribute("aria-pressed", "false");
  await expect(viewer.locator("svg [role=button],svg [tabindex]")).toHaveCount(0);
});

test("AC-02-015.6 AC-02-015.13: fullscreen diagram fields reject text selection and pointer pan clears an existing Range", async ({
  page,
}) => {
  const viewer = await openModel(page);
  await viewer.getByRole("button", { name: "Pantalla completa" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe("DIV");
  const dialog = viewer.locator(":scope > div:fullscreen");
  await dialog.getByRole("searchbox").fill("users");
  const field = dialog
    .locator('section[aria-label="users"]')
    .getByRole("cell", { name: "email", exact: true });
  await field.dblclick();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  await field.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  expect(await page.evaluate(() => getSelection()?.rangeCount)).toBe(1);
  expect(await page.evaluate(() => getSelection()?.isCollapsed)).toBe(false);
  await page.getByTestId("model-viewport").click({ position: { x: 8, y: 300 } });
  expect(await page.evaluate(() => getSelection()?.isCollapsed)).toBe(true);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  await page.getByTestId("model-close").click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.getByTestId("model-viewport")).toHaveCount(1);
});

test("AC-02-015.4: schema starts closed in one column, opens one entity at a time and retains copyable complete code", async ({
  page,
}) => {
  const viewer = await openModel(page);
  await viewer.getByRole("button", { name: "Esquema", exact: true }).click();
  const entities = viewer.locator("details[aria-label]");
  await expect(entities).toHaveCount(6);
  await expect(viewer.locator("details[aria-label][open]")).toHaveCount(0);
  const rows = await entities.evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { x: box.x, width: box.width, y: box.y, bottom: box.bottom };
    }),
  );
  for (let index = 1; index < rows.length; index += 1) {
    expect(rows[index]?.x).toBe(rows[0]?.x);
    expect(rows[index]?.width).toBe(rows[0]?.width);
    expect(rows[index]?.y).toBeGreaterThanOrEqual(rows[index - 1]?.bottom ?? 0);
  }
  const users = viewer.locator('details[aria-label="users"]');
  const membership = viewer.locator('details[aria-label="collection_items"]');
  await users.locator("summary").click();
  await expect(users.locator("code")).toBeVisible();
  await expect(users.locator("code")).toContainText('@relation("Posee", collections');
  await membership.locator("summary").click();
  await expect(users).not.toHaveAttribute("open", "");
  await expect(viewer.locator("details[aria-label][open]")).toHaveCount(1);
  const code = membership.locator("code");
  await expect(code).toContainText("@@id([collection_id, item_id])");
  await expect(code).toContainText("timestamp");
  await expect(code).toContainText("integer?");
  await expect(membership.locator("pre")).toHaveCSS("max-height", "none");
  await expect(membership.locator("pre")).toHaveCSS("user-select", "text");
  await code.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  expect(await page.evaluate(() => getSelection()?.toString())).toContain(
    "@@id([collection_id, item_id])",
  );
  await membership.locator("summary").press("Space");
  await expect(viewer.locator("details[aria-label][open]")).toHaveCount(0);
});
