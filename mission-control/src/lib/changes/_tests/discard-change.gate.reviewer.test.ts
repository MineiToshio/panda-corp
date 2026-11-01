/** FRD-04 gate: limits and abuse of the bounded discard write, through the real file system. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "@/lib/fs-utils/parseFrontmatter";
import { discardChange } from "../discard-change";

let project: string;
let dir: string;
const file = () => path.join(dir, "item.md");
const write = (content: string) => fs.writeFileSync(file(), content);
const READY = "---\nstatus: ready\ntype: change\n---\n# T\n\nbody\n";

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), "mc-discard-gate-"));
  dir = path.join(project, ".pandacorp/inbox/changes");
  fs.mkdirSync(dir, { recursive: true });
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

describe("discard_reason limits", () => {
  it("accepts exactly 2000 characters and refuses 2001 with the file untouched", () => {
    write(READY);
    expect(discardChange(project, "item", "x".repeat(2001))).toEqual({
      ok: false,
      reason: "parse-error",
    });
    expect(fs.readFileSync(file(), "utf8")).toBe(READY);
    expect(discardChange(project, "item", "x".repeat(2000))).toEqual({ ok: true });
  });

  it("a hostile multi-line reason round-trips and cannot forge a frontmatter field", () => {
    write(READY);
    const reason = 'línea\n---\nstatus: ready\n"$& \\  ';
    expect(discardChange(project, "item", reason)).toEqual({ ok: true });
    const parsed = matter(fs.readFileSync(file(), "utf8"), { excerpt: false });
    expect(parsed.data).toMatchObject({ status: "discarded", discard_reason: reason.trim() });
    expect(parsed.content).toBe("# T\n\nbody\n");
  });

  it("a blank reason records no discard_reason", () => {
    write(READY);
    expect(discardChange(project, "item", "   ")).toEqual({ ok: true });
    expect(fs.readFileSync(file(), "utf8")).toBe(
      "---\nstatus: discarded\ntype: change\nstatus_before_discard: ready\n---\n# T\n\nbody\n",
    );
  });
});

describe("refusals leave the file untouched", () => {
  it.each(["building", "closing", "done", "discarded", "nonsense"])("status %s", (status) => {
    const content = READY.replace("ready", status);
    write(content);
    expect(discardChange(project, "item")).toEqual({ ok: false, reason: "not-discardable" });
    expect(fs.readFileSync(file(), "utf8")).toBe(content);
  });

  it("a symlinked queue item is refused and its target is not written", () => {
    const outside = path.join(project, "outside.md");
    fs.writeFileSync(outside, READY);
    fs.symlinkSync(outside, file());
    expect(discardChange(project, "item")).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(outside, "utf8")).toBe(READY);
  });

  it.each(["../item", "item/../item", ".item", "a b", ""])("id %j", (id) => {
    write(READY);
    expect(discardChange(project, id)).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(file(), "utf8")).toBe(READY);
  });

  it("a closing fence with no trailing newline still preserves the rest", () => {
    write("---\nstatus: draft\n---");
    expect(discardChange(project, "item")).toEqual({ ok: true });
    expect(fs.readFileSync(file(), "utf8")).toBe(
      "---\nstatus: discarded\nstatus_before_discard: draft\n---",
    );
  });
});
