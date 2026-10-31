import { expect as baseExpect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { expectHydrated, reloadCommitted } from "./persistent-navigation/_history";

// Legacy WO links settle in two server round trips (alias, then canonical replace) that can stall
// for seconds under load; these assertions pin the destination, not its latency.
const NAVIGATION_TIMEOUT = 60_000;
const expect = baseExpect.configure({ timeout: NAVIGATION_TIMEOUT });

test("AC-25-002.1, AC-25-009.1: standalone history restores work order detail without a command", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const commands: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/.*(?:build|command|execute)/.test(request.url())) commands.push(request.url());
  });
  const legacy = "/projects/mission-control/work-orders/WO-01-001";
  const canonical = "/projects/mission-control/observability\\?wo=WO-01-001&woview=";
  await gotoHydrated(page, `${legacy}/summary`, {
    selector: '[data-testid="wo-detail-tab-full"]',
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page).toHaveURL(new RegExp(`${canonical}summary$`));
  await page.getByTestId("wo-detail-tab-full").click();
  await expect(page).toHaveURL(new RegExp(`${canonical}full$`));
  await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
  await reloadCommitted(page);
  await expect(page).toHaveURL(new RegExp(`${canonical}full$`));
  await expectHydrated(page, '[data-testid="wo-detail-tab-full"]');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${canonical}summary$`));
  await expect(page.getByTestId("wo-detail-summary")).toContainText("Reader module");
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${canonical}full$`));
  await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
  expect(commands).toEqual([]);
});
