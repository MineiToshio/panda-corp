import { expect } from "@playwright/test";
import { test } from "./_read-only";

test("FRD-25 route contract: old Party links restore Summary in both presentation contexts", async ({
  page,
}) => {
  for (const family of ["portfolio", "projects"]) {
    await page.goto(`/${family}/mission-control/party`, { waitUntil: "domcontentloaded" });
    await expect.soft(page).toHaveURL(new RegExp(`/${family}/mission-control/summary$`));
  }
});
