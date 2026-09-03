# 34 — Path-scoped rules: from flat injection to context diet

**Status:** proposed · **Date:** 2026-09-02 · **Owner:** factory maintainer
**Home:** this is a FACTORY proposal (about the factory's own know-how), not a product project.
**Origin:** R-28 of `docs/proposals/33-model-era-audit.md` (§6, §14) — filed as *"Design review, not
a blind swap"* against DR-051's rule-injection mechanism, routed here (not a `BL-*`) because it
"restructures an established injection mechanism" (§14 row: `docs/proposals/34-*` · JUDGE · owner
present).

> Self-contained: re-verifies R-28's evidence live, confirms the native mechanism against its
> primary source, and gives the owner a scoped decision — not a mandate to rebuild DR-051.

---

## 1 · Summary

R-28 asked whether `.claude/rules/*.md` path-scoped rules (GA, unused today — `no .claude/rules/
directory exists`, verified) could replace the factory's flat rule injection. They can, partially:
Claude Code's native mechanism (`paths:` frontmatter, verified live against `code.claude.com/docs/
en/memory`) does exactly what R-28 hoped, and the factory's rule library already carries the
matching metadata — a `globs:` field on every tech-gated file, today dead weight (Cursor-only,
ignored by Claude Code). The catch: it is Claude-Code-only, triggers on file *reads* not task
intent, and means a second generated projection alongside `docs/rules/` needing DR-051's drift
discipline again. Recommendation: **pilot one tech-gated cluster on one project, measure, then
decide** — not a factory-wide swap.

---

## 2 · Problem, with evidence

**Live measurement, not the audit's estimate.** `mission-control/docs/rules/` holds 15 rule files +
`README.md` = **516 lines** (`wc -l mission-control/docs/rules/*.md`, verified this session), and
`mission-control/CLAUDE.md:6` — byte-identical to `plugin/templates/shared/CLAUDE.md.tpl:6` —
loads all of it unconditionally every session via `@docs/rules/README.md`, itself a *recursive*
`@import` of "one `@import` per file present" (`plugin/skills/scaffold/SKILL.md:39-47`). Every file
that landed in the project loads at launch, whether the current turn touches a `.tsx` component, a
Prisma schema, or a markdown doc — there is no gate between "this rule applies to the project" and
"this rule is in context right now."

**The always tier alone is 289 lines, in every project, unconditionally.** Nine files declare
`applies_when: always` (`plugin/templates/rules/{ai-implementation,clean-code,code-conventions,
debugging,documentation-and-decisions,error-handling,project-structure,quality-and-testing,
resilience}.md`); combined line count, verified via `wc -l`, is 289. Correct that these should
always load — but even here, a rule about `_tests/` folder discipline loads while editing a README.

**Stack-specific files are already scoped ONE level (which technology), never a second (which
path).** `plugin/templates/rules/README.md:9-26` documents `applies_when` gating at *propagation*
time (a React-only project never receives `nextjs.md`) — that part of DR-051 works and is NOT what
R-28 is about. Missing is scoping *inside* a project that already has the file: `react.md` ships
with `globs: ["**/*.tsx", "**/*.jsx"]` in its own frontmatter (`plugin/templates/rules/react.md:3-4`)
— metadata that exists, per `README.md:53`, only *"to make them drop-in Cursor rules"*. Claude Code
does not read `globs:`; the file loads whole via the recursive `@import` regardless of which file is
open — the scoping data already exists and is simply unwired.

**`factory/standards/` is the wrong evidence for this proposal.** R-28's original framing
(`docs/proposals/33-model-era-audit.md:79` / §6) cited *"33 standards (~5,500 lines)"* and
`build-orchestration.md` alone at 1,360 lines. Re-measured live: `factory/standards/*.md` totals
**3,757 lines** (`wc -l`), not ~5,500 — flagging the discrepancy per CONV-13, not asserting either
figure settled. More importantly `build-orchestration.md` is explicitly **factory-internal, never
shipped** (`factory/standards/README.md`: *"Factory-internal-only standards … don't ship"*). The
real injection surface a builder experiences is `docs/rules/`, measured above at 516 lines for one
live project — R-28's own numbers pointed at the wrong layer.

---

## 3 · The native mechanism (verified)

Source: `https://code.claude.com/docs/en/memory`, accessed 2026-09-02 (WebFetch, this session).

- **Location.** `.claude/rules/*.md` at the project level (all `.md` files discovered recursively,
  incl. subdirectories); `~/.claude/rules/` at the user level, applying to every project on the
  machine. Symlinks are supported (a shared rules directory can be linked into several projects),
  exactly PandaTrack's `.cursor/rules` shape DR-051 already drew from.
- **Frontmatter key is `paths`, not `globs`.** *"Rules can be scoped to specific files using YAML
  frontmatter with the `paths` field"* (example: `paths: ["src/api/**/*.ts"]`) — a **different key**
  from the `globs:` the factory's templates already carry; adopting this means translating the key,
  not reusing the file verbatim.
- **Unscoped rules load unconditionally**, *"with the same priority as `.claude/CLAUDE.md`"* — a
  `.claude/rules/*.md` file with no `paths:` behaves exactly like today's always-tier files.
- **Trigger is a file READ, not every tool use**: *"Path-scoped rules trigger when Claude reads
  files matching the pattern, not on every tool use."* A rule scoped to `app/**` loads when Claude
  reads a matching file, not because a shell command touched that path.
- **Glob budget**: brace expansion (`{ts,tsx}`) multiplies patterns; a `paths` list shares a budget
  of 1,000 expanded patterns / 4 MiB. **Precedence**: *"User-level rules are loaded before project
  rules, giving project rules higher priority"* — the same root-to-leaf ordering CLAUDE.md uses.
- **Maturity: GA** — proposal 33's own tool table already records this (`docs/proposals/
  33-model-era-audit.md:135`, S18 row): *"Auto memory; `.claude/rules/` path-scoped rules; `/import`
  | GA"*.
- **Caveat, from the doc's own `<Note>`**: *"Rules load into context every session or when matching
  files are opened … for task-specific instructions … use skills instead."* Path-scoping reduces
  *average* load across a session touching few file types, not a hard ceiling.

---

## 4 · Design — generated, never hand-authored

**Two-layer model, not a replacement.** `docs/rules/` stays exactly as DR-051 defined it: the
portable, tool-agnostic projection every runtime (and any human) can read. `.claude/rules/` becomes
a **second, Claude-only generated projection of the same source**, never a hand-maintained parallel
copy — the discipline DR-051 already enforces for `docs/rules/` ("propagation is deterministic …
never hand-copied") and the SSOT law DR-115 states generally (one authoritative home, one writer;
everyone else derives).

**Mapping.** `plugin/templates/rules/*.md` already carries per-file `globs:` (cataloged in
`plugin/templates/rules/README.md:9-26`) tied to the `applies_when` token that gates propagation.
Generating a project's `.claude/rules/<file>.md` is a **key rename, not new authoring**: copy the
file verbatim, rewrite `globs:` → `paths:` (same glob values, standard syntax on both sides).
`always`-tier files (the 9 in §2) ship into `.claude/rules/` with **no `paths:` key**, faithfully
translating "unconditional, CLAUDE.md priority" — not a new behavior.

**Generation point — extend the existing copy steps, add no new machinery.** The three places that
already write `docs/rules/` verbatim from `plugin/templates/rules/` are the only places this
belongs: `plugin/skills/scaffold/SKILL.md:26` (step 4b, `always` files at birth),
`plugin/skills/architecture/SKILL.md:51` (step 6b, tech-gated files once the stack is locked), and
`plugin/skills/upgrade/SKILL.md:64` (the `OVERLAY_VERSION`-triggered re-sync). Each becomes "copy to
`docs/rules/` **and** materialize `.claude/rules/`" in the same pass — one generator, two output
directories, one source of truth, matching DR-059's byte-identical-copy discipline already used for
stack gate configs.

**`CLAUDE.md.tpl` must be narrowed, or every rule double-loads.** Today `plugin/templates/shared/
CLAUDE.md.tpl:6` recursively `@import`s every file in `docs/rules/` unconditionally. Add
`.claude/rules/` *without* touching this line and Claude Code loads each tech-gated rule **twice** —
once via the import, once via native discovery. The Claude-Code-facing import must shrink to the
always-tier pointer only; `AGENTS.md` — read by non-Claude runtimes — keeps pointing at the full
`docs/rules/README.md` unchanged. Upgrade needs no new trigger: the same `OVERLAY_VERSION`/DR-048
loop that re-syncs `docs/rules/` today re-syncs `.claude/rules/` in the same run.

**DR-113 portability — Claude-only; the flat layer is the permanent fallback, not transitional.**
`.claude/rules/` path-scoping is a Claude Code CLI mechanism with no analogue surfaced for Codex or
any other runtime this factory operates through. Codex keeps reading `docs/rules/README.md`'s full
recursive projection exactly as today — designed, not provisional. New row for
`agent-portability.md`'s tool-translation table, alongside Workflow/Monitor/AskUserQuestion:
`.claude/rules/*.md` path scoping → no equivalent; flat `docs/rules/` stays authoritative elsewhere.

---

## 5 · Red-team

- **The context-diet claim is `[expected, not demonstrated]`.** Nothing in §2–§4 has been measured
  end to end; §6 is the canary this must pass before leaving pilot scope, the same evidentiary bar
  proposal 33 applied to every other R-id under CONV-13.
- **Risk of a builder missing a rule.** Path-scoping triggers on a file *read* matching `paths:`,
  not task intent — a rule scoped narrower than its real relevance (a security rule for "anything
  touching auth", scoped only to `app/api/**`, misses `lib/auth/*.ts`) silently stops firing where
  the flat model never could. Mitigation: scope only files whose glob already matches their domain
  unambiguously (`react.md`→`.tsx`/`.jsx`) — never the always-tier files, which stay unconditional.
  Mirrors the audit's "don't loosen speculatively" posture on DR-100's granularity (R-03).
- **doc-lint / rule-registry coupling.** `rule-registry.md` indexes enforcement against the
  canonical `factory/standards/*.md` file, not a generated artifact. `.claude/rules/` inserts a
  **third** copy in the propagation chain (`factory/standards/` → `plugin/templates/rules/` →
  `docs/rules/` **and now** `.claude/rules/`) that must move in lockstep or reproduce proposal 30's
  BK1–BK3 "blessed but not actually covered" class. The one-generator-two-directories design in §4
  is the mitigation, not an afterthought.
- **The derived-drift gate does not reach this layer.** `plugin/hooks/hooks.json`'s Stop-time
  `check-derived-drift.sh` polices *plugin-side* generated artifacts inside `panda-corp` itself, not
  a *product project's* generated files (`docs/rules/`, and the proposed `.claude/rules/`) — drift
  there is caught only by `upgrade`'s next overwrite pass. This gap already exists for `docs/rules/`
  today, so `.claude/rules/` doesn't regress it — but it inherits the blind spot rather than closing
  it, and should be named as a known limitation, not assumed fixed here.

---

## 6 · Canary

Both must pass before this proposal's design leaves pilot scope (§8 option B):

1. **Token measurement.** On Mission Control (§2's live rule set), run `/context` under the current
   flat model and record the "Memory files" contribution; materialize `.claude/rules/` for the
   react/nextjs/styling cluster only (§8 option B), narrow `CLAUDE.md.tpl` per §4, and re-run
   `/context` across a session touching only backend files. Expect the contribution to drop by
   roughly the cluster's line count (103 lines, live `wc -l`); if it doesn't, the pilot stops there.
2. **Rule-recall test.** Seed a fixture defect a scoped rule should catch (e.g. a Server Action
   missing an authorization check, `nextjs.md`'s rule + the reviewer's correctness lens) and confirm
   it is still caught under path-scoping as it is today under the flat model — a same-outcome A/B,
   not a token count: a diet win that silently drops a real catch is a regression.

---

## 7 · Effort / impact / risk

**Effort: M** — one generator extension shared across three existing copy steps
(scaffold/architecture/upgrade), one `CLAUDE.md.tpl` narrowing, one `agent-portability.md` table row.
**Impact: M**, `[expected, not demonstrated]` until §6 runs — a real context-budget win on a session
skewed toward one file type, no measurable win on a session that touches everything.
**Risk: Medium** — this restructures DR-051's established, working mechanism (R-28's own
characterization). A botched rollout — a missed `CLAUDE.md.tpl` narrowing (double-load), or an
over-narrow `paths:` glob (under-trigger) — is worse than the flat model's undieted correctness.

---

## 8 · Decision for the owner

- **A — Adopt factory-wide now** (every tech-gated file scoped, always-tier unconditional). **Not
  recommended** before §6 has run once; this is the "blind swap" R-28 explicitly warned against.
- **B — Pilot on one cluster, one project (recommended).** `react.md` + `nextjs.md` +
  `styling-and-ui.md` (103 lines, glob already matches their domain unambiguously — §5) on Mission
  Control only. Run both §6 canaries; decide extension only from real numbers.
- **C — Reject / defer.** Keep the flat `docs/rules/` model; revisit once a project's rule set grows
  materially past today's ~500-line ballpark (§2), or once scoping goes intent-based, not read-based.

**Recommendation: B** — matches R-28's own verdict (*"needs design review, not a blind swap"*) and
its Medium red-team risk rating. A scoped pilot produces the §6 numbers this proposal currently
lacks, before touching the always-tier files or the `CLAUDE.md.tpl` import shape — the two places a
mistake would actually cost something.

---

## 9 · Sources

All accessed 2026-09-02, this session.

| Source | What it grounds |
|---|---|
| `https://code.claude.com/docs/en/memory` (WebFetch) | `.claude/rules/`, `paths:` frontmatter, priority, read-triggered loading, glob budget, GA status |
| `docs/proposals/33-model-era-audit.md` §4/135, §6/285, §14/855 (grep) | R-28's finding, verdict, routing to this proposal |
| `plugin/templates/rules/README.md`, `react.md`, `nextjs.md` (Read) | `applies_when`/`globs:` catalog, existing Cursor-only glob metadata |
| `factory/standards/README.md`, `factory/decisions/registry.yaml` DR-051/DR-115 (Read) | Current injection contract + the SSOT law this design must not violate |
| `plugin/skills/scaffold/SKILL.md:26`, `architecture/SKILL.md:51`, `upgrade/SKILL.md:64` (grep) | The three existing copy steps this design extends |
| `mission-control/docs/rules/*.md`, `CLAUDE.md:6` (`wc -l` + Read) | Live 516-line injection measurement + the recursive-import line |
| `plugin/hooks/hooks.json`, `plugin/docs/decision-log.md` (grep) | Derived-drift gate's current scope (plugin-side only) |
