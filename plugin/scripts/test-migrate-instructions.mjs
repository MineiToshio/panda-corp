#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, symlink, readdir, lstat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "plugin/scripts/migrate-instructions.mjs");
const scratch = await mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), "migrate-instructions-"));
let passed = 0;
let failed = 0;
const fixture = async (claude, agents = "# Existing project\n\nKeep this rule.\n") => {
  const project = await mkdtemp(path.join(scratch, "project-"));
  if (claude !== null) await writeFile(path.join(project, "CLAUDE.md"), claude);
  if (agents !== null) await writeFile(path.join(project, "AGENTS.md"), agents);
  return project;
};
const run = (project, ...args) => {
  const result = spawnSync(process.execPath, [script, "--project", project, ...args], { encoding: "utf8" });
  assert.equal(result.stdout.trim().split("\n").length, 1, "one JSON line on stdout");
  return { ...result, json: JSON.parse(result.stdout) };
};
const read = (project, name) => readFile(path.join(project, name), "utf8");
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
};
try {
  await test("moves owner text, headings, custom imports and comments without losing any line", async () => {
    const old = "# My app\n\n@AGENTS.md\n@docs/rules/README.md\n@.pandacorp/guide.md\n\n## Mission Control specifics\nUse exact: `returnTo`\n@docs/custom-policy.md\n<!-- owner notes -->\nRepeated rule.\nRepeated rule.\n";
    const project = await fixture(old);
    const result = run(project);
    assert.equal(result.status, 0, result.stdout);
    const agents = await read(project, "AGENTS.md");
    assert.match(agents, /## Project notes/);
    assert.ok(agents.startsWith("# Existing project\n\nKeep this rule.\n"));
    assert.ok(agents.includes("Repeated rule.\nRepeated rule."));
    for (const line of old.split("\n").filter(line => line.trim() && !["@AGENTS.md", "@docs/rules/README.md", "@.pandacorp/guide.md"].includes(line))) assert.ok(agents.split("\n").includes(line), line);
    assert.equal(await read(project, "CLAUDE.md"), "@AGENTS.md\n");
    assert.equal(result.json.preserved_lines, 7);
  });
  for (const eol of ["\n", "\r\n"]) {
    for (const fence of ["```", "~~~"]) {
      await test(`AGFIX preserves ${fence} code imports and mixed notes (${JSON.stringify(eol)})`, async () => {
        const content = ["Owner example:", `${fence}md`, "@AGENTS.md", "@docs/rules/README.md", "@.pandacorp/guide.md", fence];
        const old = ["@AGENTS.md", "Owner note before.", ...content, "@docs/rules/README.md", "Owner note after.", "@.pandacorp/guide.md"].join(eol);
        const project = await fixture(old);
        assert.equal(run(project).status, 0);
        const agents = await read(project, "AGENTS.md");
        assert.ok(agents.includes(content.join("\n")), "entire fenced code block survives");
        assert.ok(agents.includes("Owner note before.")); assert.ok(agents.includes("Owner note after."));
        for (const managed of ["@AGENTS.md", "@docs/rules/README.md", "@.pandacorp/guide.md"]) {
          assert.equal(agents.split(/\r?\n/).filter(line => line === managed).length, 1, "only outside imports disappear");
        }
        assert.equal(await read(project, "CLAUDE.md"), "@AGENTS.md\n");
      });
    }
    await test(`AGFIX preserves indented imports (${JSON.stringify(eol)})`, async () => {
      const content = ["    @AGENTS.md", "\t@docs/rules/README.md", "    @.pandacorp/guide.md"];
      const project = await fixture(["@AGENTS.md", "Example:", "", ...content, "", "Owner note.", "@.pandacorp/guide.md"].join(eol));
      assert.equal(run(project).status, 0);
      const agents = await read(project, "AGENTS.md");
      assert.ok(agents.includes(content.join("\n")));
      assert.ok(!agents.split(/\r?\n/).includes("@AGENTS.md"));
    });
  }
  await test("AGFIX fences close only with the matching character and sufficient length", async () => {
    const old = "````md\n```\n~~~\n@AGENTS.md\n````\n@docs/rules/README.md\n";
    const project = await fixture(old);
    assert.equal(run(project).status, 0);
    assert.ok((await read(project, "AGENTS.md")).includes("````md\n```\n~~~\n@AGENTS.md\n````"));
  });
  await test("AGFIX loss guard refuses missing imports inside code blocks", async () => {
    const { assertPreserved } = await import(script);
    for (const [old, lossy] of [
      ["~~~md\r\n@AGENTS.md\r\n~~~", "~~~md\n~~~"],
      ["```\n@docs/rules/README.md\n```", "```\n```"],
      ["Example:\n\n    @.pandacorp/guide.md", "Example:\n"],
    ]) assert.throws(() => assertPreserved(old, lossy), error => error.code === "CONTENT_LOSS");
    assert.doesNotThrow(() => assertPreserved("@AGENTS.md\r\nOwner note.", "Owner note.\n"));
  });
  await test("second migration is byte-idempotent", async () => {
    const project = await fixture("# Notes\nAn owner rule.\n");
    assert.equal(run(project).status, 0);
    const before = await read(project, "AGENTS.md");
    assert.equal(run(project).json.changed, false);
    assert.equal(await read(project, "AGENTS.md"), before);
  });
  await test("dry run lists the move and leaves both files unchanged", async () => {
    const project = await fixture("@AGENTS.md\n## Private project notes\nNever lose me.\n");
    const old = await read(project, "CLAUDE.md"); const before = await read(project, "AGENTS.md");
    const result = run(project, "--dry-run");
    assert.equal(result.status, 0); assert.equal(result.json.dry_run, true);
    assert.deepEqual(result.json.moves, ["CLAUDE.md -> AGENTS.md: ## Project notes"]);
    assert.equal(await read(project, "CLAUDE.md"), old); assert.equal(await read(project, "AGENTS.md"), before);
  });
  await test("CLAUDE.local.md refuses without writing, also in dry run", async () => {
    const project = await fixture("Never lose this.\n");
    await writeFile(path.join(project, "CLAUDE.local.md"), "");
    for (const args of [[], ["--dry-run"]]) {
      const result = run(project, ...args);
      assert.equal(result.status, 3); assert.equal(result.json.code, "LOCAL_OVERRIDE");
      assert.match(result.json.notes_es, /CLAUDE.local.md/);
      assert.equal(await read(project, "CLAUDE.md"), "Never lose this.\n");
      assert.equal(await read(project, "AGENTS.md"), "# Existing project\n\nKeep this rule.\n");
    }
  });
  await test("creates AGENTS when migrating a legacy fat CLAUDE", async () => {
    const project = await fixture("Legacy stack: Node.\n", null);
    assert.equal(run(project).status, 0);
    assert.match(await read(project, "AGENTS.md"), /## Project notes\n\nLegacy stack: Node\./);
  });
  await test("an existing Project notes section is extended once before the next heading", async () => {
    const project = await fixture("A new rule.\n", "# Project\n\n## Project notes\n\nOld rule.\n\n## Appendix\n\nAppendix text.\n");
    assert.equal(run(project).status, 0);
    const agents = await read(project, "AGENTS.md");
    assert.equal(agents.match(/^## Project notes$/gm).length, 1);
    assert.ok(agents.indexOf("A new rule.") < agents.indexOf("## Appendix"));
    assert.ok(agents.endsWith("Appendix text.\n"));
  });
  await test("already-preserved block is not duplicated on a partially migrated project", async () => {
    const project = await fixture("@AGENTS.md\nKeep me.\n", "# Project\n\n## Project notes\n\nKeep me.\n");
    const before = await read(project, "AGENTS.md");
    assert.equal(run(project).status, 0); assert.equal(await read(project, "AGENTS.md"), before);
  });
  await test("CRLF, Unicode, import-shaped prose and absent final newline survive", async () => {
    const text = "# Café\r\nPreserve @AGENTS.md in prose.\r\n@docs/owner.md\r\nÚltima regla";
    const project = await fixture(text);
    assert.equal(run(project).status, 0);
    const agents = await read(project, "AGENTS.md");
    for (const line of text.split(/\r?\n/)) assert.ok(agents.split(/\r?\n/).includes(line));
  });
  await test("a shim needs no Project notes and preserves existing AGENTS bytes", async () => {
    const project = await fixture("@AGENTS.md\n");
    assert.equal(run(project).json.changed, false);
    assert.equal(await read(project, "AGENTS.md"), "# Existing project\n\nKeep this rule.\n");
  });
  await test("missing CLAUDE receives a shim only when AGENTS exists", async () => {
    const project = await fixture(null);
    assert.equal(run(project).status, 0); assert.equal(await read(project, "CLAUDE.md"), "@AGENTS.md\n");
    const empty = await fixture(null, null);
    assert.equal(run(empty).status, 3); assert.deepEqual(await readdir(empty), []);
  });
  await test("symlinked instruction files and local overrides refuse without following them", async () => {
    for (const name of ["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md"]) {
      const project = await fixture(null, null);
      const outside = path.join(scratch, `outside-${name}`);
      await writeFile(outside, "External notes.\n");
      await symlink(outside, path.join(project, name));
      assert.equal(run(project).status, 3);
      assert.equal(await readFile(outside, "utf8"), "External notes.\n");
      assert.ok((await lstat(path.join(project, name))).isSymbolicLink());
    }
  });
  await test("loss guard exits 3 before writing either instruction file", async () => {
    const { migrateInstructions } = await import(script);
    const project = await fixture("Do not drop me.\n");
    // A changed/unreadable destination at final validation must never replace CLAUDE with the shim.
    const realFs = await import("node:fs/promises");
    let reads = 0;
    const fs = { ...realFs, readFile: async (file, ...args) => {
      if (file === path.join(project, "CLAUDE.md") && ++reads > 1) return "New owner rule written concurrently.\n";
      return realFs.readFile(file, ...args);
    } };
    await assert.rejects(migrateInstructions({ project }, { fs }), error => error.code === "SOURCE_CHANGED" && error.exitCode === 3);
    assert.equal(await read(project, "CLAUDE.md"), "Do not drop me.\n");
    assert.equal(await read(project, "AGENTS.md"), "# Existing project\n\nKeep this rule.\n");
  });
  await test("a staged candidate that loses text leaves both originals intact", async () => {
    const { migrateInstructions } = await import(script);
    const project = await fixture("Keep every owner line.\n");
    const realFs = await import("node:fs/promises");
    const fs = { ...realFs, writeFile: async (file, text, options) => realFs.writeFile(file, path.basename(file).startsWith("AGENTS.md.migrate-") ? "# Lost notes\n" : text, options) };
    await assert.rejects(migrateInstructions({ project }, { fs }), error => error.code === "CONTENT_LOSS" && error.exitCode === 3);
    assert.equal(await read(project, "CLAUDE.md"), "Keep every owner line.\n");
    assert.equal(await read(project, "AGENTS.md"), "# Existing project\n\nKeep this rule.\n");
    assert.deepEqual((await readdir(project)).sort(), ["AGENTS.md", "CLAUDE.md"]);
  });
  await test("missing-line validation refuses a lossy candidate", async () => {
    const { assertPreserved } = await import(script);
    assert.throws(() => assertPreserved("@AGENTS.md\nOwner policy.\n", "# Project\n"), error => error.code === "CONTENT_LOSS" && error.exitCode === 3);
  });
  await test("root and templates are AGENTS-first with explicit reads and Claude sections", async () => {
    for (const [agentsFile, claudeFile, reads] of [
      ["AGENTS.md", "CLAUDE.md", ["factory/constitution.md", "factory/standards/agent-portability.md"]],
      ["plugin/templates/shared/AGENTS.md.tpl", "plugin/templates/shared/CLAUDE.md.tpl", ["docs/rules/README.md", ".pandacorp/guide.md"]],
    ]) {
      assert.equal(await readFile(path.join(root, claudeFile), "utf8"), "@AGENTS.md\n");
      const agents = await readFile(path.join(root, agentsFile), "utf8");
      assert.match(agents, /^## Claude Code$/m); assert.match(agents, /^## Read first/m);
      for (const file of reads) { assert.ok(agents.includes(`\`${file}\``)); assert.ok(agents.includes(`@${file}`)); }
      assert.ok(!agents.includes(["pandacorp", "change"].join(":"))); assert.ok(!agents.includes(["Dynamic", "Workflows"].join(" ")));
    }
    assert.match(await readFile(path.join(root, "AGENTS.md"), "utf8"), /^### Plugin maintenance$/m);
    assert.match(await readFile(path.join(root, "plugin/templates/shared/AGENTS.md.tpl"), "utf8"), /Your own project notes go below this line/);
  });
} finally { await rm(scratch, { recursive: true, force: true }); }
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
