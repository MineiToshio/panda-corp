import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "@/lib/fs-utils/parseFrontmatter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBacklog } from "../backlog";
import { discardBacklogItem } from "../discard-backlog";

let root: string;
let dir: string;

/** The factory's own `_item-template.md` shape: inline comments and empty keys included. */
const templateShaped = (id = "BL-0001", status = "open"): string =>
  `---
id: ${id}
type: bug                 # bug (defect in existing tooling) | change
area: build-engine        # build-engine | plugin-skill
title: "Fixture: quoted title — con acento"
status: ${status}              # open | doing | done
severity: p1              # p0 | p1 | p2
opened: 2026-10-17
closed:                   # YYYY-MM-DD when done (empty while open)
source: "LESSON-0002"
closes:                   # filled on close
links: []                 # [LESSON-NNNN, DR-NNN]
---

## Problem
Body with --- dashes and status: open inside the text.

---

## Fix plan
1. Keep me.
`;

function write(file: string, content: string | Buffer): string {
  const target = path.join(dir, file);
  fs.writeFileSync(target, content);
  return target;
}

function data(file: string): Record<string, unknown> {
  return matter(fs.readFileSync(file, "utf8"), { excerpt: false }).data as Record<string, unknown>;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-discard-reviewer-"));
  dir = path.join(root, "factory", "backlog");
  fs.mkdirSync(dir, { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = root;
});

afterEach(() => {
  delete process.env.PANDACORP_FACTORY_ROOT;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("AC-22-007.2 byte preservation", () => {
  it("keeps every byte of a template-shaped item outside the three fields", () => {
    const raw = templateShaped();
    const target = write("BL-0001-template.md", raw);
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: true });
    expect(fs.readFileSync(target, "utf8")).toBe(
      raw
        .replace("status: open  ", 'status: "discarded"  ')
        .replace(
          "[LESSON-NNNN, DR-NNN]\n---",
          '[LESSON-NNNN, DR-NNN]\nstatus_before_discard: "open"\n---',
        ),
    );
  });

  it("keeps CRLF line endings, and writes the added fields with CRLF too", () => {
    const raw = templateShaped().replaceAll("\n", "\r\n");
    const target = write("BL-0001-crlf.md", raw);
    expect(discardBacklogItem("BL-0001", "motivo")).toEqual({ ok: true });
    const written = fs.readFileSync(target, "utf8");
    expect(written.replaceAll("\r\n", "")).not.toContain("\n");
    expect(written).toContain(
      'status_before_discard: "open"\r\ndiscard_reason: "motivo"\r\n---\r\n',
    );
    expect(data(target).status).toBe("discarded");
  });

  it("keeps a file with no trailing newline without one", () => {
    const raw = "---\nid: BL-0001\ntype: bug\narea: hooks\ntitle: x\nstatus: open\n---\nbody";
    const target = write("BL-0001-eof.md", raw);
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: true });
    expect(fs.readFileSync(target, "utf8").endsWith("\n---\nbody")).toBe(true);
  });

  it("refuses, byte-identical, a file whose bytes are not valid UTF-8", () => {
    const head = Buffer.from(templateShaped());
    const raw = Buffer.concat([head, Buffer.from([0xe9, 0xff, 0x0a])]);
    const target = write("BL-0001-latin1.md", raw);
    const result = discardBacklogItem("BL-0001");
    const after = fs.readFileSync(target);
    if (result.ok) {
      // A successful write must still keep the body's original bytes.
      expect(after.subarray(after.length - 3)).toEqual(Buffer.from([0xe9, 0xff, 0x0a]));
    } else {
      expect(after.equals(raw)).toBe(true);
    }
  });

  it("leaves a stale discard_reason alone on a blank reason and replaces it on a typed one", () => {
    const raw = templateShaped().replace("links: []", 'discard_reason: "antes"\nlinks: []');
    const target = write("BL-0001-stale.md", raw);
    expect(discardBacklogItem("BL-0001", "   ")).toEqual({ ok: true });
    expect(data(target).discard_reason).toBe("antes");
    const second = write("BL-0002-stale.md", raw.replace("BL-0001", "BL-0002"));
    expect(discardBacklogItem("BL-0002", "ahora")).toEqual({ ok: true });
    expect(data(second).discard_reason).toBe("ahora");
  });
});

describe("AC-22-007.2 the written file stays a readable item, or the write is refused", () => {
  const shapes: readonly [string, string][] = [
    ["empty status_before_discard key", "status_before_discard:\nseverity: p1\n"],
    ["empty discard_reason key", "discard_reason:\nseverity: p1\n"],
    ["empty keys with comments", "status_before_discard:   # none\ndiscard_reason:   # none\n"],
  ];

  it.each(shapes)("%s", (_name, extra) => {
    const raw = templateShaped().replace("severity: p1              # p0 | p1 | p2\n", extra);
    const target = write("BL-0001-empty.md", raw);
    const result = discardBacklogItem("BL-0001", "motivo");
    if (!result.ok) {
      expect(fs.readFileSync(target, "utf8")).toBe(raw);
      return;
    }
    expect(data(target)).toMatchObject({
      status: "discarded",
      status_before_discard: "open",
      discard_reason: "motivo",
    });
  });

  const roots: readonly [string, string][] = [
    [
      "block scalar status",
      "---\nid: BL-0001\nstatus: >-\n  open\ntype: bug\narea: hooks\ntitle: x\n---\nb\n",
    ],
    [
      "flow-mapping root",
      "---\n{id: BL-0001, type: bug, area: hooks, title: x, status: open}\n---\nb\n",
    ],
    [
      "indented root",
      "---\n  id: BL-0001\n  type: bug\n  area: hooks\n  title: x\n  status: open\n---\nb\n",
    ],
    [
      "document end marker",
      "---\nid: BL-0001\ntype: bug\narea: hooks\ntitle: x\nstatus: open\n...\n---\nb\n",
    ],
    [
      "closing delimiter with trailing space",
      "---\nid: BL-0001\ntype: bug\narea: hooks\ntitle: x\nstatus: open\n--- \nb\n---\nc\n",
    ],
    [
      "byte order mark",
      "﻿---\nid: BL-0001\ntype: bug\narea: hooks\ntitle: x\nstatus: open\n---\nb\n",
    ],
  ];

  it.each(roots)("%s", (_name, raw) => {
    const target = write("BL-0001-shape.md", raw);
    const result = discardBacklogItem("BL-0001");
    if (!result.ok) {
      expect(fs.readFileSync(target, "utf8")).toBe(raw);
      return;
    }
    expect(data(target)).toMatchObject({
      id: "BL-0001",
      status: "discarded",
      status_before_discard: "open",
    });
    expect(readBacklog().errors).toEqual([]);
  });
});

describe("AC-22-007.2 reason content cannot damage the item", () => {
  const reasons: readonly [string, string][] = [
    ["delete control", "antes\u007Fdespués"],
    ["C1 control", "antes\u0080después"],
    ["NEL", "antes\u0085después"],
    ["line separator", "antes después"],
    ["nonchar U+FFFE", "antes￾después"],
    ["nonchar U+FFFF", "antes￿después"],
    ["NUL", "antes\u0000después"],
    ["escape", "antes\u001Bdespués"],
    ["frontmatter close", 'x"\n---\nstatus: open\nid: BL-9999\n---\ny'],
    ["yaml comment and mapping", "a: b # c\n- d"],
    ["backslashes and quotes", '\\" \\n \'" $& {{y}}'],
  ];

  it.each(reasons)("%s round-trips and the item stays readable", (_name, reason) => {
    const target = write("BL-0001-reason.md", templateShaped());
    expect(discardBacklogItem("BL-0001", reason)).toEqual({ ok: true });
    const result = readBacklog();
    expect(result.errors).toEqual([]);
    expect(result.items.map((item) => [item.id, item.status])).toEqual([["BL-0001", "discarded"]]);
    expect(data(target).discard_reason).toBe(reason.trim());
  });

  it("cannot inject a second frontmatter key through a newline", () => {
    const target = write("BL-0001-inject.md", templateShaped());
    expect(discardBacklogItem("BL-0001", 'x"\nstatus: open\nfoo: "bar')).toEqual({ ok: true });
    expect(data(target).status).toBe("discarded");
    expect(data(target).foo).toBeUndefined();
  });
});

describe("IF-22-discard reason bound (500 characters)", () => {
  const stored = (reason: string): unknown => {
    const target = write("BL-0001-bound.md", templateShaped());
    expect(discardBacklogItem("BL-0001", reason)).toEqual({ ok: true });
    return data(target).discard_reason;
  };

  it("stores exactly 500 characters untouched", () => {
    expect(stored("a".repeat(500))).toBe("a".repeat(500));
  });

  it("cuts 501 characters to 500", () => {
    expect(stored("a".repeat(501))).toBe("a".repeat(500));
  });

  it("measures after trimming", () => {
    expect(stored(`${" ".repeat(50)}${"a".repeat(500)}${"\n".repeat(50)}`)).toBe("a".repeat(500));
  });

  it("never splits a surrogate pair at the cut", () => {
    const value = stored(`${"a".repeat(499)}🐼🐼`) as string;
    expect(value).toBe(`${"a".repeat(499)}🐼`);
    expect(value).not.toContain("�");
  });

  it("treats only-whitespace variants as blank", () => {
    expect(stored(" \t\r\n 　")).toBeUndefined();
  });
});

describe("IF-22-discard id and path safety", () => {
  it.each([
    "../BL-0001",
    "BL-0001/../BL-0001",
    "BL-0001/",
    "BL-0001\n",
    "BL-0001\u0000",
    "BL-0001.md",
    "BL-0001-real",
    "bl-0001",
    " BL-0001",
    "BL-٠٠٠١",
    "BL-",
    "..",
    ".",
    "/etc/passwd",
    "BL-0001*",
  ])("refuses %j without a write", (id) => {
    const raw = templateShaped();
    const target = write("BL-0001-real.md", raw);
    expect(discardBacklogItem(id)).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(target, "utf8")).toBe(raw);
  });

  it("does not follow a symlink out of the backlog directory", () => {
    const outside = path.join(root, "outside.md");
    fs.writeFileSync(outside, templateShaped());
    fs.symlinkSync(outside, path.join(dir, "BL-0001-link.md"));
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(outside, "utf8")).toBe(templateShaped());
  });

  it("skips a symlink and still reaches the regular file of that id", () => {
    const outside = path.join(root, "outside.md");
    fs.writeFileSync(outside, templateShaped());
    fs.symlinkSync(outside, path.join(dir, "BL-0001-a-link.md"));
    const real = write("BL-0001-b-real.md", templateShaped());
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: true });
    expect(data(real).status).toBe("discarded");
    expect(fs.readFileSync(outside, "utf8")).toBe(templateShaped());
  });

  it("does not treat a directory or a non-markdown file as the item", () => {
    fs.mkdirSync(path.join(dir, "BL-0001-dir.md"));
    write("BL-0001-notes.txt", templateShaped());
    write("BL-0001-real.md.bak", templateShaped());
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(path.join(dir, "BL-0001-notes.txt"), "utf8")).toBe(templateShaped());
  });

  it("never confuses an id with a longer id sharing its prefix", () => {
    const longer = write("BL-00011-other.md", templateShaped("BL-00011"));
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(longer, "utf8")).toBe(templateShaped("BL-00011"));
  });

  it("refuses a file that declares another id and never rewrites it", () => {
    const raw = templateShaped("BL-0002");
    const target = write("BL-0001-mismatch.md", raw);
    expect(discardBacklogItem("BL-0001").ok).toBe(false);
    expect(fs.readFileSync(target, "utf8")).toBe(raw);
  });

  it("IF-22-discard: a same-prefix file declaring another id does not hide the real item", () => {
    const foreign = templateShaped("BL-0011");
    const first = write("BL-0010-a-reused.md", foreign);
    const item = write("BL-0010-b-real.md", templateShaped("BL-0010"));
    expect(discardBacklogItem("BL-0010")).toEqual({ ok: true });
    expect(data(item).status).toBe("discarded");
    expect(fs.readFileSync(first, "utf8")).toBe(foreign);
  });

  it("refuses, as not-found, an id no filename carries, and writes nothing", () => {
    const raw = templateShaped("BL-0100");
    const target = write("BL-0099-renamed.md", raw);
    expect(discardBacklogItem("BL-0100")).toEqual({ ok: false, reason: "not-found" });
    expect(fs.readFileSync(target, "utf8")).toBe(raw);
  });

  it("with a duplicate id, rewrites the copy the reader keeps and leaves the other", () => {
    const raw = templateShaped("BL-0010");
    const a = write("BL-0010-a.md", raw);
    const b = write("BL-0010-b.md", raw);
    const kept = readBacklog().errors[0]?.file === "BL-0010-b.md" ? a : b;
    const other = kept === a ? b : a;
    expect(discardBacklogItem("BL-0010")).toEqual({ ok: true });
    expect(data(kept).status).toBe("discarded");
    expect(fs.readFileSync(other, "utf8")).toBe(raw);
  });

  it("reports a missing backlog directory as not-found", () => {
    fs.rmSync(dir, { recursive: true });
    expect(discardBacklogItem("BL-0001")).toEqual({ ok: false, reason: "not-found" });
  });
});
