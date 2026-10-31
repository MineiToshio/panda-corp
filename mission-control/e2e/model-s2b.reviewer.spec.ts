import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const ROUTE = "/portfolio/mission-control/architecture";
const SELECTOR = '[data-testid="data-model-viewer"] input';

test.describe("desktop width", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test("AC-02-015.3: desktop default renders clean, with content-sized fields in the top-right toolbar frame", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await gotoHydrated(page, ROUTE, { selector: SELECTOR });
    const canvas = page.getByTestId("model-viewport");
    await expect(canvas).toBeVisible();
    const row = page.locator(".entity tbody tr").first();
    // Layout height: the stage is scaled by the camera, so a bounding box would measure the zoom.
    expect(await row.evaluate((node) => (node as HTMLElement).offsetHeight)).toBe(24);
    await expect(row.locator("td").first()).toHaveCSS("font-size", "12px");
    const clipped = await page.locator(".entity").evaluateAll((cards) =>
      cards.flatMap((card) => {
        // The card border is 1 px outside the computed columns: only a larger overrun clips content.
        const frame = card.getBoundingClientRect();
        return [...card.querySelectorAll("td *, td")]
          .filter((node) => node.getBoundingClientRect().right > frame.right + 2)
          .map((node) => `${card.getAttribute("aria-label")}: ${node.textContent}`);
      }),
    );
    expect(clipped).toEqual([]);
    const bar = await page.getByTestId("model-zoom").boundingBox();
    const frame = await canvas.boundingBox();
    if (!bar || !frame) throw new Error("toolbar or canvas absent");
    expect(bar.x + bar.width).toBeGreaterThan(frame.x + frame.width * 0.75);
    expect(bar.y).toBeLessThan(frame.y + frame.height * 0.25);
    expect(errors).toEqual([]);
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("AC-02-015.3: phones open on Esquema with no diagram camera mounted", async ({ page }) => {
    await gotoHydrated(page, ROUTE, { selector: SELECTOR });
    const viewer = page.getByTestId("data-model-viewer");
    await expect(viewer.getByRole("button", { name: "Esquema", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("model-viewport")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("expanded")).toBeNull();
  });
});
