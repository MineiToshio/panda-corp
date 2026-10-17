import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "../../portfolio/portfolio";
import { getProjectNavigation, resolveProjectNavigation } from "../identities";
import { readNavigationCatalog } from "../identityCatalog";

let root: string;
function write(relative: string, content: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function portfolio(rows: [string, string][]): ProjectListItem[] {
  write(
    "factory/portfolio.md",
    `| Proyecto | Ruta | Fase |\n|---|---|---|\n${rows.map(([name, locator]) => `| ${name} | ${locator} | implementation |`).join("\n")}\n`,
  );
  for (const [, locator] of rows) fs.mkdirSync(path.join(root, locator), { recursive: true });
  return rows.map(([name, locator]) => ({
    name,
    path: locator,
    exists: true,
    status: { present: false, malformed: false, status: null },
  }));
}
function cli(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--loader",
      "./scripts/read-model/ts-loader.mjs",
      "./scripts/navigation/identities.mjs",
      "--factory-root",
      root,
      ...args,
    ],
    { encoding: "utf8" },
  );
}
function apply(...args: string[]) {
  const result = cli("--apply", ...args);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { added: number; changedFiles: string[] };
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "navigation-independent-review-"));
  fs.mkdirSync(path.join(root, "factory/ideas"), { recursive: true });
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) fs.unlinkSync(path.join(entry.parentPath, entry.name));
  }
});

describe("independent real-CLI identity lifecycle", () => {
  it("reserves all historical aliases after multiple renames and refuses reassignment without partial writes", () => {
    const items = portfolio([
      ["Alpha", "first"],
      ["Beta", "second"],
    ]);
    apply();
    const first = getProjectNavigation("first", "Alpha");
    const second = getProjectNavigation("second", "Beta");
    apply("--rename-kind", "project", "--rename-id", first.id, "--slug", "alpha-two");
    apply("--rename-kind", "project", "--rename-id", first.id, "--slug", "alpha-three");
    const before = fs.readFileSync(path.join(root, "factory/navigation-identities.json"), "utf8");
    for (const old of ["alpha", "alpha-two"]) {
      expect(resolveProjectNavigation(old, items)).toBe(items[0]);
      const rejected = cli(
        "--apply",
        "--rename-kind",
        "project",
        "--rename-id",
        second.id,
        "--slug",
        old,
      );
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("permanently reserved");
      expect(fs.readFileSync(path.join(root, "factory/navigation-identities.json"), "utf8")).toBe(
        before,
      );
    }
    expect(fs.existsSync(path.join(root, "factory/navigation-identities.json.lock"))).toBe(false);
    expect(apply().changedFiles).toEqual([]);
  });

  it("keeps an absent project's address reserved while adding a same-name project after the first registration", () => {
    portfolio([["Shared Name", "first"]]);
    apply();
    const first = getProjectNavigation("first", "Shared Name");
    const items = portfolio([["Shared Name", "second"]]);
    expect(apply().added).toBe(1);
    const second = getProjectNavigation("second", "Shared Name");
    expect(second.id).not.toBe(first.id);
    expect(second.slug).not.toBe(first.slug);
    expect(resolveProjectNavigation(first.slug, items)).toBeUndefined();
    expect(resolveProjectNavigation(second.slug, items)).toBe(items[0]);
    expect(readNavigationCatalog(root)?.resources).toHaveLength(2);
  });

  it("reconciles a moved project using its dedicated reference and makes reads byte-for-byte inert", () => {
    portfolio([["Before Move", "original"]]);
    apply();
    const original = getProjectNavigation("original", "Before Move");
    fs.renameSync(path.join(root, "original"), path.join(root, "moved"));
    const items = portfolio([["After Move", "moved"]]);
    expect(apply().added).toBe(0);
    const files = [
      "factory/navigation-identities.json",
      "factory/portfolio.md",
      "moved/.pandacorp/navigation-identity.json",
    ];
    const before = files.map((file) => fs.readFileSync(path.join(root, file), "utf8"));
    expect(getProjectNavigation("moved", "After Move")).toEqual(original);
    expect(resolveProjectNavigation("Before Move", items)).toBe(items[0]);
    expect(resolveProjectNavigation("../moved", items)).toBeUndefined();
    expect(files.map((file) => fs.readFileSync(path.join(root, file), "utf8"))).toEqual(before);
    expect(apply().changedFiles).toEqual([]);
  });
});
