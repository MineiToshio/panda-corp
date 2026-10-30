import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";

test("authored Manual selection, anchor, fresh paste and history restore the addressed article", async ({
  page,
  browser,
}) => {
  const href = "/manual/concepts/el-pipeline#el-pipeline--de-idea-a-producto";
  await gotoHydrated(page, href, { selector: '[data-testid="doc-nav-item-concepts-el-pipeline"]' });
  await expect(page.getByTestId("doc-reader-authored")).toContainText("pipeline");
  await expect(page.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const pasted = await fresh.newPage();
    await pasted.goto(page.url());
    await expect(pasted.getByTestId("doc-reader-authored")).toContainText("pipeline");
    await expect(pasted.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
  } finally {
    await fresh.close();
  }
  await page.getByTestId("doc-nav-item-reference-rules").click();
  await expect(page).toHaveURL(/\/manual\/reference\/rules/);
  await page.goBack();
  await expect(page.getByTestId("doc-reader-authored")).toContainText("pipeline");
  await page.goForward();
  await expect(page.getByTestId("doc-reader-reference")).toBeVisible();
});

test("read-only details restore in Manual, Configuration and Proposals without reopening transient confirmations", async ({
  page,
}) => {
  for (const target of [
    { href: "/manual/reference/agents/reviewer", id: "agent-detail", text: "reviewer" },
  ]) {
    await page.goto(target.href);
    await expect(page.getByTestId(target.id)).toContainText(target.text);
    await page.reload();
    await expect(page.getByTestId(target.id)).toContainText(target.text);
  }
});
