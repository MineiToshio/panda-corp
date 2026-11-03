import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const FLOWS = [
  { from: "/", destination: "tablero", path: "/board", title: "Tablero" },
  {
    from: "/projects/mission-control",
    destination: "configuracion",
    path: "/configuration",
    title: "Configuración",
  },
] as const;

for (const theme of ["light", "dark"]) {
  for (const flow of FLOWS) {
    test(`AC-19-001.4: streamed location hydrates across ${flow.destination} navigation (${theme})`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`${page.url()}\n${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`${page.url()}\n${message.text()}`);
      });
      await page.route("**/api/live**", (route) => route.abort());
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("orbita-theme", value), theme);
      await gotoHydrated(page, flow.from, { selector: '#app[data-hydrated="true"]' });
      // The top bar is CSS-hidden on desktop; shell hydration does not hydrate its streamed slot.
      await page.getByTestId(`app-nav-${flow.destination}`).click();
      await expect(page).toHaveURL(new RegExp(`${flow.path}(/|$)`));
      await expect(page.locator("#where > span")).toHaveText(flow.title);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      const hydrationErrors = errors.filter((error) =>
        /hydration|hydrating|server rendered/i.test(error),
      );
      await testInfo.attach("hydration-errors", {
        body: hydrationErrors.join("\n\n"),
        contentType: "text/plain",
      });
      expect(hydrationErrors).toEqual([]);
    });
  }
}
