import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

/** Reviewer-authored (DR-080): the wave 6 sidebar contracts read from the real accessibility tree. */
const HYDRATED = { selector: '#app[data-hydrated="true"]' };
const FULL = [
  "Inicio",
  "Tablero",
  "Portafolio",
  "Propuestas",
  "Logros",
  "Documentación",
  "Configuración",
];
const MINI = ["Inicio", "Tablero", "Portafolio", "Propuestas", "Logros", "Docs", "Ajustes"];

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await gotoHydrated(page, "/board", HYDRATED);
}

test("AC-19-003.2: each destination's accessible name is its one rendered label", async ({
  page,
}) => {
  await open(page, 1280);
  const nav = page.getByTestId("app-nav");
  for (const name of FULL)
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(1);
  await open(page, 900);
  for (const name of MINI)
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(1);
});

test("AC-19-005.2: a destination with a count keeps its exact name and carries the description", async ({
  page,
}) => {
  await open(page, 1280);
  const tablero = page.getByTestId("app-nav").getByRole("link", { name: "Tablero", exact: true });
  await expect(tablero.locator(".count")).toHaveAttribute("aria-hidden", "true");
  await expect(tablero).toHaveAccessibleDescription(/\d/);
});

test("AC-19-005.3: the collapsed rail keeps every destination named and reduces the guild card to the crest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("orbita-sidebar", "collapsed"));
  await gotoHydrated(page, "/board", HYDRATED);
  await page.mouse.move(1000, 500);
  const sidebar = page.locator("aside#sidebar");
  await expect(sidebar).toHaveAttribute("data-float", "false");
  const nav = page.getByTestId("app-nav");
  for (const name of FULL)
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(1);
  await expect(nav.getByTestId("app-nav-inicio").locator(".lbl")).toHaveCSS("position", "absolute");
  expect((await sidebar.boundingBox())?.width).toBe(64);
  const card = sidebar.locator(".guildcard");
  await expect(card.locator(".crest")).toBeVisible();
  await expect(card.locator(".gtext")).toBeHidden();
  await expect(card.locator('[role="progressbar"]')).toBeHidden();
});
