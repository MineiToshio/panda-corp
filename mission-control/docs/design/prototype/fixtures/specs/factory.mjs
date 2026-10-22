// Factory-level fixture stores: backlog, memory lessons and raw notes, the services catalog and
// private accounts, the guild ledger and event stream, plugin versions and the git facts
// (branches, worktrees, phase history, verified dates) that the real factory would read from git.
import { CLOCK_MS, frontmatter, iso, pad, pickFor } from "./common.mjs";

const H = 3_600_000;
const ago = (hours) => CLOCK_MS - hours * H;

// ---------------------------------------------------------------- backlog
const BACKLOG = [
  ["bug", "build-engine", "open", "p0", "Gate retries hide a red test when the second run is flaky", "2026-10-14", "A flaky e2e test passes on the retry and the gate reports green, so the red first run is lost."],
  ["change", "hooks", "open", "p0", "Run the dangerous-command gate under every runtime", "2026-10-10", "The command gate only fires under one runtime; the others rely on instructions alone."],
  ["bug", "build-engine", "doing", "p1", "Cross-FRD dependencies declared in prose are ignored", "2026-10-17", "A work order that names its upstream only in the body is scheduled too early and stalls the wave."],
  ["change", "plugin-skill", "open", "p1", "The change skill should show the derived rigor before filing", "2026-10-12", "The owner only sees the rigor level after the card is written."],
  ["bug", "templates", "open", "p1", "New projects start without a phone layout baseline", "2026-10-11", "The responsive gate has nothing to compare against on the first build."],
  ["change", "mission-control", "open", "p1", "Show the decision id next to each pending decision", "2026-10-09", "The owner copies the command but cannot see which decision it targets."],
  ["bug", "plugin-hooks", "open", "p1", "The lesson-capture reminder fires twice after compaction", "2026-10-08", "Both the stop hook and the compaction hook ask for the same lessons."],
  ["change", "standards", "open", "p2", "Document the honest-cache pattern with one worked example", "2026-10-06", "Reviewers keep asking what a valid stored derived value looks like."],
  ["bug", "plugin-agent", "open", "p2", "The reviewer skips the phone viewport on narrow FRDs", "2026-10-05", "Features with a single screen are only rendered at desktop width."],
  ["change", "plugin", "open", "p2", "Group the skill list by phase in the help output", "2026-10-03", "The flat list of skills is hard to scan."],
  ["change", "build-engine", "open", null, "Record the build mode in every progress entry", "2026-10-02", "The progress log does not say which mode produced each run."],
  ["bug", "build-engine", "done", "p0", "A reverted work order kept its verified status", "2026-09-12", "After a partial revert the board still showed the order as verified."],
  ["bug", "hooks", "done", "p0", "Stop gate blocked on another session's red files", "2026-09-04", "The gate attributed a red test to the wrong session."],
  ["bug", "build-engine", "done", "p1", "Wave planner ignored blocked orders", "2026-09-20", "Blocked orders were rescheduled every wave."],
  ["bug", "templates", "done", "p1", "The verify script skipped the visual gate when no baseline existed", "2026-09-18", "A missing baseline was treated as a pass."],
  ["change", "plugin-skill", "done", "p1", "Architecture asks the owner's decisions before writing documents", "2026-09-16", "Documents were rewritten after late answers."],
  ["bug", "mission-control", "done", "p1", "Dates without time shifted a day in the timeline", "2026-09-09", "Date-only values were parsed as local midnight."],
  ["change", "standards", "done", "p1", "Fail-loud readers in every template", "2026-09-07", "Readers returned empty lists on malformed input."],
  ["bug", "plugin-hooks", "done", "p2", "The worktree warning listed already-merged branches", "2026-09-05", "Merged branches appeared as pending work."],
  ["change", "plugin-agent", "done", "p2", "Builders cite the lessons they applied", "2026-09-03", "Lesson usage could not be counted."],
  ["bug", "build-engine", "done", "p2", "Duplicate backlog ids after a parallel capture", "2026-08-30", "Two sessions filed the same id."],
  ["change", "templates", "done", "p2", "Hydration-safe helper for form e2e tests", "2026-08-26", "Form tests were flaky before hydration."],
  ["bug", "plugin-skill", "done", "p2", "The sync skill rewrote the spec down to the code", "2026-08-22", "A bug was documented as intended behaviour."],
  ["change", "hooks", "done", "p2", "Telemetry on subagent stop", "2026-08-19", "There was no record of how many agents a build used."],
  ["bug", "standards", "done", "p2", "Two standards gave different contrast targets", "2026-08-15", "One file said AA, another AAA."],
  ["change", "build-engine", "done", "p1", "Commit each work order as soon as it is green", "2026-08-12", "Batch commits per wave lost work on a crash."],
  ["bug", "mission-control", "done", "p2", "The plugin banner stayed after updating", "2026-08-08", "The installed version was read from a stale field."],
  ["change", "plugin", "done", "p2", "Validate the plugin manifests in CI", "2026-08-04", "A hand-edited manifest drifted from its source."],
];

export function backlogFiles() {
  return BACKLOG.map(([type, area, status, severity, title, opened, problem], k) => {
    const id = `BL-${pad(k + 1, 4)}`;
    const closedOn = status === "done" ? `2026-${opened.slice(5, 7)}-${pad(Math.min(28, Number(opened.slice(8)) + 4))}` : null;
    return {
      file: `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50).replace(/-$/, "")}.md`,
      content: `${frontmatter([["id", id], ["type", type], ["area", area], ["title", title], ["status", status], ["severity", severity ?? ""], ["opened", opened], ["closed", closedOn], ["source", pickFor(id, ["memory review", "build close-out", "owner report", "consistency sweep"])], ["closes", ""], ["links", k % 3 === 0 ? ["DR-047"] : []]])}

## Problem
${problem}

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.`,
    };
  });
}

// ---------------------------------------------------------------- memory
const LESSONS = [
  ["gotcha", "javascript", "active", "proposed", "Shallow copies of constant catalogs leak mutations to every caller", "returning a constant array of objects from a module"],
  ["pattern", "testing", "active", "proposed", "Test each reader against a real-shaped fixture and a malformed one", "writing a parser for an internal file"],
  ["anti-pattern", "factory-engineering", "active", "none", "Self-review is not evidence that a change works", "about to declare a change done"],
  ["gotcha", "git", "active", "none", "A rebase orphans the recorded green commit", "recording the last green commit after a merge"],
  ["problem-solution", "nextjs", "active", "proposed", "Forms posted before hydration leak their fields into the URL", "adding a client-handled form"],
  ["library-verdict", "markdown", "active", "none", "The markdown front-matter parser caches failed parses", "parsing the same front matter twice in one process"],
  ["pattern", "factory-engineering", "active", "none", "Declare cross-feature dependencies in machine-readable fields", "planning work orders that depend on another feature"],
  ["gotcha", "dates", "active", "proposed", "Never compare ISO timestamps as strings", "finding the most recent of several timestamps"],
  ["pattern", "accessibility", "active", "none", "Dialogs return focus to the control that opened them", "building a modal"],
  ["problem-solution", "css", "active", "none", "Flex children need min-width zero to shrink", "a long label overflows a flex row"],
  ["gotcha", "playwright", "active", "none", "Hard waits hide hydration races", "an e2e test waits a fixed time"],
  ["pattern", "data", "active", "none", "One writer per fact; everything else derives", "two screens show the same count"],
  ["gotcha", "build-engine", "candidate", "none", "Parallel orders that touch the same file need a declared order", "two work orders edit one component"],
  ["problem-solution", "worker", "candidate", "none", "Idle workers should sleep and wake on a queue signal", "a background worker costs money while idle"],
  ["gotcha", "email", "candidate", "none", "Magic links expire before slow mail providers deliver them", "choosing a sign-in link lifetime"],
  ["pattern", "design", "candidate", "none", "Port the approved prototype CSS instead of redrawing", "starting the UI of an approved design"],
  ["gotcha", "images", "candidate", "none", "Hotlinked images need a fallback for licence changes", "showing third-party images"],
  ["problem-solution", "ingestion", "candidate", "none", "Stage catalog loads behind a review queue", "loading third-party data into a public catalog"],
  ["gotcha", "i18n", "candidate", "none", "Locale-prefixed routes need an explicit root redirect", "adding a second language"],
  ["pattern", "seo", "candidate", "none", "Generate social images at build time", "a static site needs share images"],
  ["gotcha", "testing", "candidate", "none", "Snapshot baselines drift when fonts load late", "visual tests flake on text width"],
  ["anti-pattern", "factory-engineering", "candidate", "none", "Fixing another session's red files masks real failures", "the gate is red in files you did not touch"],
  ["problem-solution", "postgres", "candidate", "none", "A job queue in a table is enough below a thousand jobs a day", "choosing a queue for a small app"],
  ["gotcha", "auth", "candidate", "none", "Merging a guest into an account must keep the furthest progress", "converting guest data into an account"],
  ["pattern", "ux", "candidate", "none", "Show the result first in a case study", "writing portfolio case studies"],
  ["gotcha", "ci", "candidate", "none", "A scheduled job in CI can exhaust free minutes", "running an hourly job in CI"],
  ["problem-solution", "export", "candidate", "none", "Split long checklist images into pages", "exporting a list as an image"],
  ["gotcha", "dependencies", "candidate", "none", "Pin exact versions in the lockfile", "adding a new dependency"],
  ["pattern", "observability", "candidate", "none", "Label stale data as stale", "a dependency is down and a cache is shown"],
  ["gotcha", "build-engine", "candidate", "none", "A blocked order must leave the wave, not retry forever", "an order is blocked on the owner"],
  ["gotcha", "graphs", "candidate", "none", "Graphs need a list alternative on phones", "rendering a dependency or relationship graph"],
  ["problem-solution", "search", "candidate", "none", "Normalise accents before matching", "searching user-visible names"],
  ["gotcha", "env", "candidate", "none", "Overlapping env files cause wrong deploys", "a project has several env files"],
  ["pattern", "release", "candidate", "none", "Rehearse the release against a non-mocked boundary", "preparing an owner-attended release"],
  ["gotcha", "forms", "candidate", "none", "Public form keys must exist in every test environment", "a hosted form service is used"],
  ["anti-pattern", "docs", "candidate", "none", "Parallel note files next to code drift from the docs", "writing implementation notes"],
];

const PROJECT_TAGS = ["funko-tracker", "pandasaga", "personal-page-v2", "mission-control"];

export function lessonFiles() {
  return LESSONS.map(([type, domain, status, promotion, context, trigger], k) => {
    const id = `LESSON-${pad(k + 1, 4)}`;
    const projects = status === "active" ? [PROJECT_TAGS[k % 4], PROJECT_TAGS[(k + 1) % 4]] : [PROJECT_TAGS[k % 4]];
    return {
      file: `${id}-${context.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48).replace(/-$/, "")}.md`,
      content: `${frontmatter([["id", id], ["type", type], ["domain", domain], ["tags", [domain, type]], ["context", context], ["trigger", `use this when ${trigger}`], ["source", `${projects.join(", ")} lessons.md`], ["provenance", "agent-inferred"], ["created", `2026-${pad(7 + (k % 4))}-${pad(1 + ((k * 3) % 27))}`], ["status", status], ["promotion", promotion], ["confidence", status === "active" ? "high" : "medium"], ["times_applied", status === "active" ? 1 + (k % 3) : 0], ["applied_in", status === "active" ? projects : []], ["links", []]])}

**Situation:** the problem showed up during a build of ${projects[0]} and cost a repair cycle.

**Lesson:** ${context}.

**Apply next time:** ${trigger.charAt(0).toUpperCase()}${trigger.slice(1)}: apply the lesson before writing the first test.`,
    };
  });
}

export const RAW_NOTES = Array.from({ length: 64 }, (_, k) => `- (${k % 5 === 0 ? "owner-stated" : "agent-inferred"}) ${pickFor(`n${k}`, LESSONS)[4].toLowerCase()} (nota ${k + 1}).`).join("\n");

// ---------------------------------------------------------------- services
const PROVIDERS = [
  ["neon", "Neon", "database", "Managed PostgreSQL database", "base"],
  ["vercel", "Vercel", "hosting", "Web hosting with preview deployments", "base"],
  ["cloudflare", "Cloudflare", "storage", "DNS and object storage", "base"],
  ["resend", "Resend", "email", "Transactional email", "base"],
  ["sentry", "Sentry", "monitoring", "Error tracking", "base"],
  ["github", "GitHub", "ci", "Source hosting and CI", "base"],
  ["railway", "Railway", "hosting", "Small always-on worker hosting", "optional"],
  ["posthog", "PostHog", "analytics", "Product analytics", "optional"],
  ["upstash", "Upstash", "database", "Serverless cache", "optional"],
  ["formspark", "Formspark", "email", "Hosted form submissions", "project_specific"],
];

export function servicesCatalog() {
  return {
    schema_version: 1,
    providers: PROVIDERS.map(([id, name, type, purpose, adoption]) => ({
      id, name, type, purpose, adoption,
      dashboard_url: `https://example.com/dashboards/${id}`,
      reuse_policy: "Reuse the authorised account; one resource per application named after its resource slug.",
      environment_policy: "Separate development and production resources; never share credentials between them.",
      automation: { methods: ["browser"], status: "documented", steps: ["Confirm the authorised account before creating anything.", "Create only the approved resources and record their names.", "Store credentials in the project's environment, never in the repository."] },
      quota_notes: "Free tier assumed for the fixture; verify current limits before relying on them.",
      sources: [{ url: `https://example.com/docs/${id}`, checked_at: "2026-10-12" }],
    })),
  };
}

export function servicesAccounts() {
  return {
    schema_version: 1,
    accounts: PROVIDERS.filter(([id]) => !["upstash", "formspark"].includes(id)).map(([id, name]) => ({
      id: `${id}-main`,
      provider_id: id,
      login_email: id === "github" ? "builds@example.com" : "owner@example.com",
      display_name: `${name} · cuenta principal`,
      dashboard_url: `https://example.com/dashboards/${id}`,
      access_status: id === "posthog" ? "unverified" : "historical_identity_verified",
      observed_at: "2026-10-19",
      plan: "Free (observado el 19/10/2026)",
      accepting_new_projects: true,
      automation_status: id === "neon" ? "provision_tested" : "documented",
      next_step: null,
      notes: null,
      quota_snapshot: null,
    })),
  };
}

// ---------------------------------------------------------------- guild
export const LEDGER = { version: 2, updatedAt: "2026-10-20T23:40:00.000Z", totals: { workOrdersDone: 176, phasesCompleted: 5, releases: 2, greenTestRuns: 0 }, facts: {}, migration: {} };

export const EVENTS = [
  { event: "SessionStart", at: "2026-10-20T13:02:00Z", project: "funko-tracker", runtime: "claude" },
  { event: "SubagentStop", at: "2026-10-20T13:40:00Z", project: "funko-tracker", agent: "implementer", runtime: "claude" },
  { event: "SubagentStop", at: "2026-10-20T15:10:00Z", project: "funko-tracker", agent: "reviewer", runtime: "claude" },
  { event: "SessionStart", at: "2026-10-20T19:30:00Z", project: "pandasaga", runtime: "claude" },
  { event: "SubagentStop", at: "2026-10-20T21:05:00Z", project: "mission-control", agent: "implementer", runtime: "claude" },
  { event: "SubagentStop", at: "2026-10-20T23:35:00Z", project: "funko-tracker", agent: "implementer", runtime: "claude" },
].map((e) => JSON.stringify(e)).join("\n");

// ---------------------------------------------------------------- git facts
const branch = (name, hoursAgo, ahead, opts = {}) => ({ name, lastCommitAt: iso(ago(hoursAgo)), ahead, subject: opts.subject ?? `${name.replace(/^[^/]+\//, "").replaceAll("-", " ")}`, filesChanged: opts.files ?? ahead * 3, worktree: opts.worktree ?? null, uncommitted: opts.uncommitted ?? 0 });

/** Repositories, branches and worktrees as `git` would report them, keyed by repo id. */
export function gitRepos() {
  const wt = (repo, name) => `/workspace/${repo}/.claude/worktrees/${name}`;
  return {
    factory: {
      name: "Fábrica (panda-corp)", root: "/workspace/panda-corp", commits: 1762, pluginUncommitted: 0,
      branches: [
        branch("codex/backlog-gate-retry", 10, 1, { subject: "fix(build-engine): keep the first red run when a retry passes", files: 4 }),
        branch("wt/stats-seal-refresh", 10, 1, { worktree: wt("panda-corp", "stats-seal-refresh"), subject: "fix(mission-control): refresh the stats seal after a merge", files: 3 }),
        branch("wt/manual-anchor-links", 11, 1, { worktree: wt("panda-corp", "manual-anchor-links"), subject: "feat(mission-control): anchor links in the manual", files: 5 }),
        branch("wt/prototype-fixture", 2, 2, { worktree: wt("panda-corp", "prototype-fixture"), subject: "docs(mission-control): fixture data for the prototype", files: 12, uncommitted: 3 }),
      ],
      extraWorktrees: [{ path: wt("panda-corp", "old-review"), detached: true, locked: true }, { path: wt("panda-corp", "scratch-check"), detached: true }],
    },
    pandasaga: { name: "PandaSaga", root: "/workspace/pandasaga", commits: 214, branches: [], extraWorktrees: [] },
    "funko-tracker": {
      name: "Funko Tracker", root: "/workspace/funko-tracker", commits: 512,
      branches: [
        branch("build/frd-01-reopen", 8, 12, { subject: "feat(catalog): reopen WO-01-001 for the gate fix" }),
        branch("build/frd-05-poster", 9, 9, { subject: "feat(export): poster pages for long lists" }),
        branch("build/frd-03-counters", 9, 6, { subject: "feat(collection): counters per franchise" }),
        branch("change/variant-badge-overflow", 7, 4, { worktree: wt("funko-tracker", "variant-badge-overflow"), subject: "fix(catalog): wrap variant badges on phones" }),
        branch("change/catalog-search-accents", 8, 3, { worktree: wt("funko-tracker", "catalog-search-accents"), subject: "fix(catalog): accent-insensitive search" }),
        branch("change/owned-toggle-double-tap", 9, 2, { subject: "fix(collection): debounce the owned toggle" }),
        branch("change/franchise-count-stale", 70, 2, { worktree: wt("funko-tracker", "franchise-count-stale"), subject: "fix(catalog): revalidate franchise counts after a load" }),
        branch("change/sheet-gallery-keyboard", 22, 1, { subject: "fix(figure): keyboard arrows in the gallery" }),
        branch("change/single-environment-file", 1, 7, { worktree: wt("funko-tracker", "single-environment-file"), subject: "chore(env): one file per environment", uncommitted: 2 }),
        branch("change/poster-long-lists", 1, 4, { worktree: wt("funko-tracker", "poster-long-lists"), subject: "feat(export): split long posters" }),
        branch("change/export-ready-email", 0, 3, { worktree: wt("funko-tracker", "export-ready-email"), subject: "feat(export): email when the export is ready" }),
        branch("change/review-queue-bulk-approve", 2, 2, { worktree: wt("funko-tracker", "review-queue-bulk-approve"), subject: "feat(ingestion): bulk approve in the review queue" }),
      ],
      extraWorktrees: [{ path: wt("funko-tracker", "gate-scratch"), detached: true }],
    },
    pandacast: { name: "PandaCast", root: "/workspace/pandacast", commits: 96, branches: [], extraWorktrees: [] },
    "personal-page-v2": {
      name: "PersonalPage v2", root: "/workspace/personal-page-v2", commits: 388,
      branches: [branch("wt/og-image-experiment", 1005, 2, { worktree: wt("personal-page-v2", "og-image-experiment"), subject: "experiment: alternative share image layout" })],
      extraWorktrees: [{ path: wt("personal-page-v2", "old-preview"), detached: true }],
    },
  };
}

/** Last commit per project (`git log -1 --format=%cI`), newest first by design. */
export const LAST_ACTIVITY = {
  "funko-tracker": "2026-10-20T18:40:11-05:00",
  "mission-control": "2026-10-20T16:10:24-05:00",
  pandasaga: "2026-10-20T14:30:05-05:00",
  pandacast: "2026-10-19T00:40:00-05:00",
  "personal-page-v2": "2026-10-19T00:38:00-05:00",
};

/** Phase history of each project's status.yaml, keyed by its portfolio name. */
export const PHASE_HISTORY = {
  "Pandacorp (Mission Control)": [["2026-06-12", "architecture"], ["2026-06-16", "implementation"], ["2026-06-18", "release"], ["2026-06-19", "implementation"], ["2026-06-21", "release"], ["2026-06-29", "implementation"], ["2026-06-29", "release"], ["2026-07-06", "implementation"], ["2026-07-07", "release"], ["2026-09-03", "implementation"]],
  "PersonalPage v2": [["2026-06-23", "product"], ["2026-06-26", "design"], ["2026-06-29", "architecture"], ["2026-06-30", "implementation"], ["2026-10-07", "release"]],
  "Funko Tracker": [["2026-10-12", "product"], ["2026-10-14", "design"], ["2026-10-16", "architecture"], ["2026-10-18", "implementation"]],
  PandaSaga: [["2026-10-10", "product"], ["2026-10-13", "design"], ["2026-10-15", "architecture"]],
  PandaCast: [["2026-10-11", "product"], ["2026-10-13", "design"], ["2026-10-14", "architecture"]],
};
