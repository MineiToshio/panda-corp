import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countOpenChanges } from "../openChanges";

let root: string;
let dir: string;

const card = (status: string): string =>
  `---\ntype: change\nclass: standard\nstatus: ${status}\ndate: 2026-10-22\nfrd: FRD-04\n---\n# Ajustar la vista\n\nCuerpo.\n`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "open-changes-reviewer-"));
  dir = path.join(root, ".pandacorp/inbox/changes");
});

afterEach(() => {
  for (const target of [dir, path.join(dir, "done")]) {
    if (fs.existsSync(target)) fs.chmodSync(target, 0o755);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

describe("IF-04-open-changes", () => {
  it("counts the archive by status, skips templates and hidden files", () => {
    fs.mkdirSync(path.join(dir, "done"), { recursive: true });
    fs.writeFileSync(path.join(dir, "ready.md"), card("ready"));
    fs.writeFileSync(path.join(dir, "closing.md"), card("closing"));
    fs.writeFileSync(path.join(dir, "gone.md"), card("discarded"));
    fs.writeFileSync(path.join(dir, "_change-template.md"), card("ready"));
    fs.writeFileSync(path.join(dir, "README.md"), "# Cola");
    fs.writeFileSync(path.join(dir, "done/shipped.md"), card("done"));
    fs.writeFileSync(path.join(dir, "done/left-ready.md"), card("ready"));
    expect(countOpenChanges(root)).toEqual({ ok: true, count: 3, errors: [] });
  });

  it("a missing queue is a real zero", () => {
    expect(countOpenChanges(root)).toEqual({ ok: true, count: 0, errors: [] });
  });

  it("a duplicate across the queue and its archive makes the count unknown", () => {
    fs.mkdirSync(path.join(dir, "done"), { recursive: true });
    fs.writeFileSync(path.join(dir, "same.md"), card("ready"));
    fs.writeFileSync(path.join(dir, "done/same.md"), card("done"));
    expect(countOpenChanges(root)).toMatchObject({
      ok: false,
      count: null,
      errors: [{ file: "done/same.md" }],
    });
  });

  it("never fabricates a zero when the queue path is not a directory", () => {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.writeFileSync(dir, "not a directory");
    const result = countOpenChanges(root);
    expect(result.ok).toBe(false);
    expect(result.count).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("never fabricates a zero when the queue directory cannot be listed", () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "ready.md"), card("ready"));
    fs.chmodSync(dir, 0o000);
    const result = countOpenChanges(root);
    expect(result.ok).toBe(false);
    expect(result.count).toBeNull();
  });

  it("never reports a partial count when the archive cannot be listed", () => {
    fs.mkdirSync(path.join(dir, "done"), { recursive: true });
    fs.writeFileSync(path.join(dir, "ready.md"), card("ready"));
    fs.chmodSync(path.join(dir, "done"), 0o000);
    const result = countOpenChanges(root);
    expect(result.ok).toBe(false);
    expect(result.count).toBeNull();
  });
});
