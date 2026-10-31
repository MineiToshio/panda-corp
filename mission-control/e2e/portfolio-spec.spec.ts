import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { WORKSPACE_TAB_LABELS } from "./_workspaceTabs";

test("Portfolio Spec reuses the digest, FRD dialog and same-project document links", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio?project=Mission%20Control&tab=spec", {
    selector: '[data-testid="tab-spec"]',
  });
  // Wait for the canonical location before exercising the embedded dialog.
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/spec$/, { timeout: 15_000 });
  const tabs = page.getByRole("navigation", { name: "Secciones de Mission Control" });
  expect(
    (await tabs.getByRole("tab").allTextContents()).map((label) => label.replace(/\d+$/u, "")),
  ).toEqual([...WORKSPACE_TAB_LABELS]);
  const spec = page.getByTestId("card-detail-spec");
  await expect(spec).toContainText("Mission Control Spec");
  await expect(spec).toContainText("FRDs · las piezas del v1 (1)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const open = spec.getByRole("button", { name: /^FRD-01 / });
  await open.click();
  await expect(page.getByRole("dialog")).toContainText("leer los documentos del proyecto");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(open).toBeFocused();
  await spec.getByRole("link", { name: "Documento del producto" }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/portfolio/mission-control/documents/docs%2Fproduct%2Fprd");
  await expect(tabs.getByRole("tab", { name: /^Documentos/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("standalone project supports a direct Spec link", async ({ page }) => {
  await gotoHydrated(page, "/projects/mission-control?tab=spec", {
    selector: '[data-testid="tab-spec"]',
  });
  await expect(page.getByRole("tab", { name: "Spec", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("card-detail-spec")).toContainText("Contexto completo");
});

for (const family of ["portfolio", "projects"]) {
  test(`AC-04-014.1 AC-04-012.1 AC-04-013.1: ${family} selects the full or compact frame by section`, async ({
    page,
  }) => {
    await gotoHydrated(page, `/${family}/mission-control/summary`, {
      selector: '[data-testid="project-hero"]',
    });
    const tabs = page.getByRole("tablist", { name: "Secciones de Mission Control" });
    expect(
      (await tabs.getByRole("tab").allTextContents()).map((label) => label.replace(/\d+$/u, "")),
    ).toEqual([...WORKSPACE_TAB_LABELS]);
    await expect(page.getByTestId("project-hero-compact")).toHaveCount(0);
    await tabs.getByRole("tab", { name: "Spec", exact: true }).click();
    await expect(page.getByTestId("project-hero-compact")).toBeVisible();
    await expect(page.getByTestId("project-hero")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cambiar proyecto" })).toBeVisible();
  });
  test(`AC-12-006.4: ${family} keeps legacy aliases and unknown sections inside the workspace`, async ({
    page,
  }) => {
    await gotoHydrated(page, `/${family}/mission-control/party`, {
      selector: '[data-testid="project-hero"]',
    });
    await expect(page).toHaveURL(new RegExp(`/${family}/mission-control/summary$`));
    await gotoHydrated(page, `/${family}/mission-control?tab=Work%20orders`, {
      selector: '[data-testid="tab-observability"]',
    });
    await expect(page).toHaveURL(new RegExp(`/${family}/mission-control/observability$`));
    await expect(page.getByRole("tab", { name: /^Observabilidad/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await gotoHydrated(page, `/${family}/mission-control/unknown-section`, {
      selector: '[data-testid="project-hero-compact"]',
    });
    await expect(page.getByRole("heading", { name: "Esta sección no existe" })).toBeVisible();
    await page.getByRole("link", { name: "Ir al resumen" }).click();
    await expect(page.getByTestId("project-hero")).toBeVisible();
  });
}
