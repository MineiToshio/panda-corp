import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";

test("model schema entity and search restore; search replaces history and expanded paste never requests native fullscreen", async ({
  page,
  browser,
}) => {
  const href =
    "/portfolio/mission-control/architecture?model=schema&schemaTable=users&entity=users&modelQuery=email";
  await gotoHydrated(page, href, { selector: '[data-testid="data-model-viewer"] input' });
  const viewer = page.getByTestId("data-model-viewer");
  await expect(viewer.getByRole("tab", { name: "Esquema", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(viewer.locator('details[aria-label="users"]')).toHaveAttribute("open", "");
  await expect(viewer.getByRole("searchbox")).toHaveValue("email");
  await page.reload();
  await expect(viewer.locator('details[aria-label="users"] code')).toBeVisible();
  const beforeSearch = await page.evaluate(() => history.length);
  await viewer.getByRole("searchbox").fill("users");
  await expect.poll(() => new URL(page.url()).searchParams.get("modelQuery")).toBe("users");
  expect(await page.evaluate(() => history.length)).toBe(beforeSearch);
  await viewer.getByRole("tab", { name: "Diagrama", exact: true }).click();
  await page.goBack();
  await expect(viewer.getByRole("tab", { name: "Esquema", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goForward();
  await expect(viewer.getByRole("tab", { name: "Diagrama", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const expanded = new URL(page.url());
  expanded.searchParams.set("expanded", "1");
  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const pasted = await fresh.newPage();
    await pasted.goto(expanded.toString());
    await expect(pasted.getByRole("dialog", { name: "Modelo de datos" })).toBeVisible();
    expect(await pasted.evaluate(() => document.fullscreenElement)).toBeNull();
    await pasted.reload();
    await expect(pasted.getByRole("dialog", { name: "Modelo de datos" })).toBeVisible();
    expect(await pasted.evaluate(() => document.fullscreenElement)).toBeNull();
  } finally {
    await fresh.close();
  }
});
