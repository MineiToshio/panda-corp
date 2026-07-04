# Handoff — Independent verification of the multi-runtime portability layer (proposal 25)

**Audience:** an OpenAI Codex session (app or CLI) opened at this repo's root. You are the SECOND, independent pair of eyes: everything described here was designed and implemented by a Claude Code session on 2026-07-04, and it is **deliberately uncommitted** — the owner wants your verification BEFORE it lands in git.
**Your mission:** verify it works, verify nothing was lost, and propose improvements. You do NOT need prior context — this file + the repo are self-contained.
**Ground rules:** do NOT commit or revert anything; do NOT hand-edit generated files (`.codex/agents/*.toml`, the two plugin manifests' sync is ritual-managed); talk to the owner **in Spanish** (per AGENTS.md, which you should already have loaded); report findings as a ranked list (blockers → nits), each with evidence.

## What was built (the claim you are auditing)

Design doc: `docs/proposals/25-multi-runtime-portability.md`. Summary of the working-tree changes (~40 files, all uncommitted):

1. **Root inversion** — new canonical `AGENTS.md` (tool-agnostic manual); `CLAUDE.md` rewritten as a thin Claude-Code-only layer that imports it (`@AGENTS.md`).
2. **Skills exposure** — `name: <slug>` added to all 25 `plugin/skills/*/SKILL.md` frontmatters; symlink `.agents/skills → ../plugin/skills`; new Codex plugin manifest `plugin/.codex-plugin/plugin.json`.
3. **Codex agents** — generator `plugin/scripts/generate-codex-agents.mjs` producing 17 TOML files in `.codex/agents/` (14 mirrored from `plugin/agents/*.md` + 3 generic tier workers).
4. **New standard** — `factory/standards/agent-portability.md` (PORT-1…6) + row in `factory/standards/README.md`.
5. **Governance** — DR-113 in `factory/decisions/registry.yaml`; entries in `factory/decision-log.md` + `plugin/docs/decision-log.md`; version bumps (plugin 9.64.0 in BOTH manifests, OVERLAY_VERSION 8.64.0); "Other runtimes" section in `plugin/templates/shared/AGENTS.md.tpl`; Manual page `mission-control/content/manual/concepts/estandares-y-reglas.md` updated.

## Verification checklist (fan out in parallel where useful — spawn one subagent per block if the owner agrees)

**A. Self-test (you ARE the test rig — highest value):**
- A1. Did you load `AGENTS.md` automatically and are you speaking Spanish to the owner? (If not, that is finding #1.)
- A2. Do you discover the 25 pandacorp skills (via `.agents/skills`)? List what `/skills` shows. Verify the symlink resolves: `ls -la .agents/ && ls .agents/skills/ | wc -l` (expect 25).
- A3. Pick one skill (e.g. `recommend`) and dry-follow it: does the text make sense under the translation rules (AGENTS.md §Runtime portability)? Note every Claude-native tool reference the table does NOT cover — coverage gaps are exactly what we want found.
- A4. Size guard: `wc -c AGENTS.md` — must stay well under 32768 bytes (Codex's combined project-doc budget, `project_doc_max_bytes`).

**B. Integrity — nothing lost in the inversion:**
- B1. `git diff CLAUDE.md` shows the old manual; confirm every operational rule/fact in the OLD CLAUDE.md now exists in (new) `AGENTS.md` + (new) `CLAUDE.md` combined. Flag any dropped rule, table row, or DR reference (content moved is fine; content VANISHED is a blocker).
- B2. `git diff plugin/skills/` must be EXACTLY 25 insertions, all of the form `name: <dir-slug>`, nothing else touched.
- B3. The 17 TOMLs: parse each (`python3 -c "import tomllib,glob; [tomllib.load(open(f,'rb')) for f in glob.glob('.codex/agents/*.toml')]"`); cross-check 3 of them against their source `plugin/agents/*.md` (description matches, body present in `developer_instructions`, model mapping per the table in `factory/standards/agent-portability.md` PORT-2).
- B4. Version sync: both `plugin/.claude-plugin/plugin.json` and `plugin/.codex-plugin/plugin.json` say 9.64.0; `plugin/templates/OVERLAY_VERSION` says 8.64.0.
- B5. `factory/decisions/registry.yaml` parses as YAML and DR-113 follows the same schema as DR-110..112.

**C. Behavior — the protocols hold:**
- C1. As a non-Claude runtime, simulate the owner asking for a small change to a product project: per AGENTS.md/templates, you should route it to `.pandacorp/inbox/changes/` — confirm the instruction chain (AGENTS.md → guide/template) actually leads you there and nothing tells you to edit ad hoc.
- C2. Read `factory/standards/agent-portability.md` PORT-5 (attended build loop): is it executable as written by an agent with no Claude context? Flag ambiguities.
- C3. Confirm the DR-050 cross-runtime lock story: `AGENTS.md`/PORT-5 must tell you to check `running` + heartbeat in a project's `.pandacorp/status.yaml` before building.

**D. Improvement hunting (propose, don't implement):**
- D1. Hooks V2: could `plugin/scripts/block-dangerous.sh` and `verify-before-stop.sh` run under Codex hooks (`.codex/` hooks config)? What registration file/payload mapping would it take?
- D2. Anything in Codex's native surface we under-used: `agents/openai.yaml` sidecars for skill invocation policy, project `.codex/config.toml` profiles mirroring build modes (pro/balanced/powerful/deep), `notify` for turn-complete pings.
- D3. Whatever else you find — you know your own runtime better than the author did.

## Deliverable

A single report to the owner, in Spanish: (1) veredicto por bloque A–D (verde/ámbar/rojo + evidencia), (2) hallazgos rankeados (bloqueante → mejora → nit), (3) qué mejorarías de la capa Codex, concreto. Do not fix anything yourself unless the owner asks afterwards.
