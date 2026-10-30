import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-14-001.1, AC-14-001.2, AC-14-001.3: read and copy the gated commit command", async ({
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
  await expect(panel.getByTestId("snapshot-panel-building-now")).toHaveCount(0);
  await expect(panel.getByTestId("snapshot-panel-no-signal")).toHaveCount(0);
  const command = await panel.getByTestId("cmd-row").locator("code").innerText();
  expect(command).toMatch(/^git worktree add .+ abc1234def5678$/);
  await panel.getByRole("button", { name: `Copiar ${command}`, exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(command);
});
