import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { countOpenChanges } from "../openChanges";

it("AC-04-014.2, AC-04-014.3: counts all open statuses and surfaces bad files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "open-changes-"));
  const dir = path.join(root, ".pandacorp/inbox/changes");
  try {
    expect(countOpenChanges(root).count).toBe(0);
    fs.mkdirSync(dir, { recursive: true });
    for (const status of ["ready", "draft", "building", "closing", "done", "discarded"]) {
      fs.writeFileSync(
        path.join(dir, `${status}.md`),
        `---\ntype: change\nstatus: ${status}\n---\n# Ajustar vista`,
      );
    }
    expect(countOpenChanges(root)).toEqual({ ok: true, count: 4, errors: [] });
    fs.writeFileSync(path.join(dir, "bad.md"), "---\nstatus: unknown\n---\n# Cambio");
    fs.mkdirSync(path.join(dir, "broken.md"));
    expect(countOpenChanges(root)).toMatchObject({
      ok: false,
      count: null,
      errors: [{ file: "bad.md" }, { file: "broken.md" }],
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
