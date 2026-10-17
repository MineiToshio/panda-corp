/* eslint-disable testing-library/prefer-screen-queries -- Playwright Page/Locator queries are not RTL render-result queries. */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

async function openModel(page: Page): Promise<Locator> {
  await gotoHydrated(page, "/portfolio?project=Mission%20Control&tab=architecture", {
    selector: '[data-testid="data-model-viewer"] input',
  });
  await expect(page.getByTestId("model-viewport")).toBeVisible();
  return page.getByTestId("data-model-viewer");
}

async function edgePoint(relation: Locator): Promise<{ x: number; y: number }> {
  return relation
    .locator("path")
    .first()
    .evaluate((element) => {
      if (!(element instanceof SVGPathElement)) throw new Error("Relationship hit path missing");
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error("Relationship path is not rendered");
      const point = element.getPointAtLength(element.getTotalLength() / 2).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
}

test("relationships toggle with repeated pointer and keyboard activation and switch directly", async ({
  page,
}) => {
  await openModel(page);
  await page.getByTestId("model-zoom-fit").click();
  await page.getByTestId("model-viewport").scrollIntoViewIfNeeded();
  const ownership = page.getByRole("button", { name: "Ver relación Posee", exact: true });
  const profile = page.getByRole("button", { name: "Ver relación Tiene perfil", exact: true });
  const point = await edgePoint(ownership);
  await page.mouse.click(point.x, point.y);
  await expect(ownership).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(point.x, point.y);
  await expect(ownership).toHaveAttribute("aria-pressed", "false");
  await page.mouse.dblclick(point.x, point.y);
  await expect(ownership).toHaveAttribute("aria-pressed", "false");
  for (const key of ["Enter", "Space"]) {
    await ownership.focus();
    await ownership.press(key);
    await expect(ownership).toHaveAttribute("aria-pressed", "true");
    await ownership.press(key);
    await expect(ownership).toHaveAttribute("aria-pressed", "false");
  }
  await ownership.press("Enter");
  await profile.focus();
  await profile.press("Enter");
  await expect(profile).toHaveAttribute("aria-pressed", "true");
  await expect(ownership).toHaveAttribute("aria-pressed", "false");
});

test("fullscreen diagram fields reject text selection and pointer pan clears an existing Range", async ({
  page,
}) => {
  const viewer = await openModel(page);
  await viewer.getByRole("button", { name: "Ampliar modelo" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe("DIV");
  const dialog = page.getByRole("dialog", { name: "Modelo de datos" });
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

test("schema starts closed in one column, opens one entity at a time and retains copyable complete code", async ({
  page,
}) => {
  const viewer = await openModel(page);
  await viewer.getByRole("tab", { name: "Esquema", exact: true }).click();
  const entities = viewer.locator("details");
  await expect(entities).toHaveCount(6);
  await expect(viewer.locator("details[open]")).toHaveCount(0);
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
  await expect(viewer.locator("details[open]")).toHaveCount(1);
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
  await expect(viewer.locator("details[open]")).toHaveCount(0);
});
