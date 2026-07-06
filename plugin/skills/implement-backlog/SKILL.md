---
name: implement-backlog
description: Implements factory/backlog/BL-* items — the factory's own actionable defects/changes (plugin, build engine, templates, standards machinery, hooks; DR-103). Two modes — give it one id (e.g. "implementa BL-0007" / `/pandacorp:implement-backlog BL-0007`) and it fixes just that item, directly, in this conversation; call it with no argument and it drains the WHOLE open/doing backlog, dispatching one subagent per item (model tier sized to each item's complexity, CONV-12/DR-111), each isolated in its own git worktree, merged back one at a time. Runs IN the factory (panda-corp). Never touches a product project's own defects (those go through /pandacorp:change).
---

# /pandacorp:implement-backlog

The mechanism referenced by the backlog's own read-only note ("pídeselo a un agente, p. ej. «implementa BL-0007»") and by Mission Control's Backlog tab. Unlike a product project's `/pandacorp:change`, there is no separate *filing* skill on this side — a `BL-*.md` item already exists (filed by the librarian's routing, an audit, or hand-authored per `factory/backlog/_item-template.md`); this skill only **works and closes** it. Read `factory/backlog/README.md` first if you haven't — it owns the plane-3 model (DR-103) and the item schema.

`$ARGUMENTS`:
- **one id** (`BL-0007`, anything after it is ignored) → **single-item mode**: implement just that item, directly, in this conversation.
- **nothing** → **whole-backlog mode**: drain every `open`/`doing` item, one subagent per item.

## Preflight (both modes)

1. Confirm you're in the factory root: `factory/backlog/` exists. If not, STOP — this skill only runs in `panda-corp`, never inside a product project (a project's own defects go through THAT project's `/pandacorp:change`, never here — DR-103 scope).
2. `bash plugin/scripts/validate-backlog.sh` — if it reports errors on items you are NOT about to touch, note them and proceed (don't let unrelated store damage block your own item); if it flags the item you're targeting, fix its frontmatter first.

## Implement & close — the shared recipe (single-item mode runs this directly; whole-backlog mode copies it verbatim into each subagent's prompt)

1. Find `factory/backlog/BL-NNNN-*.md` by its `id:` frontmatter field (the filename carries a slug after the number — never assume `BL-NNNN.md` bare). Not found → say so. Already `status: done` → report what closed it (`closed:`/`closes:`) and stop; don't redo it.
2. Read the item whole: **Problem** (+ **Root cause** for a bug), **Fix plan**, **Tests**, **Done when**, **Out of scope**.
3. Isolate if the fix is more than a one-line doc/prose tweak: a fresh git worktree (the same discipline as DR-096; no bootstrap script needed here — `plugin/`/`factory/` edits carry no `node_modules` of their own, unlike a Mission Control change).
4. Implement exactly the **Fix plan** — nothing broader (no drive-by refactors, nothing past **Out of scope**). Prove it with the item's own **Tests** section: a unit test, a `verify.sh --canary` gate canary (DR-079), a script/CLI assertion, or a documented manual repro when automation is genuinely infeasible — never skip proof because "it's just a config/doc change."
5. When every **Done when** criterion is objectively true:
   - Rewrite the item's OWN frontmatter: `status: done`, `closed: <today, ISO date>`, `closes: "<the DR/standard/doc/version this produced>"` — quote free-text values (the fail-loud reader rule). Back-link a `source` lesson's `promotion:` field if Done-when calls for it.
   - `plugin/` changed → bump `plugin/.claude-plugin/plugin.json`'s `version` per semver (CLAUDE.md's PATCH/MINOR/MAJOR rule), add the entry to `plugin/docs/decision-log.md`, and run `claude plugin validate plugin/`.
   - `factory/standards/`, `factory/decisions/registry.yaml` or the constitution changed → add the entry to `factory/decision-log.md`.
   - `bash plugin/scripts/validate-backlog.sh` once more — the store must stay valid after your own edit.
6. Commit (Conventional Commits, English): `fix(backlog): BL-NNNN — <title>` for a bug, `feat(backlog): BL-NNNN — <title>` for a change. If you isolated in a worktree, land it (merge into `main`, resolving any conflict by hand the same disciplined way as any other merge), then remove the worktree + its branch.
7. Report (to the owner, in Spanish) which criteria closed it and what shipped. If you got stuck: leave `status: doing` — **never** silently revert to `open` — and report exactly what's blocking (a missing owner decision, an external dependency, a genuine technical fault) instead of guessing at a fix.

## Mode: one item — `/pandacorp:implement-backlog BL-NNNN`

Run the recipe above directly, in this conversation.

## Mode: whole backlog — `/pandacorp:implement-backlog` (no arguments)

This mode is a **deterministic Dynamic Workflow**, not an improvised fan-out (proposal 31 T1.1): the scan, the model-tier sizing, the parallel isolated implementers, the strictly-serialized merge-with-validator, and the final report are all scripted in `.claude/engines/pandacorp-backlog.js` — the same recipe every time, instead of a model re-deriving the orchestration from prose on each run.

### The dynamic workflow (pandacorp-backlog)

**A DIFFERENT engine from `pandacorp-build`** (the project build engine, `plugin/skills/implement/SKILL.md`) — same `.claude/engines/` convention (off the `/` menu, launched only by `scriptPath`), but its own script, its own phases, and it runs IN the factory root, never inside a product project. Four scripted phases: **Scan** (one haiku agent reads every `factory/backlog/BL-*.md`, sizes each item's model tier per the CONV-12/DR-111 rubric, keeps only `open`/`doing`) → **Implement** (parallel — one subagent per item, model sized to its tier, each isolated in its own git worktree so N items never collide) → **Merge** (STRICTLY serialized, one item at a time, in return order: rebase, ff-only or resolved merge over the named hotspots, `validate-backlog.sh` between EVERY merge — a red reverts that merge and blocks the item instead of touching the next one) → **Report** (returns `{ done, blocked }`; this skill renders the Spanish table, never the workflow itself). Resume is just relaunching: it re-scans the backlog from disk and items already `status: done` are excluded automatically.

**Hardening lesson:** low-tier (haiku) agents were observed drifting to the session's cwd repo instead of the target factory root even with absolute paths in the prompt body — fixed with an `ANCHOR` preamble prepended to every dispatched prompt plus an explicit worktree-ownership check right after creation.

1. Launch it: `Workflow({ scriptPath: '/Users/Shared/Proyectos/panda-corp/.claude/engines/pandacorp-backlog.js', args: {} })`. Pass `args.items: ["BL-0007", ...]` to restrict to specific ids, `args.maxItems: N` to cap how many are dispatched this run, or `args.factoryRoot` only when testing against a fixture repo (defaults to the real factory root).
2. Internally the workflow: **Scan** — one haiku agent reads every `factory/backlog/BL-*.md` frontmatter and sizes each item's model tier (see the rubric below — the scan agent cites it directly), keeping only `open`/`doing` items, honoring `args.items`, capping at `args.maxItems` and logging anything dropped (no silent caps). **Implement** — `parallel()` dispatches one agent per item, model = that item's tier, isolated in its own `git worktree` (`.claude/worktrees/bl-<id>`, branch `bl/<id>`); each implements + proves + closes the item's own frontmatter + commits **inside its worktree only**, never touching `main`, and reports `done` or `blocked` (blocked items are never retried automatically). **Merge** — a plain serialized loop, one sonnet agent per successful item, in return order: rebase onto `main`, `ff-only` merge (or a resolved merge using the named hotspots — `plugin.json` version keeps the HIGHER, `decision-log.md` keeps BOTH entries most-recent-on-top, `factory/backlog/README.md`'s count gets recounted from files), then `bash plugin/scripts/validate-backlog.sh` — red reverts that merge and marks the item blocked; green removes the worktree + branch before the next merge. **Report** — the workflow returns `{ done: [...], blocked: [...] }` and does nothing else (no push, no notification).
3. Render that returned `{done, blocked}` as a **summary table to the owner, in Spanish**: one line per item, done vs. blocked with its one-line reason. If ANY `plugin/` file changed across the whole run, remind them ONCE at the end (not per item) to run `claude plugin update pandacorp@panda-corp`.
4. **Resume is just relaunching** — a re-run re-scans the backlog from disk; items already `status: done` in their own frontmatter are excluded automatically, so nothing is redone and nothing needs a separate resume flag.

**Model-tier rubric the scan agent applies (CONV-12/DR-111, `factory/standards/conventions.md`)** — read the item's `severity` and how much its **Fix plan** actually touches: a one-line doc/prose/copy tweak or a mechanical rename → **haiku**; the common case (a skill/script/template change with real logic, a routine build-engine adjustment) → **sonnet** (the default floor); a change to the build engine's own core orchestration, a cross-cutting standard, or anything genuinely architectural/high-judgment → **opus**. **Fable is never chosen automatically.**

## Rules

- **Scope: the factory's own tooling only** (DR-103). A product-project defect never belongs here — redirect to that project's `/pandacorp:change`.
- **Never invent a Done-when the item doesn't have.** An underspecified item (no concrete Fix plan / Tests) is itself a reason to stop and ask the owner, not to guess.
- **Never skip proof.** An item closes only when its own Tests section is objectively satisfied — "looks right" is not a Done-when.
- **Never silently revert `doing` → `open`** on failure — leave it `doing` and report the blocker; a silent revert erases the fact that someone already tried.
- **Model tier is calculated per item (CONV-12/DR-111), never inherited from the parent conversation's tier** — and Fable is never chosen automatically, only on the owner's explicit request.
- Same commit/versioning discipline as any other `plugin/` change (CLAUDE.md "Plugin maintenance"): bump semver, validate, and remind the owner to run `claude plugin update pandacorp@panda-corp` to pick it up.
