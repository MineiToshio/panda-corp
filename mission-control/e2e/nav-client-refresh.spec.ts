import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { controlLiveFrames, emitLiveFrame } from "./persistent-navigation/_live-race";

const BASE = "/portfolio/mission-control/observability";
const QUERY = "view=deps&dag=wo&frd=FRD-01";

async function expectSelection(page: Page, focus: string | null, wo: string | null = null) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        path: url.pathname,
        view: url.searchParams.get("view"),
        dag: url.searchParams.get("dag"),
        frd: url.searchParams.get("frd"),
        focus: url.searchParams.get("focus"),
        wo: url.searchParams.get("wo"),
      };
    })
    .toEqual({ path: BASE, view: "deps", dag: "wo", frd: "FRD-01", focus, wo });
}

for (const start of [
  `${BASE}?${QUERY}`,
  `/portfolio?project=mission-control&tab=Observabilidad&${QUERY}`,
]) {
  test(`AC-12-006.1 AC-25-003.1 shallow selections survive real refresh and history from ${start}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Only the external event transport is controlled; Next's history patch, RSC and router are real.
    await controlLiveFrames(page);
    await gotoHydrated(page, start, { selector: ".seg button" });
    await expectSelection(page, null);
    await expect(page.getByRole("combobox")).toHaveValue("frd-01-x");
    // The first frame is the baseline of what the server already rendered; only an advance refreshes.
    await emitLiveFrame(page, 1);
    await page.getByRole("button", { name: /WO-01-003 ·/ }).click();
    await expectSelection(page, "WO-01-003");

    const refreshed = page.waitForResponse((response) => {
      const request = response.request();
      return request.headers().rsc === "1" && new URL(request.url()).pathname === BASE;
    });
    await emitLiveFrame(page, 2);
    const response = await refreshed;
    expect(response.ok()).toBe(true);
    expect(new URL(response.url()).searchParams.get("focus")).toBe("WO-01-003");
    await expectSelection(page, "WO-01-003");
    await expect(page.getByRole("region", { name: "Work order en foco" })).toBeVisible();

    await page.getByRole("button", { name: "Abrir work order", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Documento completo" })).toBeVisible();
    await expectSelection(page, "WO-01-003", "WO-01-003");
    // A Back inside the same tick as the detail's last commit is rewritten by Next's own history
    // sync; this test owns client selections across refresh, not that sub-frame race.
    await page.waitForLoadState("load");
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 400))),
    );
    await page.goBack();
    await expectSelection(page, "WO-01-003");
    await expect(page.getByRole("region", { name: "Work order en foco" })).toBeVisible();
    await page.goBack();
    await expectSelection(page, null);
    await expect(page.getByRole("region", { name: "Work order en foco" })).toHaveCount(0);
    await page.goForward();
    await expectSelection(page, "WO-01-003");
    await expect(page.getByRole("region", { name: "Work order en foco" })).toBeVisible();
    await page.goForward();
    await expectSelection(page, "WO-01-003", "WO-01-003");
    await expect(page.getByRole("tab", { name: "Documento completo" })).toBeVisible();
  });
}
