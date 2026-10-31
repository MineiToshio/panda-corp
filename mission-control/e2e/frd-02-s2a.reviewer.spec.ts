import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const SHOTS = process.env.S2A_SHOTS;

test("board and campaign render with no console or page error", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await gotoHydrated(page, "/board", { selector: '[role="switch"]' });
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/board-${info.project.name}.png`, fullPage: true });
  const mobile = (page.viewportSize()?.width ?? 0) < 700;
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await gotoHydrated(page, "/board/idea-in-pipeline/campaign", {
    selector: '[data-testid="campaign-phase-design"]',
  });
  await expect(page.getByTestId("campaign-stage")).toBeVisible();
  await expect(page.locator(".room img").first()).toHaveJSProperty("complete", true);
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/campaign-${info.project.name}.png`, fullPage: true });
  const stage = await page.getByTestId("campaign-stage").boundingBox();
  const overflow2 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow2).toBeLessThanOrEqual(0);
  expect(stage?.height ?? 0).toBeGreaterThan(mobile ? 200 : 100);
  expect(errors).toEqual([]);
});

test("a keyboard toggle keeps focus on the star", async ({ page }) => {
  await gotoHydrated(page, "/board", { selector: '[role="switch"]' });
  const star = page.getByTestId("favorite-button").first();
  const fs = await import("node:fs");
  const fixture = "e2e/fixtures/factory-root/factory/ideas/idea-discovered.md";
  const original = fs.readFileSync(fixture);
  try {
    await star.focus();
    await page.keyboard.press("Space");
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(star).toBeEnabled();
    await expect(star).toBeFocused();
  } finally {
    await expect(star).toBeEnabled();
    if ((await star.getAttribute("aria-pressed")) === "true") await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(star).toBeEnabled();
    fs.writeFileSync(fixture, original);
  }
});

test("the phase jump works and a discarded row opens that idea", async ({ page }) => {
  await gotoHydrated(page, "/board", { selector: '[role="switch"]' });
  await page.getByRole("button", { name: /^Descartadas/ }).click();
  const dialog = page.getByRole("dialog");
  const rows = dialog.getByRole("button").filter({ hasText: "leer propuesta" });
  await expect(rows).not.toHaveCount(0);
  await rows.first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("idea-board")).toBeVisible();
});

test("every implement sheet offers the build-mode picker", async ({ page }) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/campaign", {
    selector: '[data-testid="campaign-phase-design"]',
  });
  for (const key of ["architecture", "build"] as const) {
    await page.getByTestId(`campaign-phase-${key}`).click();
    const sheet = page.getByTestId("ficha-next-step");
    await sheet.getByText("Elegir modo de construcción").click();
    const picker = sheet.getByTestId("build-mode-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId("build-mode-pro")).toBeVisible();
  }
});
