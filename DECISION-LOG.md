# Pandacorp decision log

Everything we decide and **why**, so we don't lose the trail. Organized by area; most recent on top in each one.

| Area | Decision log | What it covers |
|---|---|---|
| 🛰️ Mission Control (Next.js app) | [mission-control/docs/decision-log.md](mission-control/docs/decision-log.md) | Features, design and decisions of the Mission Control product |
| 🔌 Pandacorp plugin | [plugin/docs/decision-log.md](plugin/docs/decision-log.md) | Skills, agents, hooks and the factory flow |
| 💡 Ideas | [factory/ideas/decision-log.md](factory/ideas/decision-log.md) | Decisions about the idea base and its process (not the content of each idea) |
| 🏭 Factory | [factory/decision-log.md](factory/decision-log.md) | Constitution, standards and operational decisions |

## How it's used

Documenting a change is **two layers**, always:

1. **Canonical doc** (the current truth) — the document that *owns* the fact is updated: app behavior → the **FRD**; technical → the **blueprint/ADR**; plugin → the **skill file**; idea → its **card**. Full map in [CLAUDE.md](CLAUDE.md), the *Decision log* section.
2. **Decision log** (the history) — this entry: dated, with *what* and *why*, linking the doc that was touched. Most recent on top.

The canonical doc says *what is true today*; the decision log, *what changed and why*. You need both.

**Don't confuse three things:** canonical doc = **current truth**; decision log = **history**; [factory/decisions/registry.yaml](factory/decisions/registry.yaml) = **policy** (rules with a default).

### Format of each entry

```markdown
## YYYY-MM-DD — Short decision title
**What:** what we decided/did.
**Why:** the reason.
**Context:** alternatives we weighed, what we discarded (optional).
**Impact:** files/areas touched (optional).
```
