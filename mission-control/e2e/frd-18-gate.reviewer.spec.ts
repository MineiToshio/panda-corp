import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const HOME = '[data-testid="dashboard-page"]';

async function top(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await page
    .getByRole("heading", { level: 2, name: new RegExp(`^${name}`) })
    .boundingBox();
  expect(box, name).not.toBeNull();
  return { x: box?.x ?? 0, y: box?.y ?? 0 };
}

test.describe("FRD-18 gate", () => {
  test("AC-18-022.1: two columns from 1024 px, in the drawn order", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoHydrated(page, "/", { selector: HOME });
    const turn = await top(page, "Tu turno");
    const portfolio = await top(page, "Tu cartera");
    const pulse = await top(page, "Pulso");
    const guild = await top(page, "Gremio");
    const funnel = await top(page, "Embudo de ideas");
    expect(pulse.x).toBeGreaterThan(turn.x);
    expect(portfolio.y).toBeGreaterThan(turn.y);
    expect(guild.y).toBeGreaterThan(pulse.y);
    expect(funnel.y).toBeGreaterThan(guild.y);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Inicio"]);
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("AC-18-022.1: one column below 1024 px, Tu turno first", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 900 });
    await gotoHydrated(page, "/", { selector: HOME });
    const order: { x: number; y: number }[] = [];
    for (const name of ["Tu turno", "Pulso", "Gremio", "Embudo de ideas"]) {
      order.push(await top(page, name));
    }
    expect(order.every((entry) => entry.x === order[0]?.x)).toBe(true);
    const ys = order.map((entry) => entry.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  test("AC-18-022.2: the dialog traps focus and renders with no browser error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoHydrated(page, "/", { selector: HOME });
    const details = page.getByRole("button", { name: /^Detalles:/ }).first();
    await details.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Lo que se necesita de ti" })).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((node) => node.contains(document.activeElement));
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(details).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("REQ-18-002: read-only navigation reaches each destination", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoHydrated(page, "/", { selector: HOME });
    await page.getByRole("link", { name: "Abrir tablero" }).click();
    await expect(page).toHaveURL(/\/board$/, { timeout: 30_000 });
  });

  test("WO-18-002: Tu turno reaches the stream before the worktrees card", async ({ baseURL }) => {
    // Chunk boundaries depend on how fast git answers, so only the stream order is stable here.
    const body = await (await fetch(`${baseURL}/`)).text();
    const turn = body.indexOf("Tu turno");
    expect(turn).toBeGreaterThan(-1);
    expect(body.indexOf('id="worktrees-card"')).toBeGreaterThan(turn);
  });

  test("AC-18-022.3: the work-order link shape resolves to a project page", async ({ request }) => {
    const response = await request.get("/portfolio/mission-control/work-orders/WO-01-001/summary");
    expect(response.status()).toBe(200);
  });
});
