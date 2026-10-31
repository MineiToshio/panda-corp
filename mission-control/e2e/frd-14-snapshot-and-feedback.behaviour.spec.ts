import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const statusFile = path.resolve("e2e/fixtures/factory-root/mission-control/.pandacorp/status.yaml");
const originalStatus = fs.readFileSync(statusFile, "utf8");
test.beforeEach(() => {
  fs.writeFileSync(statusFile, originalStatus);
  fs.writeFileSync(
    statusFile,
    `${originalStatus.replace(/^running:.*$/m, "running: true")}\nsupervisor_heartbeat: '${new Date().toISOString()}'\n`,
  );
});
test.afterEach(() => {
  fs.writeFileSync(statusFile, originalStatus);
});

test("AC-14-001.1 AC-14-001.2 AC-14-002.1: running build mounts the gated commit and copies the folder-scoped command", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoHydrated(page, "/projects/mission-control/summary", {
    selector: '[data-testid="snapshot-panel"] button',
  });
  const panel = page.getByTestId("snapshot-panel");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Último commit en verde");
  await expect(panel).toContainText("worktree aparte mientras el build sigue");
  await expect(panel.getByTestId("snapshot-panel-building-now")).toBeVisible();
  await expect(panel.getByTestId("snapshot-panel-no-signal")).toHaveCount(0);
  const command = await panel.getByTestId("cmd-row").locator("code").innerText();
  expect(command).toBe(
    "git worktree add /Users/Shared/review-worktrees/mission-control abc1234def5678",
  );
  await panel.getByRole("button", { name: `Copiar ${command}`, exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(command);
});

test("AC-14-001.1 AC-14-001.3: idle or missing green SHA never mounts a stale snapshot card", async ({
  page,
}) => {
  fs.writeFileSync(statusFile, originalStatus);
  await gotoHydrated(page, "/projects/mission-control/summary", {
    selector: '[data-testid="tab-summary"] button',
  });
  await expect(page.getByTestId("snapshot-panel")).toHaveCount(0);
  fs.writeFileSync(
    statusFile,
    originalStatus.replace(/^running:.*$/m, "running: true").replace(/^last_green_sha:.*$/m, ""),
  );
  await page.reload();
  await expect(page.getByTestId("snapshot-panel")).toHaveCount(0);
});
