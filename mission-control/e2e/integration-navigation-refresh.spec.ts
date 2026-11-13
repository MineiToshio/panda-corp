import { expect } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { test } from "./_read-only";
import {
  controlLiveFrames,
  emitLiveFrame,
  refreshFromLiveFrame,
} from "./persistent-navigation/_live-race";

test.beforeEach(async ({ page }) => {
  await controlLiveFrames(page);
});

for (const start of [
  "/portfolio/mission-control/observability?view=dag&dag=wo&frd=FRD-01",
  "/portfolio?project=mission-control&tab=Observabilidad&view=deps&dag=wo&frd=FRD-01",
]) {
  test(`canonical refresh preserves focus from ${start}`, async ({ page }) => {
    await gotoHydrated(page, start, { selector: ".seg button" });
    // Commit the baseline debounce before selection; an advancing frame must cause a later refresh.
    await emitLiveFrame(page, 1);
    await page.getByRole("button", { name: /WO-01-003 ·/ }).click();
    await expect(page).toHaveURL(/focus=WO-01-003/);
    const response = await refreshFromLiveFrame(page, 2);
    expect(response.ok()).toBe(true);
    expect(new URL(response.url()).searchParams.get("focus")).toBe("WO-01-003");
    await expect(page).toHaveURL(/view=deps.*dag=wo.*frd=FRD-01.*focus=WO-01-003/);
    await expect(page.getByRole("region", { name: "Work order en foco" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/focus=WO-01-003/);
  });
}

test("server canonicalization preserves client model selections on reload", async ({ page }) => {
  await gotoHydrated(page, "/portfolio/mission-control/architecture?tab=architecture", {
    selector: '[data-testid="data-model-viewer"]',
  });
  await expect(page).not.toHaveURL(/tab=architecture/);
  await page
    .getByTestId("data-model-viewer")
    .getByRole("button", { name: "Diagrama", exact: true })
    .click();
  await page.getByTestId("data-model-viewer").getByRole("searchbox").fill("id");
  await expect(page).toHaveURL(/modelQuery=id/);
  await page.getByTestId("model-fullscreen").click();
  await expect(page).toHaveURL(/expanded=1/);
  await page.reload();
  await expect(page).toHaveURL(/modelQuery=id.*expanded=1/);
  await expect(page.getByTestId("data-model-viewer").getByRole("searchbox")).toHaveValue("id");
});

for (const width of [320, 390, 1280]) {
  test(`radar labels paint inside their bounded SVG at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoHydrated(page, "/achievements", { selector: "svg.radar" });
    await page.evaluate(() => document.fonts.ready);
    const labels = await page.locator("svg.radar").evaluate((svg) => {
      const bounds = svg.getBoundingClientRect();
      return Array.from(svg.querySelectorAll("text"), (text) => {
        const box = text.getBoundingClientRect();
        return {
          text: text.textContent,
          inside: box.left >= bounds.left && box.right <= bounds.right,
          fontSize: Number.parseFloat(getComputedStyle(text).fontSize),
        };
      });
    });
    expect(labels).toHaveLength(6);
    for (const label of labels) {
      expect(label.inside, label.text ?? "label").toBe(true);
      expect(label.fontSize).toBeGreaterThanOrEqual(12);
    }
  });
}
