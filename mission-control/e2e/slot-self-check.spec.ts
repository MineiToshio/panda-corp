import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { FACTORY_ROOT } from "./_slot";

test("worker fixture writes reach its baseURL server", async ({ page }, info) => {
  const id = `BL-99${String(info.parallelIndex).padStart(2, "0")}`;
  const title = `Slot ${info.parallelIndex} ${info.project.name}`;
  const file = path.join(FACTORY_ROOT, "factory/backlog", `${id}.md`);
  fs.writeFileSync(
    file,
    `---\nid: ${id}\ntype: bug\nstatus: open\narea: hooks\nseverity: p0\ntitle: ${title}\n---\n## Problem\nSynthetic slot identity check.\n`,
    { flag: "wx" },
  );
  try {
    await gotoHydrated(page, "/proposals/backlog", { selector: '[data-testid="backlog-panel"]' });
    await expect(page.getByRole("button", { name: `${id} · ${title}`, exact: true })).toBeVisible();
  } finally {
    fs.unlinkSync(file);
  }
});
