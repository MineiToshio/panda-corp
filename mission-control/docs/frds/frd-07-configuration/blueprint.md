---
id: FRD-07-blueprint
type: blueprint
parent: FRD-07
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-18'
---
# FRD-07 — Configuration · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-FRD blueprint** (DR-049): how the Configuration feature is implemented on
> top of the platform. It references **[platform architecture](../../product/architecture.md)**
> (the stack, the `lib/**` data layer §6, the read-only invariant §1/§7, the data model §4,
> the app surfaces §11) rather than restating it. Read that first.

## 1. Feature summary

A **read-only** view of what is configured in the factory, in four sections — **Skills · Agents ·
Decision rules · Standards** — each a browsable list → item detail. The agents carry an honest
**level/title/XP** progression (FRD-09 vocabulary; XP from real work orders, [FRD-09 blueprint](../frd-09-gamification/blueprint.md)).
All content is **derived at read time** from the canonical factory sources (`plugin/skills/`,
`plugin/agents/`, `factory/decisions/registry.yaml`, `factory/standards/`) — never hand-copied
(DR-046). To change configuration the owner edits the files / Claude Code; Mission Control only
reflects it. This is consistent with the platform read-only golden rule (architecture §1).

This blueprint covers the **Configuration page**. The DERIVATION mechanics (parsing the plugin and
factory sources into typed catalogs) are shared with FRD-08 (the Manual's Reference) and live in
the `lib/reference.ts`, `lib/registry.ts`, `lib/standards.ts` modules (architecture §6). FRD-07 is
the first consumer; FRD-08 reuses the same modules.

## 2. Source mapping (architecture §6 + §4.6)

| Source file | Module | What FRD-07 reads | Shape note |
|---|---|---|---|
| `plugin/skills/<slug>/SKILL.md` | `lib/reference.ts` | slug (dir name), `description` (frontmatter), body markdown | slug is the **directory name**, NEVER a `name:` field (CLAUDE.md skill-naming rule). Invoked as `/pandacorp:<slug>`. |
| `plugin/agents/<id>.md` | `lib/reference.ts` | `name`, `description`, `model`, body markdown | `model` ∈ `{opus, sonnet, …}`. |
| `factory/decisions/registry.yaml` | `lib/registry.ts` | `decisiones[]`: `id`, `patron`, `default`, `requiere_humano`, optional `nota` | `requiere_humano` drives the auto-approves (●) / asks-you (●) indicator. |
| `factory/standards/*.md` | `lib/standards.ts` | filename (→ id/slug), title (H1), body markdown | **GAP:** these files have **no** `domain/severity/enforcement` frontmatter today (verified: only `external-services.md` has any frontmatter, not these fields). See §6 "Derivation gap". |

## 3. Components & interfaces

### Interfaces (read layer — `lib/**`, architecture §6)
- **`IF-07-reference`** — `lib/reference.ts`. Pure readers, fixture-tested:
  - `readSkills(): SkillRef[]` → `{ slug, description, runsIn: "factory"|"project"|"unknown", body }`. `slug` = dir name; `runsIn` is **inferred** from the description/body (heuristic, see §6), never invented.
  - `readAgents(): AgentRef[]` → `{ id, name, description, model, body }`.
  - Defensive: a malformed/frontmatter-less file is skipped with a typed warning, never crashes the catalog (architecture §7).
- **`IF-07-registry`** — `lib/registry.ts`. `readDecisionRules(): DecisionRule[]` → `{ id, patron, default, requiereHumano: boolean, nota? }`. Tolerates extra YAML keys.
- **`IF-07-standards`** — `lib/standards.ts`. `readStandards(): Standard[]` → `{ id, title, body, domain, severity, enforcement, summary: string[] }`. `domain/severity/enforcement/summary` come from frontmatter when present, else from the **derivation map** (§6); `summary` defaults to the first bullet list or lead paragraph of the body.

### Components (`app/configuration/` + `components/`)
- **`CMP-07-config-page`** — `app/configuration/page.tsx` (Server Component). Section tabs (Skills · Agents · Decision rules · Standards); composes the four section views. App surface per architecture §11 (`app/configuration`). → `REQ-07` AC "sections".
- **`CMP-07-skill-list`** — Skills section. Two groups (En la fábrica / En el proyecto, derived from `runsIn`), each a card grid with name + real description. → AC "list items with name + real description".
- **`CMP-07-skill-detail`** — Skill detail (Server Component for content + a small `"use client"` `CopyButton` reused from FRD-02). Shows what it is for, where it runs, what it produces, and a **mini-flow** of agent chips (colored per agent) with arrows — the "graph of how the skill works". → AC "skill detail + mini-flow".
- **`CMP-07-flow-diagram`** — renders the skill's agent mini-flow (chips colored per agent, arrows). The flow data is part of the skill's derived `body`/structured steps; where the SKILL.md does not declare an explicit machine-readable flow, the diagram degrades to the ordered agent list (no invented steps). Colors come from the per-agent token (FRD-13), never hardcoded.
- **`CMP-07-agent-list`** — Agents section: per agent a **pixel-art avatar** (FF style), its **level** and **title** (Apprentice → Engineer → Senior → Architect). Level/title from `IF-09-agent-xp` (FRD-09). → AC "agents avatar + level + title".
- **`CMP-07-agent-detail`** — Agent detail: **XP bar to next level** + the explanation "levels up by completing work orders". XP from `IF-09-agent-xp`. → AC "agent detail + XP bar + explanation".
- **`CMP-07-rules-list`** — Decision rules section: an explainer of what a decision rule IS; ALL DRs with an **auto-approves (●) / asks-you (●)** indicator; a **"New decision rule"** button that copies `/pandacorp:learn` (reuses `CopyButton`). → AC "decision rules".
- **`CMP-07-rule-detail`** — DR detail: the pre-approved default (`default`), how it is applied (escalates vs auto), file location. → AC "rule detail".
- **`CMP-07-standards-list`** — Standards section **categorized by domain** (Programming, Architecture, Design, Technology, Quality, Security, Operation, Data/Privacy, Product/Docs), each standard with **severity** (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate) badges; a **"New standard"** button copying `/pandacorp:learn`. → AC "standards categorized + badges".
- **`CMP-07-standard-detail`** — two views: **Summary** (real key points) + **Detail** (rendered markdown via `react-markdown`). → AC "two views Summary/Detail".

### Reused (do not re-create)
- `CopyButton` (FRD-02) for the `/pandacorp:learn` buttons.
- Avatar/level/title from FRD-09 (`IF-09-agent-xp`, the pixel-art avatar component).
- FRD-13 tokens for all colors (per-agent accent included) — zero hardcoded colors.

## 4. Read-only & security posture
No writes: every reader is `fs.read*` (architecture §7). The `/pandacorp:learn` buttons only **copy
a command string to the clipboard**; they never execute it (architecture §1). No personal data is
touched beyond what already lives in the factory repo.

## 5. Traceability (REQ → AC → CMP/IF)

FRD-07 states its requirements as EARS bullets (no explicit `REQ-07-MMM` ids in the FRD). The
work orders assign stable `AC-07-MMM.K` ids. Mapping of each FRD bullet to components:

| FRD-07 EARS bullet | Component(s) / Interface(s) |
|---|---|
| Sections Skills · Agents · Decision rules · Standards | `CMP-07-config-page` |
| Each section lists items with name + real description | `CMP-07-skill-list`, `CMP-07-agent-list`, `CMP-07-rules-list`, `CMP-07-standards-list` |
| Click item → detail (content/explanation) | `CMP-07-*-detail` (all four) |
| Skill detail: purpose, where it runs, produces, mini-flow of colored agent chips | `CMP-07-skill-detail`, `CMP-07-flow-diagram`, `IF-07-reference` |
| Decision rules: explain what a DR is, all DRs with ●/● indicator, detail (default), "New decision rule" copies `/pandacorp:learn` | `CMP-07-rules-list`, `CMP-07-rule-detail`, `IF-07-registry` |
| Standards categorized by domain, severity + enforcement badges, Summary/Detail, "New standard" copies `/pandacorp:learn` | `CMP-07-standards-list`, `CMP-07-standard-detail`, `IF-07-standards` |
| Agents: pixel-art avatar, level, title | `CMP-07-agent-list`, `IF-09-agent-xp` |
| Agent detail: XP bar to next level + "levels up by completing work orders" | `CMP-07-agent-detail`, `IF-09-agent-xp` |
| Content read from plugin/factory; read-only | `IF-07-reference`, `IF-07-registry`, `IF-07-standards` |

## 6. Derivation gap (flagged for the owner)

The **Standards** AC requires a **domain**, **severity** (MUST/SHOULD/MAY) and **enforcement**
(lint/CI/checklist/human gate) per standard, but `factory/standards/*.md` files **do not carry that
metadata** today (verified). Two honest options — neither invents data:

- **(A, recommended) Add frontmatter to each standard** (`domain`, `severity`, `enforcement`,
  optional `summary`) in `factory/standards/*.md`, then `lib/standards.ts` derives directly. This is
  a factory-source change (outside MC's write scope) and the cleanest DR-046 fit. The prototype's
  `CONFIG.estandares` array already models exactly these fields, so the schema is known.
- **(B, fallback) A small static derivation map in `lib/standards.ts`** keyed by filename
  (`quality.md → {domain: Quality, severity: MUST, enforcement: CI}`, …). This is a hand-maintained
  map — it partially violates the DR-046 "no hand copy" spirit, so it is the fallback only until (A)
  lands.

The work orders implement `lib/standards.ts` against **(A)** with a graceful fallback to **(B)** so
the section is never empty, and **flag the frontmatter addition to the owner** (it is a factory-repo
change, not a Mission Control change). `runsIn` for skills is similarly **inferred** (heuristic on
the description/body keywords "in the factory" / "in the project") — also a candidate for an
explicit `runs_in:` frontmatter field on skills; flagged, not invented.

## Build Plan (Phase 2)

The Phase 2 re-anchor collapses the former UI work orders into **one coarse UI WO** while the
`lib/**` readers stay VERIFIED and are consumed as-is. Build foundation-first.

**Coarse WO set**
| WO | Status | Artifacts (disjoint) | Builds |
|---|---|---|---|
| WO-07-001 | VERIFIED | `lib/reference.ts` | `readSkills`/`readAgents` (consume) |
| WO-07-003 | VERIFIED | `lib/registry.ts` | `readDecisionRules` (consume) |
| WO-07-004 | VERIFIED | `lib/standards.ts` | `readStandards` (consume) |
| **WO-07-005** | **PLANNED** | `src/app/configuration/**` | the whole Configuración UI surface |

**DAG & parallelism**
```
FRD-13 foundation (WO-13-006 PageTitle/SectionHead/Tabs · WO-13-007 Panel/Chip/CmdRow/Button · WO-13-008 ItemSlot)
        │   FRD-09 (IF-09-agent-xp · Avatar/XpBar)
        ▼
WO-07-005 (Configuración UI)  ◄── consumes VERIFIED readers WO-07-001/003/004
```
Only one UI WO remains, so there is no intra-FRD UI parallelism; its single artifact glob
(`src/app/configuration/**`) is **disjoint** from FRD-08's (`src/app/manual/**`). The three readers
are already done.

**Cross-FRD deps line (foundation-first):** `frd-13` (foundation primitives + tokens) **must build
before** WO-07-005; `frd-09` provides the agent XP/avatar. WO-07-005's cards are then **reused
verbatim** by FRD-08's Referencia — so FRD-07's UI WO builds **before** FRD-08's UI WO.

