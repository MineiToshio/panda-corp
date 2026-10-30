import { expect, test } from "@playwright/test";

/**
 * WO-13-010 behaviour spec: the boot script paints the theme before hydration, a stored choice wins
 * over the system, and the three self-hosted families load (AC-13-010.2). No form is filled, so a
 * plain navigation to domcontentloaded is the point: the theme must already be on <html>.
 */

const DISPLAY_STACK = '"Space Grotesk", Inter, system-ui, sans-serif';
const BODY_STACK = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

test.describe("AC-13-010.2: theme boot and fonts", () => {
  test.describe("system light", () => {
    test.use({ colorScheme: "light" });
    test("AC-13-010.2: light system paints data-theme=light before hydration", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });

    test("AC-13-010.2: a stored choice wins over the system", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("orbita-theme", "dark"));
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });
  });

  test.describe("system dark", () => {
    test.use({ colorScheme: "dark" });
    test("AC-13-010.2: dark system with no stored choice is dark", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });

    test("AC-13-010.2: the three families load and body text computes the checklist stack", async ({
      page,
    }) => {
      await page.goto("/");
      const loaded = await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          ["600 16px 'Space Grotesk'", "400 15px Inter", "400 14px 'JetBrains Mono'"].map((f) =>
            document.fonts.load(f),
          ),
        );
        return ["600 16px 'Space Grotesk'", "400 15px Inter", "400 14px 'JetBrains Mono'"].map(
          (f) => document.fonts.check(f),
        );
      });
      expect(loaded).toEqual([true, true, true]);
      const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(body).toBe(BODY_STACK);
      const h = await page.evaluate(() => {
        const el = document.querySelector("h1, h2, h3");
        return el ? getComputedStyle(el).fontFamily : null;
      });
      if (h) expect(h).toBe(DISPLAY_STACK);
    });
  });
});
