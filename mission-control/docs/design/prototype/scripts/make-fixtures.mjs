/**
 * make-fixtures.mjs — writes the privacy-safe fixture factory the Órbita prototype renders from.
 *
 *   node docs/design/prototype/scripts/make-fixtures.mjs            regenerate fixtures/ from fixtures/specs
 *   node docs/design/prototype/scripts/make-fixtures.mjs --vendor   also refresh the vendored public subsets
 *                                                                   (plugin skills/agents, standards, registry)
 *
 * Layout (all under docs/design/prototype/fixtures/):
 *   factory-root/        acts as PANDACORP_FACTORY_ROOT: factory/{portfolio.md,ideas,backlog,memory,services,
 *                        decisions,standards,gamification-ledger.json}, plugin/{skills,agents,templates,.claude-plugin}
 *   projects/<id>/       the five projects, referenced from portfolio.md with relative paths
 *   pandacorp-vault/     the private accounts file the services directory joins (fictional identities)
 *   home/.claude/        installed plugin version and the dashboard event stream
 *   git-state.json       what git would answer (branches, worktrees, last commits, phase history, verified
 *                        dates); git history cannot live inside a fixture folder of the same repository
 *
 * It is also imported by the exporters: `fixtureEnv()` points every reader at the fixture and freezes the
 * clock, so a plain export can never read the owner's real factory.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROTOTYPE_DIR = path.resolve(SCRIPT_DIR, "..");
export const MISSION_CONTROL_ROOT = path.resolve(PROTOTYPE_DIR, "../../..");
export const FIXTURES_DIR = path.join(PROTOTYPE_DIR, "fixtures");
export const FIXTURE_FACTORY_ROOT = path.join(FIXTURES_DIR, "factory-root");
const PROJECTS_DIR = path.join(FIXTURES_DIR, "projects");
const HOME_DIR = path.join(FIXTURES_DIR, "home");
const GIT_STATE = path.join(FIXTURES_DIR, "git-state.json");
/** The capture instant; mirrors CLOCK in fixtures/specs/common.mjs. */
const CLOCK = "2026-10-21T00:20:00.000Z";

/**
 * Resolve where an exporter reads from and writes to. The real factory is opt-in (`MC_REAL=1`) and
 * then writes to the ignored `data-live/`; otherwise only a factory root inside fixtures/ is accepted.
 * @returns {{real: boolean, factoryRoot: string, outputDir: string}}
 */
export function exporterMode() {
  const real = process.env.MC_REAL === "1";
  const requested = process.env.PANDACORP_FACTORY_ROOT?.trim() ? path.resolve(process.env.PANDACORP_FACTORY_ROOT) : null;
  if (real) return { real, factoryRoot: requested ?? path.dirname(MISSION_CONTROL_ROOT), outputDir: path.join(PROTOTYPE_DIR, "data-live") };
  const factoryRoot = requested ?? FIXTURE_FACTORY_ROOT;
  if (!factoryRoot.startsWith(FIXTURES_DIR + path.sep)) {
    throw new Error(`Refusing to export ${factoryRoot} into data/: only fixture roots go there. Use MC_REAL=1 for the real factory (writes data-live/).`);
  }
  return { real, factoryRoot, outputDir: path.join(PROTOTYPE_DIR, "data") };
}

/**
 * Point every reader at the fixture and freeze time: factory root, HOME (installed plugin, events),
 * a git directory that does not exist (so no reader can see the real repository) and a fixed clock.
 * Must run before any app reader module is imported (config.ts resolves paths at import time).
 */
export function fixtureEnv(factoryRoot) {
  process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
  process.env.HOME = HOME_DIR;
  process.env.PANDACORP_EVENTS_FILE = path.join(HOME_DIR, ".claude", "dashboard-events.ndjson");
  process.env.PANDACORP_CODEX_EVENTS_FILE = path.join(HOME_DIR, ".codex", "dashboard-events.ndjson");
  process.env.PANDACORP_ACCOUNTS_FILE = path.join(FIXTURES_DIR, "pandacorp-vault", "services", "accounts.yaml");
  process.env.GIT_DIR = path.join(FIXTURES_DIR, ".no-git");
  process.env.GIT_CEILING_DIRECTORIES = FIXTURES_DIR;
  freezeClock(process.env.MC_CLOCK ?? CLOCK);
}

/** Replace Date so `Date.now()` and `new Date()` return the capture instant (fixture determinism). */
export function freezeClock(isoInstant) {
  const fixed = Date.parse(isoInstant);
  if (!Number.isFinite(fixed)) throw new Error(`MC_CLOCK is not an ISO date: ${isoInstant}`);
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(fixed);
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = FixedDate;
}

/** Re-apply fixed modification times (a fresh checkout stamps files with the checkout time). */
export function stampFixtureTimes() {
  const at = new Date(Date.parse(CLOCK) - 3 * 3_600_000);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else fs.utimesSync(full, at, at);
    }
  };
  walk(FIXTURES_DIR);
}

/** The git facts the fixture stands in for (see git-state.json). */
export function readGitState() {
  return JSON.parse(fs.readFileSync(GIT_STATE, "utf8"));
}

/**
 * A GitRunner (the app's injectable git boundary) that answers from git-state.json for one repo.
 * Unknown commands throw, exactly like a git failure, so readers fall back the same way.
 */
export function fixtureGit(repo) {
  const branches = new Map(repo.branches.map((b) => [b.name, b]));
  const porcelain = [
    `worktree ${repo.root}\nHEAD 0000000000000000000000000000000000000000\nbranch refs/heads/main`,
    ...repo.branches.filter((b) => b.worktree).map((b) => `worktree ${b.worktree}\nHEAD 1111111111111111111111111111111111111111\nbranch refs/heads/${b.name}`),
    ...repo.extraWorktrees.map((w) => `worktree ${w.path}\nHEAD 2222222222222222222222222222222222222222\n${w.detached ? "detached" : ""}${w.locked ? "\nlocked" : ""}`),
  ].join("\n\n");
  return (args, cwd = repo.root) => {
    const cmd = args.join(" ");
    if (cmd === "symbolic-ref --quiet --short refs/remotes/origin/HEAD") return "origin/main";
    if (cmd === "worktree list --porcelain") return porcelain;
    if (cmd === "branch --no-merged main --format=%(refname:short)") return repo.branches.map((b) => b.name).join("\n");
    if (cmd === "status --porcelain" && cwd !== repo.root) {
      const b = repo.branches.find((x) => x.worktree === cwd);
      return b ? Array.from({ length: b.uncommitted }, (_, k) => ` M src/file-${k + 1}.ts`).join("\n") : "";
    }
    if (cmd === "status --porcelain -- plugin") return Array.from({ length: repo.pluginUncommitted ?? 0 }, () => " M plugin/x").join("\n");
    const m = /^(rev-list --count main\.\.|log -1 --format=%ct |log -1 --format=%s |diff --shortstat main\.\.\.)(.+)$/.exec(cmd);
    const b = m && branches.get(m[2]);
    if (b && m[1].startsWith("rev-list")) return String(b.ahead);
    if (b && m[1].includes("%ct")) return String(Math.floor(Date.parse(b.lastCommitAt) / 1000));
    if (b && m[1].includes("%s")) return b.subject;
    if (b && m[1].startsWith("diff")) return ` ${b.filesChanged} files changed, ${b.filesChanged * 9} insertions(+), ${b.filesChanged * 2} deletions(-)`;
    throw new Error(`fixture git: no answer for "git ${cmd}"`);
  };
}

// ----------------------------------------------------------------------------------- writer

async function generate() {
  const common = await import(pathToFileURL(path.join(FIXTURES_DIR, "specs", "common.mjs")).href);
  if (common.CLOCK !== CLOCK) throw new Error("CLOCK differs between make-fixtures.mjs and specs/common.mjs");
  const spec = (name) => import(pathToFileURL(path.join(FIXTURES_DIR, "specs", `${name}.mjs`)).href);
  const { writeProject, orderFacts } = await spec("project-writer");
  const { ideaFiles } = await spec("ideas");
  const factory = await spec("factory");
  const projects = [
    (await spec("mission-control")).missionControl,
    (await spec("pandasaga")).pandasaga,
    (await spec("funko-tracker")).funkoTracker,
    (await spec("pandacast")).pandacast,
    (await spec("personal-page-v2")).personalPageV2,
  ];
  const { write, writeJson } = common;
  const F = (...p) => path.join(FIXTURE_FACTORY_ROOT, ...p);

  // Generated parts are rebuilt from scratch; vendored public subsets are left alone.
  for (const dir of [PROJECTS_DIR, HOME_DIR, path.join(FIXTURES_DIR, "pandacorp-vault"), F("factory", "ideas"), F("factory", "backlog"), F("factory", "memory"), F("factory", "services"), F("plugin", "templates"), F("plugin", ".claude-plugin")]) fs.rmSync(dir, { recursive: true, force: true });
  for (const file of [GIT_STATE, F("factory", "portfolio.md"), F("factory", "profile.md"), F("factory", "gamification-ledger.json")]) fs.rmSync(file, { force: true });

  for (const project of projects) writeProject(path.join(PROJECTS_DIR, project.id), project);
  for (const id of ["funko-tracker", "pandasaga", "personal-page-v2"]) write(path.join(PROJECTS_DIR, id, ".pandacorp", "run", "lessons.md"), `# Lecciones provisionales\n\n${factory.RAW_NOTES.split("\n").slice(0, 12).join("\n")}`);

  const names = { "mission-control": "Pandacorp (Mission Control)", pandasaga: "PandaSaga", "funko-tracker": "Funko Tracker", pandacast: "PandaCast", "personal-page-v2": "PersonalPage v2" };
  const origin = { "mission-control": "mission-control", pandasaga: "book-memory-without-spoilers", "funko-tracker": "funko-tracker", pandacast: "tiktok-crossposter", "personal-page-v2": "personal-page-v2" };
  const phase = { "mission-control": "implementation", pandasaga: "architecture", "funko-tracker": "implementation", pandacast: "architecture", "personal-page-v2": "release" };
  write(F("factory", "portfolio.md"), `# Pandacorp Portfolio

Index of the projects the factory created. Pointers only; each project holds its own detail.

| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |
|---|---|---|---|---|---|---|---|---|
${projects.map((p) => `| ${names[p.id]} | \`../projects/${p.id}/\` | — | ${origin[p.id]} | ${phase[p.id]} | ${p.id === "personal-page-v2" ? "40 visitas/semana" : "—"} | ${p.id === "personal-page-v2" ? "2 contactos al mes" : "—"} | ${p.id === "personal-page-v2" ? "hold" : "—"} | 2026-10-20 |`).join("\n")}`);

  for (const { file, content } of ideaFiles()) write(F("factory", "ideas", file), content);
  write(F("factory", "ideas", "_idea-template.md"), "---\ntitle: \"(Commercial name — short description)\"\nstatus: discovered\n---\n");
  for (const { file, content } of factory.backlogFiles()) write(F("factory", "backlog", file), content);
  for (const { file, content } of factory.lessonFiles()) write(F("factory", "memory", file), content);
  write(F("factory", "memory", "_inbox.md"), `# Bandeja de notas crudas\n\n${factory.RAW_NOTES}`);
  write(F("factory", "memory", "_last-sweep"), "2026-10-19T14:30:00Z");
  write(F("factory", "profile.md"), `---\nname: "Dueña de ejemplo"\ngoals: "Construir productos pequeños con una fábrica de software asistida"\ninterests:\n  - "coleccionismo"\n  - "lectura por temporadas"\nassets:\n  - "una comunidad de coleccionistas"\n---\n\nPerfil ficticio para el prototipo: una persona que opera la fábrica sola y prioriza la velocidad.`);
  write(F("factory", "services", "catalog.yaml"), JSON.stringify(factory.servicesCatalog(), null, 2));
  write(path.join(FIXTURES_DIR, "pandacorp-vault", "services", "accounts.yaml"), JSON.stringify(factory.servicesAccounts(), null, 2));
  writeJson(F("factory", "gamification-ledger.json"), factory.LEDGER);
  write(F("plugin", "templates", "OVERLAY_VERSION"), "8.110.0");
  writeJson(F("plugin", ".claude-plugin", "plugin.json"), { name: "pandacorp", version: "9.141.0", description: "Pandacorp factory skills and agents (fixture)." });
  writeJson(path.join(HOME_DIR, ".claude", "plugins", "installed_plugins.json"), { version: 2, plugins: { "pandacorp@panda-corp": [{ scope: "user", version: "9.140.0" }] } });
  write(path.join(HOME_DIR, ".claude", "dashboard-events.ndjson"), factory.EVENTS);

  const mc = projects[0];
  writeJson(GIT_STATE, {
    note: "Stands in for git: the fixture lives inside this repository, so it cannot carry its own history.",
    repos: factory.gitRepos(),
    lastActivity: factory.LAST_ACTIVITY,
    phaseHistory: Object.fromEntries(Object.entries(factory.PHASE_HISTORY).map(([name, obs]) => [name, obs.map(([date, ph]) => ({ date, phase: ph }))])),
    verifiedAt: Object.fromEntries(orderFacts(mc).filter((o) => o.state === "done" && o.end).map((o) => [o.rel, new Date(o.end).toISOString()])),
  });
  if (!fs.existsSync(F("plugin", "skills")) || !fs.existsSync(F("factory", "standards"))) {
    console.warn("Vendored public subsets are missing: run once with --vendor.");
  }
}

// ----------------------------------------------------------------------------------- vendor
// Public factory content reused verbatim in small subsets; any line naming a private project or
// a real person is dropped so the fixture never repeats more than a project's name.
const PRIVATE_RE = /funko|pandasaga|pandacast|personal-page|personalpage|toshio|sergio|minei|pandadcollector|pandatrack|jobleap|carlos|@gmail|\/Users\//i;
const KNOWN_ROLES = ["security-auditor", "product-manager", "frontend-dev", "backend-dev", "test-writer", "implementer", "researcher", "librarian", "copywriter", "architect", "designer", "analytics", "reviewer", "devops"];
const STANDARDS = ["accessibility.md", "ai-implementation.md", "api-design.md", "auth.md", "background-jobs.md", "debugging.md", "dependency-lifecycle.md", "error-handling.md", "feature-flags.md", "performance.md", "privacy.md", "resilience.md", "seo-i18n.md", "single-source-of-truth.md", "web-security.md", "data-modeling.md", "memory-harvesting.md"];

const clean = (text) => text.split("\n").filter((l) => !PRIVATE_RE.test(l)).join("\n");
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter((s) => !PRIVATE_RE.test(s)).join(" ");

async function vendor() {
  const { createRequire } = await import("node:module");
  const require = createRequire(path.join(MISSION_CONTROL_ROOT, "package.json"));
  const matter = require("gray-matter");
  const YAML = require("yaml");
  const realFactory = path.dirname(MISSION_CONTROL_ROOT);
  const { write } = await import(pathToFileURL(path.join(FIXTURES_DIR, "specs", "common.mjs")).href);
  const F = (...p) => path.join(FIXTURE_FACTORY_ROOT, ...p);
  for (const dir of [F("plugin", "skills"), F("plugin", "agents"), F("factory", "standards"), F("factory", "decisions")]) fs.rmSync(dir, { recursive: true, force: true });

  for (const slug of fs.readdirSync(path.join(realFactory, "plugin", "skills")).sort()) {
    const file = path.join(realFactory, "plugin", "skills", slug, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const { data, content } = matter(fs.readFileSync(file, "utf8"), { excerpt: false });
    const lower = content.toLowerCase();
    const roles = KNOWN_ROLES.map((r) => [r, lower.indexOf(r)]).filter(([, at]) => at >= 0).sort((a, b) => a[1] - b[1]).map(([r]) => r);
    const lead = clean(content.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#") && !p.trim().startsWith(">") && p.length > 60) ?? "");
    const text = `${data.description} ${content}`;
    const inFactory = /\b(from the factory|in the factory|in panda-corp|factory context|runs in the factory|run from the factory)\b/i.test(text);
    const inProject = /\b(inside the project|in the project|inside a project)\b/i.test(text);
    const where = inFactory && !inProject ? "Runs in the factory." : inProject && !inFactory ? "Runs inside the project." : "";
    const fm = { name: data.name ?? slug, description: sentences(String(data.description ?? "")), ...(data["user-invocable"] === false ? { "user-invocable": false } : {}) };
    write(F("plugin", "skills", slug, "SKILL.md"), `---\n${YAML.stringify(fm).trim()}\n---\n\n# /pandacorp:${slug}\n\n${lead.trim()}\n\n${where}\n\n${roles.length ? `## Team\n\n${roles.map((r) => `- ${r}`).join("\n")}` : ""}`);
  }
  for (const name of fs.readdirSync(path.join(realFactory, "plugin", "agents")).filter((f) => f.endsWith(".md")).sort()) {
    const { data, content } = matter(fs.readFileSync(path.join(realFactory, "plugin", "agents", name), "utf8"), { excerpt: false });
    const fm = Object.fromEntries(["name", "description", "model", "effort", "tools"].filter((k) => data[k] !== undefined).map((k) => [k, k === "description" ? sentences(String(data[k])) : data[k]]));
    const body = clean(content).split(/\n\s*\n/).filter((p) => p.trim()).slice(0, 4).join("\n\n");
    write(F("plugin", "agents", name), `---\n${YAML.stringify(fm).trim()}\n---\n\n${body}`);
  }
  for (const name of STANDARDS) {
    const file = path.join(realFactory, "factory", "standards", name);
    if (fs.existsSync(file)) write(F("factory", "standards", name), clean(fs.readFileSync(file, "utf8")));
  }
  const registry = YAML.parse(fs.readFileSync(path.join(realFactory, "factory", "decisions", "registry.yaml"), "utf8"));
  const rules = registry.decisiones.filter((r) => !PRIVATE_RE.test(JSON.stringify(r))).slice(0, 48);
  write(F("factory", "decisions", "registry.yaml"), `# Pandacorp decision registry (public subset for the prototype fixture).\n${YAML.stringify({ decisiones: rules }, { lineWidth: 0 })}`);
  console.log(`Vendored ${rules.length} decision rules, ${STANDARDS.length} standards and the plugin catalog.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--vendor")) await vendor();
  await generate();
  stampFixtureTimes();
  console.log(`Fixtures written to ${path.relative(process.cwd(), FIXTURES_DIR)}`);
}
