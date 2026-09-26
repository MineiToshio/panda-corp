import { expect, test } from "@playwright/test";

/**
 * FRD-05 gate — reviewer-authored browser check (DR-055 runtime lens) for the work-order state
 * filter (REQ-05-007) on the REAL workspace route, served against the pinned fixture factory root
 * (`e2e/server-env.json`). The `workspace` surface is not yet blessed in `e2e/routes.ts`, so the
 * canonical smoke does not assert it — this spec proves the Work orders tab renders clean and the
 * two filter rows AND-combine in a real browser. Viewport-agnostic: the filter rows live in the
 * page content (not the collapsible nav), so it holds on the desktop AND mobile projects.
 */

const ROUTE = "/projects/mission-control?tab=work-orders";

test.describe("frd-05 review: work-orders state filter in the browser", () => {
  test("REQ-05-007 — the Work orders tab renders clean and the state filter AND-combines with the FRD filter", async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));

    const response = await page.goto(ROUTE);
    expect(response?.status()).toBeLessThan(400);

    const stateGroup = page.getByRole("group", { name: "Filtrar por estado" });
    const frdGroup = page.getByRole("group", { name: "Filtrar por FRD" });
    await expect(stateGroup).toBeVisible();
    await expect(frdGroup).toBeVisible();
    await expect(stateGroup.getByRole("button")).toHaveCount(6);

    const cards = page.getByTestId("wo-card");
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    // Every state narrows the board; the per-state counts partition the full set.
    let sum = 0;
    for (const label of ["To do", "En progreso", "Review / Testing", "Falló", "Hecho"]) {
      const pill = stateGroup.getByRole("button", { name: `Filtrar por estado ${label}` });
      await pill.click();
      await expect(pill).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("region", { name: new RegExp(`^Columna ${label.replace("/", "\\/")}:`) }),
      ).toBeVisible();
      sum += await cards.count();
    }
    expect(sum).toBe(total);

    // AND with the FRD filter, then clearing the state restores the FRD-only view.
    await stateGroup.getByRole("button", { name: "Filtrar por estado Hecho" }).click();
    const doneCount = await cards.count();
    const firstFrd = frdGroup.getByTestId("wo-frd-filter-option").first();
    await firstFrd.click();
    expect(await cards.count()).toBeLessThanOrEqual(doneCount);
    await stateGroup.getByRole("button", { name: "Todos" }).click();
    await expect(stateGroup.getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(firstFrd).toHaveAttribute("aria-pressed", "true");
    const frdOnly = await cards.count();
    expect(frdOnly).toBeGreaterThan(0);
    await frdGroup.getByRole("button", { name: "Todos" }).click();
    await expect(cards).toHaveCount(total);

    expect(problems).toEqual([]);
  });
});
