import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { WORKSPACE_TAB_LABELS } from "./_workspaceTabs";

test("Portfolio Spec reuses the digest, FRD dialog and same-project document links", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio?project=Mission%20Control&tab=spec", {
    selector: '[data-testid="tab-spec"]',
  });
  // The legacy query alias is canonicalized by a client replace that remounts the workspace
  // (FRD-25); interacting before it lands loses the dialog's returned focus to <body>.
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/spec$/, { timeout: 15_000 });
  const tabs = page.getByRole("navigation", { name: "Pestañas del espacio de trabajo" });
  await expect(tabs.getByRole("tab")).toHaveText([...WORKSPACE_TAB_LABELS]);
  const spec = page.getByTestId("card-detail-spec");
  await expect(spec).toContainText("Mission Control Spec");
  await expect(spec).toContainText("FRDs · las piezas del v1 (1)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const open = spec.getByRole("button", { name: "FRD-01 Fuente de datos" });
  await open.click();
  await expect(page.getByRole("dialog")).toContainText("leer los documentos del proyecto");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(open).toBeFocused();
  await spec.getByRole("link", { name: "Documento del producto" }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/portfolio/mission-control/documents/docs%2Fproduct%2Fprd");
  await expect(tabs.getByRole("tab", { name: "Documentos", exact: true })).toHaveAttribute(
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
