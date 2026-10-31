import { expect, type Page, test } from "@playwright/test";
import { assertResponsive } from "./_responsive-helper";
import { SURFACES } from "./routes";

// Reviewer-authored (DR-080): WO-13-013 promises every route at four widths. The template spec only
// visits blessed routes at one phone width and stays byte-synced, so the four-width gate lives here.
// Each width keeps a real device's height, because a fixed bottom bar covers a different row at each.
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const;

const SR_ONLY =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap";

async function fixture(page: Page, body: string): Promise<string> {
  const url = `/__responsive-fixture-${test.info().testId}`;
  await page.route(`**${url}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="es"><body><main><p>Contenido visible.</p>${body}</main></body></html>`,
    }),
  );
  return url;
}

for (const surface of SURFACES) {
  for (const { width, height } of VIEWPORTS) {
    test(`responsive · ${surface.id} (${surface.path}) @${width}px`, async ({ page }) => {
      await assertResponsive(page, surface.path, { mobileWidth: width, mobileHeight: height });
    });
  }
}

test("the visually-hidden exemption passes sr-only text", async ({ page }) => {
  const url = await fixture(page, `<h1 style="${SR_ONLY}">${"texto oculto ".repeat(20)}</h1>`);
  await assertResponsive(page, url, { mobileWidth: 320 });
});

test("the exemption does not blind the gate to a box that really clips", async ({ page }) => {
  const url = await fixture(
    page,
    `<div style="width:120px;overflow:hidden;white-space:nowrap">${"texto cortado ".repeat(20)}</div>`,
  );
  await expect(assertResponsive(page, url, { mobileWidth: 320 })).rejects.toThrow(/CLIPPED/);
});

test("a clipped-to-nothing box that keeps its size is still a clip", async ({ page }) => {
  const url = await fixture(
    page,
    `<div style="position:absolute;width:120px;height:40px;overflow:hidden;clip-path:inset(50%);white-space:nowrap">${"texto ".repeat(40)}</div>`,
  );
  await expect(assertResponsive(page, url, { mobileWidth: 320 })).rejects.toThrow(/CLIPPED/);
});
