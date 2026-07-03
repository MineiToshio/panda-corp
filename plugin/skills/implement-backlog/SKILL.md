---
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

1. Read `factory/backlog/`, keep every item with `status: open` or `doing` (skip `done`).
2. **Size each item's model tier — CONV-12/DR-111** (`factory/standards/conventions.md`), never the parent conversation's own tier: read the `severity` and how much the **Fix plan** actually touches — a one-line doc/prose/copy tweak or a mechanical rename → **haiku**; the common case (a skill/script/template change with real logic, a routine build-engine adjustment) → **sonnet** (the default floor); a change to the build engine's own core orchestration, a cross-cutting standard, or anything genuinely architectural/high-judgment → **opus**. **Fable is never chosen automatically.**
3. Dispatch **one `Agent` call per item, all in a single message** (so they run in parallel), each with `isolation: "worktree"` and the model from step 2. Each subagent has NOT seen this conversation — its prompt is the **Implement & close** recipe above, verbatim, filled in with that one item's id. Tell it explicitly: implement + prove + close the item's OWN frontmatter + commit inside its worktree, and report back what it did — but **do NOT merge to `main` itself**; that happens next, serialized, by you.
4. Once every subagent returns: **merge them into `main` ONE AT A TIME, in the order they return** (never in parallel — that is exactly the collision this serialization avoids). For each: `git merge --ff-only <branch>` when possible, else a normal merge resolving conflicts by hand (the most likely spots: `factory/backlog/README.md`'s open-count mentions, `plugin/docs/decision-log.md`'s "most recent on top" list, or `plugin/.claude-plugin/plugin.json`'s version if two items both bumped it — reconcile to the higher version, don't blindly pick one side). Re-run `bash plugin/scripts/validate-backlog.sh` after EACH merge — it catches an id/frontmatter collision immediately, before it compounds across the next merge. Remove that worktree + branch before merging the next one.
5. A subagent that returns **blocked** (needs-owner / external / genuinely stuck) is not retried automatically — its item stays exactly where it left it (`doing`, with the reported blocker — never silently reverted to `open`); collect it into the final report and keep going with the rest.
6. **Report a summary table** to the owner (Spanish): done / blocked / errored, one line per item. If ANY `plugin/` file changed across the whole run, remind them ONCE at the end (not per item) to run `claude plugin update pandacorp@panda-corp`.

## Rules

- **Scope: the factory's own tooling only** (DR-103). A product-project defect never belongs here — redirect to that project's `/pandacorp:change`.
- **Never invent a Done-when the item doesn't have.** An underspecified item (no concrete Fix plan / Tests) is itself a reason to stop and ask the owner, not to guess.
- **Never skip proof.** An item closes only when its own Tests section is objectively satisfied — "looks right" is not a Done-when.
- **Never silently revert `doing` → `open`** on failure — leave it `doing` and report the blocker; a silent revert erases the fact that someone already tried.
- **Model tier is calculated per item (CONV-12/DR-111), never inherited from the parent conversation's tier** — and Fable is never chosen automatically, only on the owner's explicit request.
- Same commit/versioning discipline as any other `plugin/` change (CLAUDE.md "Plugin maintenance"): bump semver, validate, and remind the owner to run `claude plugin update pandacorp@panda-corp` to pick it up.
