import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { countPendingDecisions, readDecisions } from "../activity";

it("readDecisions never counts Spanish resolved headings as pending", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resolved-headings-"));
  const inbox = path.join(root, ".pandacorp/inbox");
  fs.mkdirSync(inbox, { recursive: true });
  const file = path.join(inbox, "decisions.md");
  try {
    fs.writeFileSync(
      file,
      "## RESUELTO — Finished\nClosed.\n## RESUELTO: Also finished\nClosed.\n",
    );
    expect(readDecisions(root).map((point) => point.status)).toEqual(["resolved", "resolved"]);
    expect(countPendingDecisions(root)).toBe(0);
  } finally {
    fs.rmSync(file);
  }
});
