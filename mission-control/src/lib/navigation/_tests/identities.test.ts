import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRegistration, planRegistration } from "../../../../scripts/navigation/registry";
import type { ProjectListItem } from "../../portfolio/portfolio";
import {
  getIdeaNavigation,
  getProjectNavigation,
  resolveIdeaNavigation,
  resolveProjectNavigation,
} from "../identities";
import { readNavigationCatalog } from "../identityCatalog";

let root: string;
function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function portfolio(rows: [string, string][]): void {
  write(
    path.join(root, "factory/portfolio.md"),
    `| Proyecto | Ruta | Fase |\n|---|---|---|\n${rows.map(([name, locator]) => `| ${name} | ${locator} | product |`).join("\n")}\n`,
  );
}
function idea(slug: string, project?: string): void {
  write(
    path.join(root, `factory/ideas/${slug}.md`),
    `---\ntitle: ${slug}\nstatus: discovered\n${project ? `project: ${project}\n` : ""}---\nPersonal body retained.\n`,
  );
}
function item(name: string, locator: string): ProjectListItem {
  return {
    name,
    path: locator,
    exists: true,
    status: { present: false, malformed: false, status: null },
  };
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "navigation-identity-test-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  fs.mkdirSync(path.join(root, "factory/ideas"), { recursive: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) fs.unlinkSync(path.join(entry.parentPath, entry.name));
  }
});
describe("persistent navigation identity lifecycle", () => {
  it("previews without writes, allocates separate bridged IDs, and reruns without changes", () => {
    fs.mkdirSync(path.join(root, "project-one"));
    portfolio([["Project One", "project-one"]]);
    idea("an-idea", "project-one");
    expect(planRegistration(root).added).toBe(2);
    expect(fs.existsSync(path.join(root, "factory/navigation-identities.json"))).toBe(false);
    const applied = applyRegistration(root);
    const ideaIdentity = getIdeaNavigation("an-idea");
    const projectIdentity = getProjectNavigation("project-one", "Project One");
    expect(ideaIdentity.id).not.toBe(projectIdentity.id);
    expect(
      applied.catalog.resources.find((record) => record.id === ideaIdentity.id)?.projectId,
    ).toBe(projectIdentity.id);
    expect(applyRegistration(root).writes.size).toBe(0);
    expect(fs.readFileSync(path.join(root, "factory/ideas/an-idea.md"), "utf8")).toContain(
      "Personal body retained.",
    );
  });
  it("bootstraps a fresh factory clone without carrying another owner's Mission Control reference", () => {
    fs.mkdirSync(path.join(root, "mission-control"));
    portfolio([["Mission Control", "mission-control"]]);
    expect(fs.existsSync(path.join(root, "factory/navigation-identities.json"))).toBe(false);
    expect(
      fs.existsSync(path.join(root, "mission-control/.pandacorp/navigation-identity.json")),
    ).toBe(false);
    expect(applyRegistration(root).added).toBe(1);
    const identity = getProjectNavigation("mission-control", "Mission Control");
    expect(identity.id).toMatch(/^project_/);
    expect(applyRegistration(root).writes.size).toBe(0);
    const ignored = spawnSync(
      "git",
      ["check-ignore", "--no-index", "mission-control/.pandacorp/navigation-identity.json"],
      {
        cwd: path.resolve(process.cwd(), ".."),
        encoding: "utf8",
      },
    );
    expect(ignored.status, ignored.stderr).toBe(0);
    expect(ignored.stdout.trim()).toBe("mission-control/.pandacorp/navigation-identity.json");
  });
  it("recovers an interrupted reference update without reallocating published identities", () => {
    fs.mkdirSync(path.join(root, "recover"));
    portfolio([["Recover", "recover"]]);
    idea("recover-card", "recover");
    applyRegistration(root);
    const before = getIdeaNavigation("recover-card");
    const projectBefore = getProjectNavigation("recover", "Recover");
    fs.unlinkSync(path.join(root, "recover/.pandacorp/navigation-identity.json"));
    const card = path.join(root, "factory/ideas/recover-card.md");
    fs.writeFileSync(card, fs.readFileSync(card, "utf8").replace(/^navigation_id:.*\n/m, ""));
    expect(applyRegistration(root).added).toBe(0);
    expect(getIdeaNavigation("recover-card")).toEqual(before);
    expect(getProjectNavigation("recover", "Recover")).toEqual(projectBefore);
  });
  it("boots through the CLI using actual readers and exposes registrations without a dashboard build", () => {
    idea("from-cli");
    const cli = [
      "--loader",
      "./scripts/read-model/ts-loader.mjs",
      "./scripts/navigation/identities.mjs",
      "--factory-root",
      root,
    ];
    const preview = spawnSync(process.execPath, [...cli, "--dry-run"], { encoding: "utf8" });
    expect(preview.status, preview.stderr).toBe(0);
    expect(fs.existsSync(path.join(root, "factory/navigation-identities.json"))).toBe(false);
    const applied = spawnSync(process.execPath, [...cli, "--apply"], { encoding: "utf8" });
    expect(applied.status, applied.stderr).toBe(0);
    expect(getIdeaNavigation("from-cli").id).toMatch(/^idea_/);
    expect(resolveIdeaNavigation("from-cli", [{ slug: "from-cli" }])).toBe("from-cli");
  });
  it("retains URLs across display rename, card filename rename, folder move, and explicit public rename", () => {
    fs.mkdirSync(path.join(root, "original"));
    portfolio([["Original Name", "original"]]);
    idea("old-card", "original");
    applyRegistration(root);
    const original = getProjectNavigation("original", "Original Name");
    const originalIdea = getIdeaNavigation("old-card");
    fs.renameSync(path.join(root, "original"), path.join(root, "moved"));
    fs.renameSync(
      path.join(root, "factory/ideas/old-card.md"),
      path.join(root, "factory/ideas/new-card.md"),
    );
    const cardFile = path.join(root, "factory/ideas/new-card.md");
    fs.writeFileSync(
      cardFile,
      fs.readFileSync(cardFile, "utf8").replace("project: original", "project: moved"),
    );
    portfolio([["New Name", "moved"]]);
    applyRegistration(root);
    expect(getProjectNavigation("moved", "New Name")).toEqual(original);
    expect(getIdeaNavigation("new-card")).toEqual(originalIdea);
    expect(resolveIdeaNavigation("old-card", [{ slug: "new-card" }])).toBe("new-card");
    const items = [item("New Name", "moved")];
    expect(resolveProjectNavigation("Original Name", items)).toBe(items[0]);
    applyRegistration(root, { kind: "project", id: original.id, slug: "new-public-url" });
    expect(resolveProjectNavigation(original.slug, items)).toBe(items[0]);
    expect(getProjectNavigation("moved", "New Name").slug).toBe("new-public-url");
  });
  it("allocates distinct same-name projects and rejects ambiguous legacy names", () => {
    fs.mkdirSync(path.join(root, "first"));
    fs.mkdirSync(path.join(root, "second"));
    portfolio([
      ["Same Name", "first"],
      ["Same Name", "second"],
    ]);
    applyRegistration(root);
    const first = getProjectNavigation("first", "Same Name");
    const second = getProjectNavigation("second", "Same Name");
    expect(first.id).not.toBe(second.id);
    expect(first.slug).not.toBe(second.slug);
    const items = [item("Same Name", "first"), item("Same Name", "second")];
    expect(resolveProjectNavigation("Same Name", items)).toBeUndefined();
    expect(resolveProjectNavigation(first.slug, items)).toBe(items[0]);
    expect(() =>
      applyRegistration(root, { kind: "project", id: second.id, slug: first.slug }),
    ).toThrow("reserved");
  });
  it("never writes on reads and fails loudly for corrupted catalogs and orphan references", () => {
    idea("legacy-card");
    expect(getIdeaNavigation("legacy-card").slug).toBe("legacy-card");
    expect(fs.existsSync(path.join(root, "factory/navigation-identities.json"))).toBe(false);
    applyRegistration(root);
    write(path.join(root, "factory/navigation-identities.json"), "{broken");
    expect(() => getIdeaNavigation("legacy-card")).toThrow("cannot read catalog");
    expect(() => applyRegistration(root)).toThrow("cannot read catalog");
    fs.unlinkSync(path.join(root, "factory/navigation-identities.json"));
    expect(() => applyRegistration(root)).toThrow("restore the catalog");
  });
  it("loads roots at call time, rejects filesystem tokens and discovers post-startup registrations", () => {
    idea("first");
    applyRegistration(root);
    const first = getIdeaNavigation("first");
    idea("second");
    applyRegistration(root);
    expect(resolveIdeaNavigation("second", [{ slug: "first" }, { slug: "second" }])).toBe("second");
    expect(resolveIdeaNavigation("../factory/profile.md", [{ slug: "first" }])).toBeUndefined();
    expect(resolveIdeaNavigation("%2e%2e", [{ slug: "first" }])).toBeUndefined();
    expect(() => getIdeaNavigation("../first")).toThrow("invalid");
    vi.stubEnv("PANDACORP_FACTORY_ROOT", path.join(root, "empty-factory"));
    expect(getIdeaNavigation("first").id).not.toBe(first.id);
  });
  it("refuses copied IDs, writer races, duplicate tokens and missing project directories", () => {
    idea("one");
    applyRegistration(root);
    fs.copyFileSync(
      path.join(root, "factory/ideas/one.md"),
      path.join(root, "factory/ideas/two.md"),
    );
    expect(() => applyRegistration(root)).toThrow("copied idea identity");
    fs.unlinkSync(path.join(root, "factory/ideas/two.md"));
    const catalog = readNavigationCatalog(root);
    const record = catalog?.resources[0];
    if (!catalog || !record) throw new Error("fixture identity missing");
    record.aliases.push(record.slug);
    write(path.join(root, "factory/navigation-identities.json"), JSON.stringify(catalog));
    expect(() => getIdeaNavigation("one")).toThrow("duplicate public token");
    write(path.join(root, "factory/navigation-identities.json.lock"), "locked");
    expect(() => applyRegistration(root)).toThrow();
    fs.unlinkSync(path.join(root, "factory/navigation-identities.json.lock"));
    fs.unlinkSync(path.join(root, "factory/navigation-identities.json"));
    portfolio([["Missing", "gone"]]);
    expect(() => applyRegistration(root)).toThrow("unavailable project directory");
  });
});
