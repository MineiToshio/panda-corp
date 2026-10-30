import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { expectHydrated } from "./persistent-navigation/_history";

test("AC-25-002.1, AC-25-009.1: standalone history restores work order detail without a command", async ({
  page,
}) => {
  const commands: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/.*(?:build|command|execute)/.test(request.url())) commands.push(request.url());
  });
  const base = "/projects/mission-control/work-orders/WO-01-001";
  await gotoHydrated(page, `${base}/summary`, { selector: '[data-testid="wo-detail-tab-full"]' });
  await page.getByTestId("wo-detail-tab-full").click();
  await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
  await page.reload();
  await expectHydrated(page, '[data-testid="wo-detail-tab-full"]');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${base}/summary$`));
  await expect(page.getByTestId("wo-detail-summary")).toContainText("Reader module");
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${base}/full$`));
  await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
  expect(commands).toEqual([]);
});
