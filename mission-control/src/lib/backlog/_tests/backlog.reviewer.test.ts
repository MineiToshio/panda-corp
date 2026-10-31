import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBacklog } from "../backlog";

let root: string;
let dir: string;

type Fields = Record<string, string | undefined>;

function item(file: string, fields: Fields = {}, body = "## Problem\nReal text.\n"): void {
  const merged: Fields = {
    id: file.slice(0, 7),
    type: "bug",
    area: "hooks",
    title: '"Un título"',
    status: "open",
    ...fields,
  };
  const yaml = Object.entries(merged)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  fs.writeFileSync(path.join(dir, file), `---\n${yaml}\n---\n${body}`);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-backlog-reviewer-"));
  dir = path.join(root, "factory", "backlog");
  fs.mkdirSync(dir, { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = root;
});

afterEach(() => {
  delete process.env.PANDACORP_FACTORY_ROOT;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("AC-22-008.1 the reader's order", () => {
  it("orders doing, open, then history, each by its own rule", () => {
    item("BL-0001-a.md", { status: "open" });
    item("BL-0002-b.md", { status: "open", severity: "p2" });
    item("BL-0003-c.md", { status: "open", severity: "p0" });
    item("BL-0004-d.md", { status: "doing", severity: "p2" });
    item("BL-0005-e.md", { status: "doing", severity: "p0" });
    item("BL-0006-f.md", { status: "doing" });
    item("BL-0007-g.md", { status: "open", severity: "p0" });
    item("BL-0008-h.md", { status: "done", severity: "p0", closed: "2026-01-01" });
    item("BL-0009-i.md", { status: "discarded", severity: "p2", closed: "2026-03-01" });
    item("BL-0010-j.md", { status: "done", closed: "2026-02-01" });
    expect(readBacklog().items.map((entry) => entry.id)).toEqual([
      "BL-0005",
      "BL-0004",
      "BL-0006",
      "BL-0003",
      "BL-0007",
      "BL-0002",
      "BL-0001",
      "BL-0009",
      "BL-0010",
      "BL-0008",
    ]);
  });

  it("compares history instants, never timestamp text", () => {
    item("BL-0001-a.md", { status: "done", closed: "2026-07-02T00:00:00Z" });
    item("BL-0002-b.md", { status: "done", closed: "2026-07-01T23:30:00-05:00" });
    item("BL-0003-c.md", { status: "done", closed: '"2026-07-01T23:59:59.500Z"' });
    expect(readBacklog().items.map((entry) => entry.id)).toEqual(["BL-0002", "BL-0001", "BL-0003"]);
  });

  it("puts undated history after dated history, in reader order", () => {
    item("BL-0001-a.md", { status: "discarded" });
    item("BL-0002-b.md", { status: "done", closed: "2026-01-01" });
    item("BL-0003-c.md", { status: "discarded", closed: "" });
    item("BL-0004-d.md", { status: "done", closed: "2026-02-01" });
    item("BL-0005-e.md", { status: "discarded" });
    const order = fs
      .readdirSync(dir)
      .map((file) => file.slice(0, 7))
      .filter((id) => ["BL-0001", "BL-0003", "BL-0005"].includes(id));
    expect(readBacklog().items.map((entry) => entry.id)).toEqual(["BL-0004", "BL-0002", ...order]);
  });
});

describe("AC-22-001.1 the typed model", () => {
  it("skips what is not a BL item without reporting it", () => {
    item("BL-0001-a.md");
    fs.writeFileSync(path.join(dir, "README.md"), "# not an item");
    fs.writeFileSync(path.join(dir, "_item-template.md"), "---\nid: BL-NNNN\n---\n");
    fs.writeFileSync(path.join(dir, "BL-0002-notes.txt"), "text");
    fs.writeFileSync(path.join(dir, "BL-0003-a.md.bak"), "text");
    fs.writeFileSync(path.join(dir, "notes.md"), "text");
    expect(readBacklog()).toMatchObject({ items: [{ id: "BL-0001" }], errors: [] });
  });

  it("exposes dates without inventing a time and keeps a real one", () => {
    item("BL-0001-a.md", {
      status: "done",
      opened: "2026-10-17",
      closed: "2026-10-18T08:30:00Z",
    });
    expect(readBacklog().items[0]).toMatchObject({
      opened: "2026-10-17",
      closed: "2026-10-18T08:30:00.000Z",
    });
  });

  it("keeps the markdown body and no frontmatter in it", () => {
    item("BL-0001-a.md", {}, "\n## Problem\n\n---\n\nstatus: open\n");
    expect(readBacklog().items[0]?.body).toBe("## Problem\n\n---\n\nstatus: open");
  });

  it("never writes", () => {
    item("BL-0001-a.md");
    const target = path.join(dir, "BL-0001-a.md");
    const before = fs.statSync(target).mtimeMs;
    const raw = fs.readFileSync(target);
    readBacklog();
    expect(fs.statSync(target).mtimeMs).toBe(before);
    expect(fs.readFileSync(target).equals(raw)).toBe(true);
  });
});

describe("AC-22-004.1 fail-loud boundary", () => {
  it.each([
    ["severity out of range", { severity: "p3" }, "invalid severity"],
    ["severity uppercase", { severity: "P1" }, "invalid severity"],
    ["severity blank", { severity: '"  "' }, "invalid severity"],
    ["status from another queue", { status: "ready" }, "invalid or missing status"],
    ["status missing", { status: undefined }, "invalid or missing status"],
    ["type from another queue", { type: "feature" }, "invalid or missing type"],
    ["type missing", { type: undefined }, "invalid or missing type"],
    ["id missing", { id: undefined }, "missing required field: id"],
    ["id blank", { id: '"  "' }, "missing required field: id"],
    ["id not text", { id: "1234" }, "missing required field: id"],
    ["area missing", { area: undefined }, "missing required field: area"],
    ["title missing", { title: undefined }, "missing required field: title"],
    ["title blank", { title: '"   "' }, "missing required field: title"],
  ])("%s lands in errors[], and valid items still list", (_name, fields, reason) => {
    item("BL-0001-good.md");
    item("BL-0002-bad.md", fields);
    const result = readBacklog();
    expect(result.items.map((entry) => entry.id)).toEqual(["BL-0001"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.file).toBe("BL-0002-bad.md");
    expect(result.errors[0]?.reason).toContain(reason);
  });

  it("accepts an absent or empty severity as no severity", () => {
    item("BL-0001-a.md", {});
    item("BL-0002-b.md", { severity: "" });
    item("BL-0003-c.md", { severity: "~" });
    const result = readBacklog();
    expect(result.errors).toEqual([]);
    expect(result.items.map((entry) => entry.severity)).toEqual([null, null, null]);
  });

  it("stays loud when the same broken bytes are read twice", () => {
    fs.writeFileSync(path.join(dir, "BL-0001-bad.md"), "---\nid: [unclosed\n---\nbody");
    expect(readBacklog().errors).toHaveLength(1);
    expect(readBacklog().errors).toHaveLength(1);
  });

  it("a file with no frontmatter is an error, not an empty item", () => {
    fs.writeFileSync(path.join(dir, "BL-0001-plain.md"), "# only a heading\n");
    expect(readBacklog()).toMatchObject({ items: [], errors: [{ file: "BL-0001-plain.md" }] });
  });

  it("a directory named like an item is an error", () => {
    fs.mkdirSync(path.join(dir, "BL-0001-dir.md"));
    expect(readBacklog().errors).toEqual([
      { file: "BL-0001-dir.md", reason: "file could not be read" },
    ]);
  });

  it("a backlog path that is a file is an error, not an empty backlog", () => {
    fs.rmSync(dir, { recursive: true });
    fs.writeFileSync(dir, "not a directory");
    const result = readBacklog();
    expect(result.items).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it("a missing directory is legitimately empty", () => {
    fs.rmSync(dir, { recursive: true });
    expect(readBacklog()).toEqual({ items: [], errors: [] });
  });
});

describe("AC-22-004.3 duplicate ids", () => {
  it("reports every later collision against the first file", () => {
    item("BL-0010-a.md");
    item("BL-0010-b.md");
    item("BL-0010-c.md");
    const { items, errors } = readBacklog();
    expect(items).toHaveLength(1);
    const [first, ...rest] = fs.readdirSync(dir);
    expect(errors).toEqual(
      rest.map((file) => ({
        file,
        reason: `duplicate id BL-0010 (already defined in ${first})`,
      })),
    );
  });

  it("does not let a malformed file claim an id", () => {
    fs.writeFileSync(path.join(dir, "BL-0010-a-bad.md"), "---\nid: [unclosed\n---\n");
    item("BL-0010-b-good.md");
    const result = readBacklog();
    expect(result.items.map((entry) => entry.id)).toEqual(["BL-0010"]);
    expect(result.errors.map((error) => error.file)).toEqual(["BL-0010-a-bad.md"]);
  });
});
