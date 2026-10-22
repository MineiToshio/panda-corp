/**
 * export-extras.mjs — read-only export of the "extras" areas for the visual-refresh study.
 *
 * Purpose: feed the static prototype through Mission Control's own readers
 * (backlog, memory/proposals, configuration, achievements/guild) without touching the app,
 * the factory files, the network or any secret. Writes ONLY `extras.js` in its output folder.
 *
 * Default: the privacy-safe fixture factory (make-fixtures.mjs), frozen clock, output data/extras.js.
 * MC_REAL=1: the owner's real factory, output to the ignored data-live/.
 *
 * Run from the mission-control directory:
 *   node --loader ./scripts/read-model/ts-loader.mjs \
 *     docs/design/prototype/scripts/export-extras.mjs
 *
 * Output: `window.MC_EXTRAS = { capturedAt, backlog, memory, config, guild, health };`
 *   backlog { items[{id,title,status,priority,type,area,date,closed,source,html}], counts{...}, errors[] }
 *   memory  { health{...}, counts{...}, streams[{key,label,items[{id,title,summary,status,html?,...}]}], errors[] }
 *   config  { skills[], agents[], rules[], standards[], errors[] }
 *   guild   { level, rankName, xp, nextLevelXp, levelStartXp, pctToNext, trophies[], secrets[],
 *             missions[], seals[], ranks[], stats{...}, errors[] }
 * Every section catches its reader failures and reports them in `errors` (never silently empty).
 */
import fs from "node:fs";
import { register } from "node:module";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import matter from "gray-matter";
import { exporterMode, fixtureEnv, fixtureGit, MISSION_CONTROL_ROOT, readGitState, stampFixtureTimes } from "./make-fixtures.mjs";

const MODE = exporterMode();
const FACTORY_ROOT = MODE.factoryRoot;
const OUTPUT_DIR = MODE.outputDir;

// The shared ts-loader does not add the `type: "json"` import attribute the app's bundler infers
// (e.g. src/lib/events/event-vocabulary.json), so teach Node to load .json imports for this run only.
const JSON_LOAD_HOOK = `
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".json")) {
    return { format: "json", source: readFileSync(fileURLToPath(url), "utf8"), shortCircuit: true };
  }
  return nextLoad(url, context);
}`;
register(`data:text/javascript,${encodeURIComponent(JSON_LOAD_HOOK)}`);

// The readers resolve the factory root from this env var (or cwd/..); pin it before they load. The
// fixture also gets its own HOME, events file, accounts file, a dead git directory and a frozen clock.
if (MODE.real) process.env.PANDACORP_FACTORY_ROOT = FACTORY_ROOT;
else {
  fixtureEnv(FACTORY_ROOT);
  stampFixtureTimes();
}
const GIT_STATE = MODE.real ? null : readGitState();

/** Portfolio projects as {id, name, root}; the id is the folder name the prototype routes by. */
async function portfolioProjects() {
  const { readPortfolio } = await import("@/lib/portfolio/portfolio");
  const { resolveProjectPath } = await import("@/lib/config/config");
  return readPortfolio().map((entry) => {
    const root = resolveProjectPath(entry.path);
    return { id: path.basename(root), name: entry.name, root };
  });
}
const PROJECTS = await portfolioProjects();
/** Mission Control's own project root: the real app, or its fixture stand-in. */
const MC_PROJECT_ROOT = MODE.real ? MISSION_CONTROL_ROOT : (PROJECTS.find((p) => p.id === "mission-control")?.root ?? MISSION_CONTROL_ROOT);

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function internalDocLink({ href, children, ...props }) {
  if (typeof href === "string" && !/^(?:[a-z]+:|#|\/\/)/i.test(href)) {
    const relPath = href.replace(/^\.\//, "").split("#", 1)[0];
    return React.createElement(
      "a",
      { ...props, href: `#doc:${encodeURIComponent(relPath)}`, "data-doc-rel-path": relPath },
      children,
    );
  }
  return React.createElement("a", { ...props, href }, children);
}

function renderMarkdown(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return "";
  const frontmatter = markdown.match(/^(?:﻿)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const body = frontmatter == null ? markdown : markdown.slice(frontmatter[0].length);
  const metadata =
    frontmatter?.[1] == null
      ? ""
      : `<details class="document-meta"><summary>Metadatos del documento</summary><pre>${escapeHtml(frontmatter[1])}</pre></details>`;
  const renderedBody = renderToStaticMarkup(
    React.createElement(
      Markdown,
      { remarkPlugins: [remarkGfm], skipHtml: true, components: { a: internalDocLink } },
      body,
    ),
  );
  return `${metadata}${renderedBody}`;
}

/** Run a section builder; on failure return the fallback plus a clear error message. */
async function section(label, fallback, build) {
  try {
    return await build();
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ...fallback, errors: [`${label} failed: ${message}`] };
  }
}

function countBy(items, pick) {
  const out = {};
  for (const item of items) {
    const key = pick(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Read the frontmatter of a plugin file (read-only); null when unreadable. */
function readFrontmatter(filePath) {
  try {
    return matter(fs.readFileSync(filePath, "utf8"), { excerpt: false }).data ?? {};
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backlog
// ---------------------------------------------------------------------------
async function buildBacklog() {
  const { readBacklog } = await import("@/lib/backlog/backlog");
  const result = readBacklog();
  const items = result.items.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    priority: item.severity,
    type: item.type,
    area: item.area,
    date: item.opened || null,
    closed: item.closed,
    source: item.source,
    closes: item.closes,
    links: item.links,
    html: renderMarkdown(item.body),
  }));
  return {
    items,
    counts: {
      total: items.length,
      byStatus: countBy(items, (item) => item.status),
      byPriority: countBy(items, (item) => item.priority ?? "none"),
      byType: countBy(items, (item) => item.type),
    },
    errors: result.errors.map((error) => `${error.file}: ${error.reason}`),
  };
}

// ---------------------------------------------------------------------------
// Memory / proposals
// ---------------------------------------------------------------------------
function lessonItem(lesson) {
  return {
    id: lesson.id,
    title: lesson.context,
    summary: lesson.trigger || null,
    status: lesson.status,
    promotion: lesson.promotion,
    evalGate: lesson.evalGate,
    domain: lesson.domain,
    type: lesson.type,
    projects: lesson.projects,
    appliedIn: lesson.appliedIn,
    html: renderMarkdown(lesson.body),
  };
}

async function buildMemory() {
  const errors = [];
  const { candidateLessons, promotionQueue, prunable, readLessons } = await import(
    "@/lib/memory/memory"
  );
  const { memoryHealth } = await import("@/lib/memory/memory-health");
  const { countOpenProposals } = await import("@/lib/proposals/proposals");

  const health = memoryHealth();
  const candidates = candidateLessons().map(lessonItem);
  const pruneList = prunable().map(lessonItem);
  const promotions = promotionQueue().map(lessonItem);
  const allLessons = readLessons();

  let suggestions = [];
  try {
    const { gatherSuggestionsInput } = await import("@/lib/self-suggest/gather");
    const { computeSuggestions } = await import("@/lib/self-suggest/self-suggest");
    suggestions = computeSuggestions(gatherSuggestionsInput()).map((suggestion, index) => ({
      id: `${suggestion.kind}-${suggestion.target ?? index}`,
      title: suggestion.title,
      summary: suggestion.evidence,
      status: suggestion.severity,
      kind: suggestion.kind,
      command: suggestion.command,
      target: suggestion.target ?? null,
    }));
  } catch (error) {
    errors.push(
      `self-suggestions failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    health,
    counts: {
      lessons: allLessons.length,
      byStatus: countBy(allLessons, (lesson) => lesson.status),
      open: countOpenProposals(),
      suggestions: suggestions.length,
    },
    streams: [
      { key: "candidates", label: "Lecciones candidatas", items: candidates },
      { key: "prune", label: "Lecciones obsoletas", items: pruneList },
      { key: "promotions", label: "Promociones", items: promotions },
      { key: "suggestions", label: "Auto-sugerencias", items: suggestions },
    ],
    errors,
  };
}

// ---------------------------------------------------------------------------
// Configuration: skills, agents, decision rules, standards
// ---------------------------------------------------------------------------
async function buildConfig() {
  const errors = [];
  const { readSkills, readAgents } = await import("@/lib/reference/reference");
  const { readDecisionRules } = await import("@/lib/registry/registry");
  const { readStandards } = await import("@/lib/standards/standards");

  const skills = readSkills().map((skill) => {
    const fm = readFrontmatter(path.join(FACTORY_ROOT, "plugin", "skills", skill.slug, "SKILL.md"));
    if (fm === null) errors.push(`skill ${skill.slug}: frontmatter unreadable for user-invocable`);
    return {
      slug: skill.slug,
      name: `/pandacorp:${skill.slug}`,
      description: skill.description,
      userInvocable: fm === null ? null : fm["user-invocable"] !== false,
      scope: skill.runsIn,
      internal: skill.internal ?? false,
      produces: skill.produces ?? null,
      agents: skill.agents ?? [],
      html: renderMarkdown(skill.body),
    };
  });

  const agents = readAgents().map((agent) => {
    const fm = readFrontmatter(path.join(FACTORY_ROOT, "plugin", "agents", `${agent.id}.md`));
    const rawTools = fm?.tools;
    const tools = Array.isArray(rawTools)
      ? rawTools.map(String)
      : typeof rawTools === "string"
        ? rawTools.split(",").map((tool) => tool.trim()).filter(Boolean)
        : null;
    return {
      id: agent.id,
      name: agent.name ?? agent.id,
      description: agent.description ?? "",
      model: agent.model,
      effort: typeof fm?.effort === "string" ? fm.effort : null,
      tools,
      html: renderMarkdown(agent.body),
    };
  });

  const ruleList = readDecisionRules();
  if (ruleList.length === 0) errors.push("decision rules: reader returned 0 rules (file missing or unparseable)");
  const rules = ruleList.map((rule) => ({
    id: rule.id,
    title: rule.patron,
    domain: null,
    default: rule.default,
    approval: rule.requiereHumano ? "human" : "auto",
    summary: rule.nota ?? null,
  }));

  const standards = readStandards().map((standard) => ({
    id: standard.id,
    title: standard.title,
    domain: standard.domain,
    severity: standard.severity,
    enforcement: standard.enforcement,
    summary: standard.summary,
    html: renderMarkdown(standard.body),
  }));

  if (skills.length === 0) errors.push("skills: reader returned 0 skills");
  if (agents.length === 0) errors.push("agents: reader returned 0 agents");
  if (standards.length === 0) errors.push("standards: reader returned 0 standards");

  return { skills, agents, rules, standards, errors };
}

/**
 * The git-backed Informe readers. The real factory runs the app's own git readers; the fixture feeds
 * the same pure derivations (verified series, phase transitions, scalars) from git-state.json, because
 * a fixture folder inside this repository cannot carry its own git history.
 */
async function informeReaders() {
  const flow = await import("@/lib/achievements/report/flowSeries");
  const transitions = await import("@/lib/achievements/report/phaseTransitions");
  const scalars = await import("@/lib/achievements/report/scalars");
  if (MODE.real) {
    return { weeklyFlow: () => flow.weeklyFlow(MC_PROJECT_ROOT), phaseTransitions: () => transitions.phaseTransitions(), scalars: () => scalars.reportScalars(MC_PROJECT_ROOT) };
  }
  const { readProjectDocs } = await import("@/lib/docs/docs");
  const { readDecisionRules } = await import("@/lib/registry/registry");
  const { readPortfolio } = await import("@/lib/portfolio/portfolio");
  const { listWorkOrders } = await import("@/lib/work-orders/work-orders");
  const verifiedAt = listWorkOrders(MC_PROJECT_ROOT).map((order) => GIT_STATE.verifiedAt[order.relPath] ?? null);
  return {
    weeklyFlow: () => {
      const wo = flow.deriveWoVerifiedSeries(verifiedAt);
      if (!wo.ok) return wo;
      const ideas = flow.ideasSeries();
      return ideas.ok ? { ok: true, value: flow.composeWeeklyFlow(wo.value, ideas.value) } : ideas;
    },
    phaseTransitions: () => transitions.derivePhaseTransitions(GIT_STATE.phaseHistory),
    scalars: () =>
      scalars.deriveScalars({
        frds: readProjectDocs(MC_PROJECT_ROOT).frds.length,
        commits: GIT_STATE.repos.factory.commits,
        decisions: readDecisionRules().length,
        projects: readPortfolio().length,
        testsPassing: null,
      }),
  };
}

// ---------------------------------------------------------------------------
// Guild: level, ranks, trophies, missions, stats (mirrors app/achievements/page.tsx)
// ---------------------------------------------------------------------------
async function buildGuild() {
  const errors = [];
  const { readGuildState } = await import("@/lib/gamification/guildState");
  const { RANKS, xpForLevel, rankForLevel } = await import("@/lib/gamification/gamification");
  const { durableEvents, readLedger } = await import("@/lib/gamification/ledger");
  const { readEvents } = await import("@/lib/events/events");
  const { readIdeas } = await import("@/lib/ideas/ideas");
  const { computeChains, computeSecrets, computeSeals, computeUniques } = await import(
    "@/lib/achievements/achievements"
  );
  const { computeStats } = await import("@/lib/achievements/stats");
  const { CHAIN_DEFINITIONS } = await import("@/lib/achievements/definitions");
  const { signalsFor } = await import("@/lib/achievements/signals");

  // readGuildState is the uncached core of getGuildState (React cache needs a request scope).
  const { statuses, level: guildLevel, outcomes, liveOutcomes } = readGuildState();
  const readerData = {
    ideas: readIdeas(),
    statuses,
    eventsSnapshot: readEvents({ cap: 100_000 }),
    durableEvents: durableEvents(readLedger()),
    workOrdersDoneLive: outcomes.workOrdersDone,
  };

  const statsRows = computeStats(readerData);
  const chains = computeChains(statsRows);
  const uniques = computeUniques(readerData, Date.now());
  const secrets = computeSecrets(readerData);
  const seals = computeSeals(uniques);

  const currentRankIndex = guildLevel.rankIndex ?? rankForLevel(guildLevel.level);
  const ranks = RANKS.map((rank, index) => {
    const nextRank = RANKS[index + 1];
    return {
      name: rank.title,
      nameEn: rank.titleEn,
      icon: rank.icon,
      sprite: rank.sprite,
      grade: rank.grade,
      minLevel: rank.minLevel,
      maxLevel: nextRank ? nextRank.minLevel - 1 : null,
      xp: xpForLevel(rank.minLevel),
      attained: index <= currentRankIndex,
      current: index === currentRankIndex,
    };
  });

  const chainDefs = new Map(CHAIN_DEFINITIONS.map((def) => [def.statKey, def]));
  const missions = chains.map((chain) => {
    const def = chainDefs.get(chain.statKey);
    return {
      id: chain.statKey,
      title: chain.label,
      saga: chain.saga ?? null,
      value: chain.value ?? 0,
      lowerIsBetter: chain.lowerIsBetter,
      currentTierIndex: chain.currentTierIndex,
      currentTierName: chain.currentTierName,
      nextTier: chain.nextTier,
      pctToNext: chain.pctToNext,
      tiers: (def?.tiers ?? []).map((tier, index) => ({
        name: tier.name,
        threshold: tier.threshold,
        reached: index <= chain.currentTierIndex,
      })),
      unlocks: chain.unlocks,
    };
  });

  const trophies = uniques.map((unique) => ({
    id: unique.name,
    title: unique.name,
    description: unique.condition,
    category: unique.category,
    rarity: unique.rarity,
    unlocked: unique.unlocked,
    unlockedAt: unique.date ?? null,
    project: unique.project ?? null,
    isNew: unique.isNew === true,
    secret: false,
    progress: null,
  }));
  const secretTrophies = secrets.map((secret, index) => ({
    id: `secret-${index + 1}`,
    title: secret.unlocked ? (secret.criterion ?? secret.hint) : "Secreto",
    description: secret.hint,
    category: "Secret",
    rarity: null,
    unlocked: secret.unlocked,
    unlockedAt: secret.date ?? null,
    project: secret.project ?? null,
    isNew: false,
    secret: true,
    progress: null,
  }));

  // Cheap summary numbers; the signals layer is pure, the scalars shell out to git only on demand.
  const signals = signalsFor(readerData);
  const stats = {
    rows: statsRows.map((row) => ({ key: row.key, label: row.label, value: row.value })),
    outcomes,
    liveOutcomes,
    signals: Object.fromEntries(
      Object.entries(signals).filter(([, value]) => typeof value === "number"),
    ),
    trophiesUnlocked: uniques.filter((unique) => unique.unlocked).length,
    trophiesTotal: uniques.length,
    secretsUnlocked: secrets.filter((secret) => secret.unlocked).length,
    secretsTotal: secrets.length,
    missionsActive: chains.filter((chain) => chain.nextTier !== null).length,
    tiersReached: chains.reduce((sum, chain) => sum + (chain.currentTierIndex + 1), 0),
    scalars: null,
    lessons: null,
  };
  try {
    stats.scalars = (await informeReaders()).scalars();
  } catch (error) {
    errors.push(`report scalars failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const { lessonCounts } = await import("@/lib/achievements/report/lessons");
    stats.lessons = lessonCounts();
  } catch (error) {
    errors.push(`lesson counts failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  // The Estadísticas report, assembled exactly as the app's /achievements page does: the FRD-23
  // aggregate first, falling back to the live readers (git-backed series included) per field.
  stats.informe = null;
  try {
    const { STATS_AGGREGATE_FILENAME } = await import("@/lib/achievements/read-model/aggregate");
    const { resolvePortadaFromAggregate } = await import("@/lib/achievements/read-model/aggregateConsumer");
    const { readStatsFactory } = await import("@/lib/achievements/read-model/factoryStoreReader");
    const { resolveInformeSources } = await import("@/lib/achievements/read-model/informeResolver");
    const { readStatsAggregate } = await import("@/lib/achievements/read-model/statsReader");
    const { ideasSeries } = await import("@/lib/achievements/report/flowSeries");
    const { funnelAndFlow } = await import("@/lib/achievements/report/funnel");
    const { lessonCounts } = await import("@/lib/achievements/report/lessons");
    const { usageMix } = await import("@/lib/achievements/report/usage");
    const { buildInformeData } = await import("@/app/achievements/Informe/informeData");
    const { metricLevel } = await import("@/lib/achievements/achievements");
    const live = await informeReaders();
    const portada = resolvePortadaFromAggregate(
      readStatsAggregate(path.join(FACTORY_ROOT, ".pandacorp", STATS_AGGREGATE_FILENAME)),
      "mission-control",
      MC_PROJECT_ROOT,
    );
    const sources = resolveInformeSources(
      portada,
      {
        weeklyFlow: live.weeklyFlow,
        ideasSeries: () => ideasSeries(),
        phaseTransitions: live.phaseTransitions,
        scalars: live.scalars,
        lessons: () => lessonCounts(),
        funnel: () => funnelAndFlow(readerData.ideas, statuses),
      },
      readStatsFactory(FACTORY_ROOT),
    );
    const ev = readerData.eventsSnapshot;
    const usage = ev.events.length === 0 && ev.lastEventAt === null
      ? { ok: false, reason: "git-unavailable" }
      : { ok: true, value: usageMix(readerData) };
    const informe = buildInformeData({
      weeklyFlow: sources.weeklyFlow,
      usage,
      funnel: sources.funnel,
      transitions: sources.phaseTransitions,
      statuses,
      lessons: sources.lessons,
      relaunches: signals.relaunches,
    });
    // Radar axes and per-metric levels, with the StatsPanel's own formulas.
    const val = (key) => statsRows.find((row) => row.key === key)?.value ?? 0;
    const speed = val("speed");
    stats.radar = {
      produccion: Math.min(100, val("shipped") * 20),
      velocidad: Math.min(100, speed > 0 ? Math.round(100 - (speed / 30) * 100) : 0),
      calidad: Math.min(100, val("flawless") * 33),
      constancia: Math.min(100, val("streak") * 10),
      ideacion: Math.min(100, val("ideas") * 10),
      alcance: Math.min(100, chains.filter((chain) => chain.currentTierIndex >= 0).length * 8),
    };
    stats.levels = Object.fromEntries(statsRows.map((row) => [row.key, metricLevel(row.key, row.value)]));
    stats.records = {
      peakWeek: informe.weeklyFlow.ok ? informe.weeklyFlow.value.peakWeek : 0,
      capturedLessons: sources.lessons?.captured ?? 0,
      subagents: signals.subagents ?? 0,
    };
    stats.informe = informe;
  } catch (error) {
    errors.push(`informe failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const nextLevelXp = guildLevel.next;
  return {
    level: guildLevel.level,
    rankName: guildLevel.title,
    rankNameEn: guildLevel.titleEn ?? null,
    rankIndex: currentRankIndex,
    rankGrade: guildLevel.grade ?? null,
    xp: guildLevel.xp,
    nextLevelXp,
    levelStartXp: xpForLevel(guildLevel.level),
    pctToNext: guildLevel.pctToNext,
    trophies: [...trophies, ...secretTrophies],
    missions,
    seals: seals.map((seal) => ({
      axis: seal.axis,
      name: seal.name,
      unlocked: seal.unlocked,
      earned: seal.earned,
      total: seal.total,
    })),
    ranks,
    stats,
    errors,
  };
}

/**
 * Factory health, through the app's own readers: plugin version drift (FRD-15, version-based),
 * pending un-merged work per repo (FRD-21, worktrees + unmerged branches) and each project's
 * last commit time (used to order the project list by recency). Read-only git and file reads.
 */
async function buildHealth() {
  const os = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const { readInstalledVersion, readPluginSourceVersion } = await import("@/lib/plugin-sync/plugin-sync");
  const { readPending } = await import("@/lib/pendingMerge/pendingMerge");
  const insideFactory = (root) => !path.relative(FACTORY_ROOT, root).startsWith("..");
  // Real: the factory repo plus every project repo outside it. Fixture: the repos git-state.json describes.
  const repos = MODE.real
    ? [{ id: "factory", name: "Fábrica (panda-corp)", root: FACTORY_ROOT }, ...PROJECTS.filter((p) => !insideFactory(p.root))]
    : Object.entries(GIT_STATE.repos).map(([id, repo]) => ({ id, name: repo.name, root: repo.root, fixture: repo }));
  /** A git runner per repo with the app's GitRunner shape plus an optional cwd (worktrees). */
  const gitFor = (r) =>
    MODE.real
      ? (args, cwd = r.root) => execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10000 }).trim()
      : fixtureGit(r.fixture);
  const errors = [];
  const installed = readInstalledVersion(path.join(os.homedir(), ".claude"));
  const source = readPluginSourceVersion(FACTORY_ROOT);
  const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
  let uncommitted = null;
  try { uncommitted = gitFor(repos[0])(["status", "--porcelain", "--", "plugin"]).split("\n").filter(Boolean).length; } catch (e) { errors.push(`plugin status: ${e.message}`); }
  const plugin = { installed, source, behind: installed && source ? cmp(installed, source) < 0 : null, uncommitted };
  const pending = repos.map(r => {
    const git = gitFor(r);
    const res = readPending(r.root, Date.now(), (args) => git(args));
    // The label is relative to the repo's parent so the card stays short; the command keeps the absolute path.
    const items = res.kind === "ok" ? res.items.map(i => {
      const extra = { worktreeLabel: i.worktree ? path.relative(path.dirname(r.root), i.worktree) : null, subject: null, uncommitted: null, filesChanged: null };
      try { extra.subject = git(["log", "-1", "--format=%s", i.branch]) || null; } catch { /* keep null: shown as unknown */ }
      try { const stat = git(["diff", "--shortstat", `main...${i.branch}`]); extra.filesChanged = Number((stat.match(/(\d+) files? changed/) || [0, 0])[1]); } catch { /* unknown */ }
      if (i.worktree) { try { extra.uncommitted = git(["status", "--porcelain"], i.worktree).split("\n").filter(Boolean).length; } catch { /* unknown */ } }
      return { ...i, ...extra };
    }) : [];
    // Every extra worktree (beyond the main checkout), including leftovers whose work is already merged:
    // the pending reader skips those, but they are what a cleanup would remove. Locked ones are reported apart.
    let worktrees = null;
    try {
      const blocks = git(["worktree", "list", "--porcelain"]).split(/\n\n+/).filter(Boolean).slice(1);
      worktrees = { total: blocks.length, locked: blocks.filter(b => /^locked/m.test(b)).length, detached: blocks.filter(b => /^detached/m.test(b)).length };
    } catch (e) { errors.push(`${r.id} worktree list: ${e.message}`); }
    return { id: r.id, name: r.name, kind: res.kind, reason: res.kind === "error" ? res.reason : null, items, worktrees };
  });
  let lastActivity = {};
  if (MODE.real) {
    const factoryGit = gitFor(repos[0]);
    for (const p of PROJECTS) {
      try {
        lastActivity[p.id] = (insideFactory(p.root) ? factoryGit(["log", "-1", "--format=%cI", "--", path.relative(FACTORY_ROOT, p.root)]) : gitFor(p)(["log", "-1", "--format=%cI"])) || null;
      } catch (e) { lastActivity[p.id] = null; errors.push(`${p.id} last commit: ${e.message}`); }
    }
  } else lastActivity = { ...GIT_STATE.lastActivity };
  // Owner-facing context for each decision block ("Qué necesito de ti", context, file status), keyed by
  // date + title so the study can explain each pending decision; ids still come from the app's reader.
  const decisionDetails = {};
  for (const r of PROJECTS) {
    const file = path.join(r.root, ".pandacorp", "inbox", "decisions.md");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    decisionDetails[r.id] = text.split(/\n(?=## )/).filter(b => /^## \d{4}-\d{2}-\d{2}/.test(b)).map(block => {
      const heading = block.split("\n", 1)[0].replace(/^##\s+/, "");
      const field = re => { const m = block.match(re); return m ? m[1].replace(/\s+/g, " ").trim() : null; };
      return {
        date: heading.slice(0, 10),
        heading,
        ask: field(/\*\*(?:Qué necesito de ti[^*]*|Qué decidir):\*\*\s*([\s\S]*?)(?:\n\s*\n|$)/),
        context: field(/\*\*Contexto[^*]*:\*\*\s*([\s\S]*?)(?:\n\s*\n|$)/),
        fileStatus: /\*\*Estado:\*\*\s*\W*\s*(RESUELTO|OBSOLETO)/i.test(block) ? (block.match(/\*\*Estado:\*\*\s*\W*\s*(RESUELTO|OBSOLETO)[^\n]*/i)[0].replace(/\*\*/g, "")) : null,
      };
    });
  }
  return { plugin, pending, lastActivity, decisionDetails, staleHours: Number(process.env.PANDACORP_STALE_HOURS ?? 3), errors };
}

const [backlog, memory, config, guild] = await Promise.all([
  section("backlog", { items: [], counts: {} }, buildBacklog),
  section("memory", { health: null, counts: {}, streams: [] }, buildMemory),
  section("config", { skills: [], agents: [], rules: [], standards: [] }, buildConfig),
  section(
    "guild",
    { level: null, rankName: null, xp: null, trophies: [], missions: [], ranks: [], stats: {} },
    buildGuild,
  ),
]);
const health = await section("health", { plugin: null, pending: [], lastActivity: {} }, buildHealth);

const extras = { capturedAt: new Date().toISOString(), backlog, memory, config, guild, health };

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const json = JSON.stringify(extras)
  .replaceAll("<", "\\u003c")
  .replaceAll(" ", "\\u2028")
  .replaceAll(" ", "\\u2029");
fs.writeFileSync(path.join(OUTPUT_DIR, "extras.js"), `window.MC_EXTRAS = ${json};\n`, "utf8");

console.log(
  JSON.stringify({
    backlog: { items: backlog.items.length, errors: backlog.errors?.length ?? 0 },
    memory: {
      streams: memory.streams.map((stream) => `${stream.key}:${stream.items.length}`),
      errors: memory.errors?.length ?? 0,
    },
    config: {
      skills: config.skills.length,
      agents: config.agents.length,
      rules: config.rules.length,
      standards: config.standards.length,
      errors: config.errors?.length ?? 0,
    },
    guild: {
      level: guild.level,
      trophies: guild.trophies.length,
      missions: guild.missions.length,
      ranks: guild.ranks.length,
      errors: guild.errors?.length ?? 0,
    },
  }),
);
