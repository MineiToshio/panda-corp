import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readPublishedWorkOrders } from "../published";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "published-mutation-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
function write(relative: string, content: string) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const folder = "docs/frds/frd-01-example/work-orders";

it("distinguishes missing plans from malformed directory structures", () => {
  expect(readPublishedWorkOrders(root)).toEqual({ items: [], errors: [] });
  write("docs/frds/frd-02-not-a-directory", "ignored");
  write("docs/frds/notes/work-orders/wo-01-001.md", "# Not a feature");
  write(`${folder}/notes.md`, "# Not an order");
  write(`${folder}/wo-01-002.md.bak`, "# Not an order");
  expect(readPublishedWorkOrders(root)).toEqual({ items: [], errors: [] });
});

it("accepts every engine status and legacy status absence while excluding superseded orders", () => {
  const states = ["PLANNED", "IN_PROGRESS", "IN_REVIEW", "VERIFIED", "BLOCKED"];
  states.forEach((status, index) => {
    write(
      `${folder}/wo-01-00${index}.md`,
      `---\nimplementation_status: ${status}\n---\n# Order ${index}\n`,
    );
  });
  write(`${folder}/wo-01-006.md`, "# Legacy order\n");
  write(
    `${folder}/wo-01-007.md`,
    "---\nstatus: SUPERSEDED\nimplementation_status: UNKNOWN\n---\n# Retired\n",
  );
  const result = readPublishedWorkOrders(root);
  expect(result.errors).toEqual([]);
  expect(result.items).toHaveLength(6);
  expect(result.items.map((item) => item.state).sort()).toEqual([
    "done",
    "fail",
    "in_progress",
    "review",
    "todo",
    "todo",
  ]);
});

it("reports whitespace, non-string status and unreadable candidate separately", () => {
  write(`${folder}/wo-01-001.md`, " \n\t ");
  write(`${folder}/wo-01-002.md`, "---\nimplementation_status: 12\n---\n# Invalid\n");
  fs.mkdirSync(path.join(root, folder, "wo-01-003.md"));
  const result = readPublishedWorkOrders(root);
  expect(result.items).toEqual([]);
  expect(result.errors.map(({ file, reason }) => [path.basename(file), reason])).toEqual([
    ["wo-01-001.md", "file is empty"],
    ["wo-01-002.md", "invalid implementation_status"],
    ["wo-01-003.md", "file could not be read"],
  ]);
});
