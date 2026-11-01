import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { discardIdea } from "@/lib/discard/discard";
import { restoreIdea } from "@/lib/discard/restore";
import { setFavorite } from "@/lib/favorite/favorite";
import matter from "@/lib/fs-utils/parseFrontmatter";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    for (const name of fs.readdirSync(root)) fs.unlinkSync(path.join(root, name));
  }
});
it.each([
  "decision-log",
  "_idea-template",
  "folder/card",
  "A",
  "x".repeat(256),
  null,
  {},
])("rejects non-card write target %s", (slug) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idea-security-"));
  roots.push(root);
  if (typeof slug === "string" && !slug.includes("/") && slug.length < 256)
    fs.writeFileSync(path.join(root, `${slug}.md`), "---\nstatus: discovered\n---\nKeep\n");
  expect(discardIdea(slug as string, root)).toEqual({ ok: false, reason: "not-found" });
  expect(restoreIdea(slug as string, root)).toEqual({ ok: false, reason: "not-found" });
  expect(setFavorite(slug as string, true, root)).toEqual({ ok: false, reason: "not-found" });
});
it.each([
  "js",
  "javascript",
  "coffee",
  "coffeescript",
  "cson",
])("rejects executable %s frontmatter without side effects on every parse", (language) => {
  Reflect.deleteProperty(globalThis, "__frontmatterExecuted");
  const payload = `---${language}\n(globalThis.__frontmatterExecuted = true, { title: 'unsafe' })\n---\nBody`;
  for (let i = 0; i < 2; i++) {
    expect(() => matter(payload, { excerpt: false })).toThrow();
    expect(Reflect.get(globalThis, "__frontmatterExecuted")).toBeUndefined();
  }
});

it("surfaces a real executable queue file as an error on repeated reads", async () => {
  const { readChangeQueue } = await import("@/lib/changes/changes");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "queue-security-"));
  const dir = path.join(root, ".pandacorp/inbox/changes");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "unsafe.md");
  fs.writeFileSync(
    file,
    "---js\n(globalThis.__queueExecuted = true, { status: 'ready', type: 'bug' })\n---\nBody",
  );
  try {
    for (let i = 0; i < 2; i++) {
      expect(readChangeQueue(root)).toMatchObject({
        items: [],
        errors: [{ file: "unsafe.md", reason: "malformed YAML frontmatter" }],
      });
      expect(Reflect.get(globalThis, "__queueExecuted")).toBeUndefined();
    }
  } finally {
    fs.unlinkSync(file);
  }
});
