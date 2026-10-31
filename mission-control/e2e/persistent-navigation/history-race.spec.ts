import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";
import { expectHydrated, observeHistory, reloadCommitted } from "./_history";
import { controlLiveFrames, emitLiveFrame } from "./_live-race";

test.use({ trace: "retain-on-failure" });

test.afterEach(async ({ page }, info) => {
  const historyPath = info.outputPath("history.json");
  await writeFile(
    historyPath,
    JSON.stringify(
      await page.evaluate(() => ({
        href: location.href,
        state: history.state,
        timeline: Reflect.get(window, "navigationTimeline"),
      })),
      null,
      2,
    ),
  );
  await info.attach("final-history", { path: historyPath, contentType: "application/json" });
  await page.screenshot({ path: info.outputPath("final-screen.png") });
});

// AC-25-002.1 / AC-25-003.1: both server-owned and shallow entries survive hard reload.
for (const family of ["portfolio", "projects"]) {
  test(`${family}: canonical WO defaults retain Back/Forward after hard reload`, async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const base = `/${family}/mission-control/observability`;
    await observeHistory(page);
    const initialCommitted = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === base;
    });
    await gotoHydrated(page, `${base}?view=tablero&wo=WO-01-001`, {
      selector: '[data-testid="wo-detail-tab-full"]',
      timeout: 300_000,
    });
    await initialCommitted;
    await expect(page.getByTestId("wo-detail-summary")).toBeVisible();
    await page.getByTestId("wo-detail-tab-full").click();
    await expect(page).toHaveURL(/woview=full/);
    await expect(page.getByTestId("wo-detail-full")).toBeVisible();
    await reloadCommitted(page);
    await expectHydrated(page, '[data-testid="wo-detail-tab-full"]');
    await page.goBack();
    await expect(page.getByTestId("wo-detail-summary")).toBeVisible();
    await expect(page).not.toHaveURL(/woview=full/);
    await page.goForward();
    await expect(page.getByTestId("wo-detail-full")).toBeVisible();
    await expect(page).toHaveURL(/woview=full/);
    const returnCommitted = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === base && !url.searchParams.has("wo");
    });
    await page.getByTestId("wo-detail-back").click();
    await returnCommitted;
    await expect(page).not.toHaveURL(/wo=/);
    await expectHydrated(page, '[data-testid="tab-changes"]');
    await page.getByTestId("tabbar").getByTestId("tab-changes").click();
    await expect(page).toHaveURL(new RegExp(`/${family}/mission-control/changes`));
    await test.info().attach("history", {
      body: JSON.stringify(
        await page.evaluate(() => Reflect.get(window, "navigationTimeline")),
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
}

test("shallow views retain distinct entries and UI after reload and repeated traversal", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const initialCommitted = page.waitForRequest(
    (request) => request.method() === "POST" && new URL(request.url()).pathname === "/portfolio",
  );
  await gotoHydrated(page, "/portfolio?portfolioView=accounts#providers", {
    selector: "fieldset button",
    timeout: 300_000,
  });
  await initialCommitted;
  await expect(page).toHaveURL(/\/portfolio\?view=cuentas#providers$/);
  const cards = page.getByRole("button", { name: "Tarjetas", exact: true });
  const list = page.getByRole("button", { name: "Lista", exact: true });
  await list.click();
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await cards.click();
  await expect(cards).toHaveAttribute("aria-pressed", "true");
  await reloadCommitted(page);
  await expectHydrated(page, "fieldset button");
  for (let repetition = 0; repetition < 3; repetition++) {
    await page.goBack();
    await expect(page).toHaveURL(/view=lista#providers$/);
    await expect(list).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(page).toHaveURL(/view=cuentas#providers$/);
    await page.goForward();
    await expect(list).toHaveAttribute("aria-pressed", "true");
    await page.goForward();
    await expect(cards).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/view=tarjetas#providers$/);
  }
});

// Deliberate network fault injection: a first SSE frame arrives inside a pending Full request.
test("live first frame cannot replace the pending Full history entry", async ({ page }) => {
  test.setTimeout(30_000);
  await controlLiveFrames(page);
  await observeHistory(page);
  const base = "/projects/mission-control/observability?view=tablero&wo=WO-01-001";
  const committed = page.waitForRequest((request) => request.method() === "POST");
  await gotoHydrated(page, base, { selector: '[data-testid="wo-detail-tab-full"]' });
  await committed;
  await expect(page.getByTestId("wo-detail-summary")).toBeVisible();
  const before = await page.evaluate(() => history.length);
  await page.route(/woview=full.*_rsc=/, async (route) => {
    await emitLiveFrame(page, 100);
    // Network latency is the adversarial stimulus, not an assertion wait.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.getByTestId("wo-detail-tab-full").click();
  await expect(page.getByTestId("wo-detail-full")).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.length), { timeout: 5000 }).toBe(before + 1);
  await reloadCommitted(page);
  await page.goBack();
  await expect(page.getByTestId("wo-detail-summary")).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId("wo-detail-full")).toBeVisible();
});

test("canonical WO URL survives a live refresh without reverting", async ({ page }) => {
  test.setTimeout(30_000);
  await controlLiveFrames(page);
  await observeHistory(page);
  const committed = page.waitForRequest((request) => request.method() === "POST");
  await gotoHydrated(page, "/portfolio/mission-control/observability?wo=WO-01-001", {
    selector: '[data-testid="wo-detail-tab-full"]',
  });
  await committed;
  await expect(page).toHaveURL(/wo=WO-01-001&woview=summary$/);
  await emitLiveFrame(page, 100);
  const refreshed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/observability") && url.searchParams.has("_rsc");
  });
  const historyCount = await page.evaluate(() => Reflect.get(window, "navigationTimeline").length);
  await emitLiveFrame(page, 101);
  await page.clock.runFor(5000);
  const response = await refreshed;
  expect(new URL(response.url()).searchParams.get("woview")).toBe("summary");
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "navigationTimeline").length), {
      timeout: 10_000,
    })
    .toBeGreaterThan(historyCount);
  await expect(page).toHaveURL(/wo=WO-01-001&woview=summary$/);
  await expect(page.getByTestId("wo-detail-summary")).toBeVisible();
});

test("Back to Documents restores its canonical tree with at most one RSC", async ({ page }) => {
  test.setTimeout(30_000);
  await page.route("**/api/live*", (route) => route.abort());
  await observeHistory(page);
  const committed = page.waitForRequest((request) => request.method() === "POST");
  await gotoHydrated(page, "/portfolio/mission-control", { selector: '[data-testid="tabbar"]' });
  await committed;
  await page.getByTestId("tabbar").getByTestId("tab-documents").click();
  await expect(page).toHaveURL(/\/documents\/docs%2Fproduct%2Fprd$/);
  await expect(page.getByTestId("documents-body")).toBeVisible();
  await page.getByTestId("tabbar").getByTestId("tab-observability").click();
  await expect(page.getByTestId("tabbar").getByTestId("tab-observability")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/documents") && url.searchParams.has("_rsc"))
      requests.push(url.href);
  });
  await page.goBack();
  await expect(page.getByTestId("documents-body")).toBeVisible();
  await expect(page.getByTestId("tabbar").getByTestId("tab-documents")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(/\/documents\/docs%2Fproduct%2Fprd$/);
  expect(requests.length, JSON.stringify(requests)).toBeLessThanOrEqual(1);
});

test("throttled live refresh waits until a pending Full navigation commits", async ({ page }) => {
  test.setTimeout(30_000);
  await controlLiveFrames(page);
  await observeHistory(page);
  const committed = page.waitForRequest((request) => request.method() === "POST");
  await gotoHydrated(page, "/projects/mission-control/observability?wo=WO-01-001", {
    selector: '[data-testid="wo-detail-tab-full"]',
  });
  await committed;
  await emitLiveFrame(page, 100);
  const initialHistory = await page.evaluate(
    () => Reflect.get(window, "navigationTimeline").length,
  );
  await emitLiveFrame(page, 101);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "navigationTimeline").length), {
      timeout: 10_000,
    })
    .toBeGreaterThan(initialHistory);
  const before = await page.evaluate(() => history.length);
  let injected = false;
  await page.route(/woview=full.*_rsc=/, async (route) => {
    if (!injected) {
      injected = true;
      await emitLiveFrame(page, 102);
      await page.clock.runFor(5000);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });
  await page.getByTestId("wo-detail-tab-full").click();
  await expect(page.getByTestId("wo-detail-full")).toBeVisible();
  expect(injected).toBe(true);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await reloadCommitted(page);
  await page.goBack();
  await expect(page.getByTestId("wo-detail-summary")).toBeVisible();
});
