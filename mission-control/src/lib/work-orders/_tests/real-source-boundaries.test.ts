import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readChangeQueue } from "@/lib/changes/changes";
import { countOpenChanges } from "@/lib/changes/openChanges";
import { readDigestWorkOrders } from "@/lib/spec/read-artifacts";
import { readPublishedWorkOrders } from "../published";

let root: string;
const orderPath =
  "docs/frds/frd-03-projects-case-studies/work-orders/wo-03-002-remove-decision-artifact-links.md";
const changePath = ".pandacorp/inbox/changes/done/blog-cover-alt-field.md";
const fixture = (name: string) =>
  fs.readFileSync(path.resolve("src/lib/work-orders/_tests/fixtures", name), "utf8");
function write(relative: string, content: string) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "real-reader-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it("DR-078: a real malformed title is named while valid work orders survive repeated reads", () => {
  write(orderPath, fixture("personal-page-invalid-order.md"));
  write(
    "docs/frds/frd-03-projects-case-studies/work-orders/wo-03-001-valid.md",
    "---\nimplementation_status: VERIFIED\n---\n# WO-03-001 Valid\n",
  );
  for (let read = 0; read < 2; read++) {
    for (const result of [readPublishedWorkOrders(root), readDigestWorkOrders(root)]) {
      expect(result).toMatchObject({
        items: [{ id: "WO-03-001", state: "done" }],
        errors: [{ file: orderPath, reason: "malformed YAML frontmatter" }],
      });
    }
  }
});

it("DR-078: quoting the scalar restores the verified order without changing its state", () => {
  const raw = fixture("personal-page-invalid-order.md");
  write(
    orderPath,
    raw.replace(/^title: (.+)$/m, (_line, title: string) => `title: ${JSON.stringify(title)}`),
  );
  expect(readPublishedWorkOrders(root)).toMatchObject({
    items: [{ id: "WO-03-002", state: "done" }],
    errors: [],
  });
  expect(readDigestWorkOrders(root)).toMatchObject({
    items: [{ id: "WO-03-002", state: "done" }],
    errors: [],
  });
});

it("AC-04-014.3: a malformed archived supersedes scalar makes the total unknown, while valid open cards remain visible", () => {
  write(changePath, fixture("personal-page-invalid-change.md"));
  write(
    ".pandacorp/inbox/changes/ready.md",
    "---\ntype: change\nstatus: ready\n---\n# Valid change\n",
  );
  for (let read = 0; read < 2; read++) {
    expect(readChangeQueue(root)).toMatchObject({
      items: [{ id: "ready" }],
      errors: [{ file: "done/blog-cover-alt-field.md", reason: "malformed YAML frontmatter" }],
    });
    expect(countOpenChanges(root)).toMatchObject({ ok: false, count: null });
  }
});

it("AC-04-014.2: after quoting the archived scalar, the count includes only the open card", () => {
  const raw = fixture("personal-page-invalid-change.md");
  write(
    changePath,
    raw.replace(
      /^supersedes: (.+)$/m,
      (_line, value: string) => `supersedes: ${JSON.stringify(value)}`,
    ),
  );
  write(
    ".pandacorp/inbox/changes/ready.md",
    "---\ntype: change\nstatus: ready\n---\n# Valid change\n",
  );
  expect(readChangeQueue(root).errors).toEqual([]);
  expect(countOpenChanges(root)).toEqual({ ok: true, count: 1, errors: [] });
});

it("DR-078: an unreadable discovery root fails the entire read instead of claiming an empty plan", () => {
  write("docs/frds", "not a directory");
  expect(() => readPublishedWorkOrders(root)).toThrow(/docs\/frds/);
});

it("DR-078: empty and invalid-state files are named without affecting a valid sibling", () => {
  write(orderPath, "");
  write(
    "docs/frds/frd-03-projects-case-studies/work-orders/wo-03-003-invalid.md",
    "---\nimplementation_status: COMPLETE\n---\n# Invalid state\n",
  );
  const result = readPublishedWorkOrders(root);
  expect(result.items).toEqual([]);
  expect(result.errors.map((error) => error.reason).sort()).toEqual([
    "file is empty",
    "invalid implementation_status",
  ]);
});
