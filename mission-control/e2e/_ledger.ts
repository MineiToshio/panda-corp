import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const fixtureLedger = path.resolve(
  "e2e/fixtures/factory-root/factory/gamification-ledger.json",
);

/** Never reset the shared fixture underneath the Server Action's atomic writer. */
export async function waitForLedgerIdle(): Promise<void> {
  await expect.poll(() => fs.existsSync(`${fixtureLedger}.lock`), { timeout: 10_000 }).toBe(false);
}

/** SSE must have a finite response so pending hydration actions can drain. */
export async function settleLedgerPage(page: Page): Promise<void> {
  if (!page.isClosed()) {
    await page.waitForLoadState("networkidle");
    await page.close();
  }
  await waitForLedgerIdle();
}
