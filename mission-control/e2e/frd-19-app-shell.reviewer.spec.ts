import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { SURFACES } from "./routes";
import { NAV_DESTINATIONS, SHELL_EXEMPT } from "./shell";

// Reviewer-authored (DR-080): builder-blind v2 acceptance of the FRD-19 frame, on every declared
// surface and at the exact breakpoint boundaries, not only the implementer's /board sample.

const ACTIVE: readonly [RegExp, string][] = [
  [/^\/$/, "inicio"],
  [/^\/board(\/|$)/, "tablero"],
  [/^\/(portfolio|projects)(\/|$)/, "portfolio"],
  [/^\/proposals(\/|$)/, "propuestas"],
  [/^\/achievements(\/|$)/, "logros"],
  [/^\/manual(\/|$)/, "documentacion"],
  [/^\/configuration(\/|$)/, "configuracion"],
];

// Transition ledger (blueprint "Risk: nested <main>"): v1 pages not yet rebuilt on PageHead. An
// entry leaves here with its surface work order; any other surface growing a main is RED.
const TRANSIENT_NESTED_MAIN: Readonly<Record<string, number>> = {
  "/portfolio": 1, // WO-04-011 (embedded tab-summary)
  "/projects/mission-control": 1, // WO-04-011 (tab-summary)
  "/manual": 1, // WO-08-003 (DocReader)
  "/configuration": 1, // WO-07-006
};

// The first client navigation to a route compiles it in `next dev`, far slower under a loaded gate.
const NAVIGATION_TIMEOUT_MS = 15_000;

async function open(page: Page, width: number, path: string): Promise<void> {
  await page.route("**/api/live**", (route) => route.abort());
  await page.setViewportSize({ width, height: 900 });
  await gotoHydrated(page, path, { selector: '#app[data-hydrated="true"]' });
}

test("AC-19-004.2: the contract has no exempt route and all seven destinations", () => {
  expect(SHELL_EXEMPT).toEqual([]);
  expect(NAV_DESTINATIONS.map((item) => item.path)).toEqual([
    "/",
    "/board",
    "/portfolio",
    "/proposals",
    "/achievements",
    "/manual",
    "/configuration",
  ]);
});

for (const surface of SURFACES) {
  for (const width of [1280, 768, 390]) {
    test(`AC-19-001.1, AC-19-002.1, AC-19-004.1: ${surface.path} @${width}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !/api\/live|ERR_FAILED/.test(message.text())) {
          errors.push(message.text());
        }
      });
      await open(page, width, surface.path);
      await expect(page.getByTestId("app-shell")).toHaveCount(1);
      await expect(page.locator("aside#sidebar")).toHaveCount(1);
      await expect(page.locator("main#content")).toHaveCount(1);
      await expect(page.locator("main#content")).toBeVisible();
      const expected = ACTIVE.find(([pattern]) => pattern.test(surface.path))?.[1];
      await expect(page.locator('[data-testid^="app-nav-"][aria-current="page"]')).toHaveCount(1);
      await expect(page.getByTestId(`app-nav-${expected}`)).toHaveAttribute("aria-current", "page");
      const inert = await page.locator("aside#sidebar").getAttribute("inert");
      expect(inert !== null).toBe(width < 760);
      await page.mouse.move(width / 2, 450);
      await page.mouse.wheel(200, 0);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      await expect(page.locator("main main")).toHaveCount(TRANSIENT_NESTED_MAIN[surface.path] ?? 0);
      expect(errors).toEqual([]);
    });
  }
}

for (const [width, sidebar, phone] of [
  [1180, 252, false],
  [1179, 76, false],
  [760, 76, false],
  [759, 0, true],
] as const) {
  test(`AC-19-003.1/.2/.3: exact boundary ${width}`, async ({ page }) => {
    await open(page, width, "/board");
    await expect(page.locator("#menu").and(page.locator(":visible"))).toHaveCount(phone ? 1 : 0);
    await expect(page.locator("nav#bottomnav").and(page.locator(":visible"))).toHaveCount(
      phone ? 1 : 0,
    );
    if (!phone) {
      expect((await page.locator("aside#sidebar").boundingBox())?.width).toBe(sidebar);
    }
  });
}

test("AC-19-002.2: an unknown route keeps the shell with no active destination", async ({
  page,
}) => {
  await page.route("**/api/live**", (route) => route.abort());
  const response = await page.goto("/manual-other", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.locator("aside#sidebar")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página no encontrada");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator('[data-testid^="app-nav-"][aria-current="page"]')).toHaveCount(0);
  await expect(page.locator('#bottomnav [aria-current="page"]')).toHaveCount(0);
});

for (const width of [1280, 768]) {
  for (const tab of ["proposal", "spec", "architecture"]) {
    test(`AC-19-001.1: full-bleed bands never cover the sidebar on ${tab} @${width}`, async ({
      page,
    }) => {
      await open(page, width, `/board/idea-in-pipeline/${tab}`);
      const links = page.getByTestId("app-nav").getByRole("link");
      await expect(links).toHaveCount(7);
      for (const link of await links.all()) {
        await link.scrollIntoViewIfNeeded();
        await link.click({ trial: true, timeout: 3000 });
      }
    });
  }
}

test("AC-19-001.4: every sidebar destination navigates client-side", async ({ page }) => {
  await open(page, 1280, "/");
  await page.evaluate(() => Reflect.set(window, "shellSentinel", true));
  for (const destination of NAV_DESTINATIONS) {
    const link = page.locator("aside#sidebar").getByRole("link", {
      name: destination.label,
      exact: true,
    });
    await expect(link).toHaveAttribute("href", destination.path);
    await link.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: NAVIGATION_TIMEOUT_MS })
      .toMatch(new RegExp(`^${destination.path === "/" ? "/$" : destination.path}(/|$)`));
    await expect(link).toHaveAttribute("aria-current", "page", {
      timeout: NAVIGATION_TIMEOUT_MS,
    });
  }
  expect(await page.evaluate(() => Reflect.get(window, "shellSentinel"))).toBe(true);
});

test("AC-19-001.5: keyboard order is skip, brand, nav, with no desktop trap", async ({ page }) => {
  await open(page, 1280, "/board");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido", exact: true });
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())?.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Tab");
  await expect(page.locator("aside#sidebar a.brand")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("app-nav-inicio")).toBeFocused();
  for (let index = 0; index < 7; index += 1) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("#sidebar"))).toBe(false);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByTestId("app-nav-configuracion")).toBeFocused();
});

test("AC-19-001.5: the skip link moves focus in place on a deep route", async ({ page }) => {
  await open(page, 1280, "/board/idea-in-pipeline/proposal");
  const before = new URL(page.url());
  await page.getByRole("link", { name: "Saltar al contenido", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#content")).toBeFocused();
  const after = new URL(page.url());
  expect(`${after.pathname}${after.search}`).toBe(`${before.pathname}${before.search}`);
});

test.describe("phone drawer", () => {
  test("AC-19-003.4: activating the current destination closes the drawer", async ({ page }) => {
    await open(page, 390, "/board");
    await page.locator("#menu").click();
    await page.getByTestId("app-nav-tablero").click();
    await expect(page.locator("#menu")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("aside#sidebar")).toHaveAttribute("inert");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/board");
  });

  test("AC-19-003.4: the drawer also closes when activated from the brand link", async ({
    page,
  }) => {
    await open(page, 390, "/board");
    await page.locator("#menu").click();
    await page.locator("aside#sidebar a.brand").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(page.locator("#menu")).toHaveAttribute("aria-expanded", "false");
  });

  test("AC-19-003.3: Tab stays inside the open drawer in both directions", async ({ page }) => {
    await open(page, 390, "/board");
    await page.locator("#menu").click();
    await expect(page.locator("aside#sidebar a.brand")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByTestId("app-nav-configuracion")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("aside#sidebar a.brand")).toBeFocused();
  });

  test("AC-19-003.3: a closed drawer takes no focus, and the bars own the keyboard", async ({
    page,
  }) => {
    await open(page, 390, "/board");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.locator("#menu")).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("#sidebar"))).toBe(false);
  });

  test("AC-19-003.3: phone top bar and drawer match the recorded names", async ({ page }) => {
    await open(page, 390, "/board");
    await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toBeVisible();
    await expect(page.locator("#where")).toContainText("Tablero");
    await expect(page.locator("#where")).toContainText("MISSION CONTROL");
    await expect(page.locator("#bottomnav").locator("a, button")).toHaveText([
      "Inicio",
      "Tablero",
      "Portafolio",
      "Docs",
      "Más",
    ]);
    await page.locator("#menu").click();
    await expect(page.locator("#scrim")).toHaveAttribute("data-open", "true");
    await expect.poll(async () => (await page.locator("aside#sidebar").boundingBox())?.x).toBe(0);
    expect((await page.locator("aside#sidebar").boundingBox())?.width).toBe(300);
    await expect(page.getByTestId("app-nav").getByRole("link")).toHaveCount(7);
  });

  test("REQ-19-003 edge: growing past the breakpoint closes the drawer and drops inert", async ({
    page,
  }) => {
    await open(page, 390, "/board");
    await page.locator("#menu").click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator("aside#sidebar")).not.toHaveAttribute("inert");
    await expect(page.locator("aside#sidebar")).toHaveAttribute("data-open", "false");
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator("aside#sidebar")).toHaveAttribute("inert");
    await expect(page.locator("#menu")).toHaveAttribute("aria-expanded", "false");
  });

  test("WO-19-002: reduced motion removes the drawer slide", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, 390, "/board");
    const duration = await page
      .locator("aside#sidebar")
      .evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(duration.split(",").every((value) => Number.parseFloat(value) === 0)).toBe(true);
  });
});
