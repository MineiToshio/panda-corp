import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";

test("authored documentation selection, anchor, fresh paste and history restore the addressed article", async ({
  page,
  browser,
}) => {
  const href = "/manual/concepts/el-pipeline#el-pipeline--de-idea-a-producto";
  await gotoHydrated(page, href, { selector: '[data-testid="doc-reader-authored"]' });
  await expect(page.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const pasted = await fresh.newPage();
    await pasted.goto(page.url());
    await expect(pasted.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
  } finally {
    await fresh.close();
  }
  await page.getByRole("link", { name: /Siguiente en Conceptos/ }).click();
  await expect(page).not.toHaveURL(new RegExp(`${href}$`));
  await page.goBack();
  await expect(page.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
});

test("legacy catalog resource links redirect to Configuration and survive reload", async ({
  page,
}) => {
  for (const [catalog, section] of [
    ["commands", "skills"],
    ["agents", "agents"],
    ["rules", "rules"],
    ["standards", "standards"],
  ]) {
    await page.goto(`/manual/reference/${catalog}`);
    await expect(page).toHaveURL(new RegExp(`/configuration/${section}$`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/configuration/${section}$`));
  }
  await page.goto("/manual/reference/agents/reviewer");
  await expect(page).toHaveURL(/\/configuration\/agents\/reviewer$/);
});
