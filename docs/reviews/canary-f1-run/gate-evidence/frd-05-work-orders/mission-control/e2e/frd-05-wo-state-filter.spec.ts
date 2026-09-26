import { expect, test } from "@playwright/test";

/**
 * FRD-05 reviewer gate — REQ-05-007 on the REAL route (not a jsdom render): the Work orders
 * tab of the fixture project hydrates the state filter with no console/page error, and the
 * filter narrows the live board by AND with the FRD filter. Viewport-agnostic on purpose
 * (BL-0001): the pill rows wrap and stay visible on both the desktop and mobile projects.
 *
 * Fixture (e2e/fixtures/factory-root/mission-control): four work orders of frd-01-x —
 * two VERIFIED (done), one IN_PROGRESS, one PENDING (todo).
 */
const ROUTE = "/projects/mission-control?tab=work-orders";

test("frd-05 · REQ-05-007 · the state filter hydrates clean and narrows the live board", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const res = await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  expect(res?.status(), `${ROUTE} HTTP status`).toBeLessThan(400);

  const stateGroup = page.getByRole("group", { name: "Filtrar por estado" });
  await expect(stateGroup).toBeVisible();
  const cards = page.getByTestId("wo-card");
  await expect(cards).toHaveCount(4);

  const pills = stateGroup.getByTestId("wo-state-filter-option");
  await expect(pills).toHaveCount(5);

  await pills.nth(4).click();
  await expect(pills.nth(4)).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(2);

  await pills.nth(3).click();
  await expect(cards).toHaveCount(0);
  await expect(page.getByTestId("kanban-col-root")).toHaveCount(5);

  await page
    .getByRole("group", { name: "Filtrar por FRD" })
    .getByRole("button", { name: "Filtrar por frd-01-x" })
    .click();
  await pills.nth(1).click();
  await expect(cards).toHaveCount(1);

  await stateGroup.getByRole("button", { name: "Todos" }).click();
  await expect(cards).toHaveCount(4);

  expect(errors, `console/page errors on ${ROUTE}`).toEqual([]);
});
