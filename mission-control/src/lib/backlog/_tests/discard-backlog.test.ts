import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "@/lib/fs-utils/parseFrontmatter";
import { afterEach, beforeEach, expect, it } from "vitest";
import { discardBacklogItem } from "../discard-backlog";

let root: string;
let dir: string;
const prevEnv = process.env.PANDACORP_FACTORY_ROOT;

function writeItem(filename: string, body: string): string {
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, body, "utf-8");
  return dest;
}

function readData(file: string): Record<string, unknown> {
  return matter(fs.readFileSync(file, "utf-8"), { excerpt: false }).data as Record<string, unknown>;
}

const ITEM = `---
id: BL-0001
type: bug
area: build-engine
title: A real closeable defect
status: open
severity: p1
opened: 2026-06-30
closed:
source: LESSON-0002
closes:
links: [LESSON-0002]
---

## Problem
Something is wrong.
`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-discard-backlog-"));
  dir = path.join(root, "factory", "backlog");
  fs.mkdirSync(dir, { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = root;
});

afterEach(() => {
  if (prevEnv === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = prevEnv;
  fs.rmSync(root, { recursive: true, force: true });
});

it.each(["done", "discarded", "unknown"])("refuses %s without a write", (status) => {
  const raw = ITEM.replace("status: open", `status: ${status}`);
  const target = writeItem("BL-0001-real.md", raw);
  expect(discardBacklogItem("BL-0001")).toEqual({ ok: false, reason: "not-discardable" });
  expect(fs.readFileSync(target, "utf8")).toBe(raw);
});
it.each(["BL-9999", "", "../outside"])("refuses unsafe id %s", (id) => {
  expect(discardBacklogItem(id)).toEqual({ ok: false, reason: "not-found" });
});
it("reports malformed YAML without a write", () => {
  const raw = "---\nid: BL-0005\n  bad: [unclosed\n---\nbody";
  const target = writeItem("BL-0005-broken.md", raw);
  expect(discardBacklogItem("BL-0005")).toEqual({ ok: false, reason: "parse-error" });
  expect(fs.readFileSync(target, "utf8")).toBe(raw);
});

it.each(["open", "doing"])("AC-22-007.2: preserves bytes and siblings (%s)", (status) => {
  const raw = ITEM.replace("status: open", `status: '${status}' # keep comment`)
    .replace("title: A real closeable defect", "title: 'Mejora del motor' # español")
    .replace("links: [LESSON-0002]", "links: [LESSON-0002]\ncustom: {nested: [1, true]}")
    .trimEnd();
  const target = writeItem("BL-0001-real.md", raw);
  const sibling = writeItem("BL-0002-sibling.md", "untouched");
  expect(discardBacklogItem("BL-0001", "  Ya no hace falta 🐼\nOtra línea  ")).toEqual({
    ok: true,
  });
  const written = fs.readFileSync(target, "utf8");
  expect(written).toBe(
    raw
      .replace(`status: '${status}'`, 'status: "discarded"')
      .replace(
        "---\n\n## Problem",
        `status_before_discard: "${status}"\ndiscard_reason: "Ya no hace falta 🐼\\nOtra línea"\n---\n\n## Problem`,
      ),
  );
  expect(readData(target).discard_reason).toBe("Ya no hace falta 🐼\nOtra línea");
  expect(fs.readFileSync(sibling, "utf8")).toBe("untouched");
});

it.each([undefined, "  ", "🐼".repeat(501)])("AC-22-007.2: bounds reason %s", (reason) => {
  const target = writeItem("BL-0001-real.md", ITEM);
  expect(discardBacklogItem("BL-0001", reason)).toEqual({ ok: true });
  expect(readData(target).discard_reason).toBe(reason?.trim() ? "🐼".repeat(500) : undefined);
});
