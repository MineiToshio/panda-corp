import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-21-007.1, AC-21-007.3: worktree card, cleanup command and keyboard scroll region", async ({
  page,
}) => {
  await gotoHydrated(page, "/", { selector: "#worktrees-card button" });
  const card = page.locator("#worktrees-card");
  await expect(card.getByRole("heading", { name: "Árboles de trabajo" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Copiar /pandacorp:worktrees" })).toBeVisible();
  await expect(card.getByRole("region", { name: "Tabla desplazable" })).toHaveAttribute(
    "tabindex",
    "0",
  );
  const legend = card.locator("details");
  await legend.locator("summary").click();
  await expect(legend).toHaveAttribute("open", "");
  await legend.locator("summary").click();
  await expect(legend).not.toHaveAttribute("open");
});
