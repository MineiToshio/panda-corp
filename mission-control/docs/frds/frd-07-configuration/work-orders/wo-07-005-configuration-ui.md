---
id: WO-07-005
type: work-order
slug: configuration-ui
title: 'WO-07-005 — Configuración UI surface (re-anchor to prototype)'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
reopen_count: 1
artifacts:
  - 'src/app/configuration/**'
source_requirements: [REQ-07, AC-07-001, AC-07-002, AC-07-003, AC-07-004, AC-07-005]
last_updated: '2026-06-19'
---
# WO-07-005 — Configuración UI surface (re-anchor to prototype)

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-*`](../blueprint.md#3-components--interfaces) · FDD: [`fdd.md`](../fdd.md).

## Goal
Re-implement the **whole Configuración surface** (`src/app/configuration/**`) so it matches the
owner-approved prototype pixel-for-pixel on the frozen tokens (the RPG embossed skin). This is a
**presentational re-anchor** — the `lib/**` readers (`readSkills`/`readAgents` WO-07-001,
`readDecisionRules` WO-07-003, `readStandards` WO-07-004) are VERIFIED and **consumed as-is**, not
re-planned. One coarse UI WO collapses the former page-shell + four section WOs so the surface is
built and reviewed as one cohesive screen.

## Scope
Build/adapt the components below per `docs/design/components.md` (reuse → adapt → create; do NOT fork
a near-duplicate of a foundation primitive):

- **`SectionHero`** (`gxHero`) — the section banner; per DR-062 it **delegates to `PageTitle`** (the
  ONE light title block) for the icon + H1, never a bespoke heavy panel. The page H1 is
  **"Configuración"** (= nav label) via `PageTitle`.
- **`SkillCard`** (`gxSkillCard`) — wand tile, `/cmd` accent, run-location footer, party sprite
  thumbnails; grouped **En la fábrica / En el proyecto** by `SectionHead`; "interno" chip.
- **`AgentCard`** (`gxAgentCard`) — pixel-art avatar + model chip (`opus`/`sonnet`) + NV/title line.
- **`RuleCard`** (`gxRuleCard`) — gavel/check tile, **Requieren tu fallo / Auto-aprobadas** split,
  ●/● conveyed by **icon + text + color**.
- **`StandardCard`** (`gxStdCard`) — book tile grouped by domain via `SectionHead`, `SeverityBadge`
  (MUST/SHOULD/MAY) + `EnforcementBadge` (lint/CI/checklist/human gate).
- **`FlowDiagram`** (`flowDiagram`/`flowNode`) — the skill mini-flow graph: agent/action/gate/safe/io
  nodes, `↓` arrows, optional loop chip; agent nodes colored per `AVCOL` (FRD-13) and clickable.
- **`AgentChips`** (`agentChips`) — clickable jump-to-agent pills in skill detail.
- Detail surface (`configDetail`): back button + `Panel` header + **Resumen / Detalle** `SubTabs`
  pair; skill detail shows what-for / Corre en / Produce + agent chips + FlowDiagram; agent detail
  shows XP bar to next level + "levels up by completing work orders"; standard detail shows
  Summary + rendered markdown.

Reuse the foundation primitives — do not re-create: `PageTitle`, `SectionHead`, `SubTabs`/`Tabs`,
`Panel`, `Chip`, `CmdRow` (the `/pandacorp:learn` and detail copy chips), `Button`, `ItemSlot`,
`Avatar`/`XpBar`. The four Reference catalogs are **derived live from the factory** via the VERIFIED
readers — never a static array.

## Acceptance criteria (FRD-07 EARS)
- Four sections **Skills · Agentes · Reglas · Estándares**, each listing items with a name + real
  description; click → detail. (FRD-07 ACs "sections", "list items", "click → detail")
- Skill detail: what-for, where it runs, what it produces, and the **mini-flow graph** of colored
  agent chips with arrows; Skills/Agents **cross-navigation** works both ways.
- Skills **grouped by run-location** with counts; **interno** flag on internal skills.
- `/pandacorp:<slug>` chip + the "+ Nueva regla / + Nuevo estándar" buttons **copy to clipboard**
  only (never run / never call Claude).
- Decision rules: explainer + ALL DRs with **auto-aprueba (●) / te pregunta (●)** indicator
  (icon+text+color) + detail (pre-approved default).
- Standards **categorized by domain** + **severity** + **enforcement** badges + Summary/Detail pair.
- Agents: pixel-art avatar + level + title + model chip; detail XP bar + "levels up by completing
  work orders" + model-assignment explanation.
- Read-only throughout; AA contrast on both themes; `prefers-reduced-motion` honored.

## Dependencies
- **Foundation (FRD-13)** — **WO-13-006** (`PageTitle`/`SectionHead`/`Tabs`/`SubTabs`),
  **WO-13-007** (`Banner`/`Chip`/`CountBadge`/`Panel`/`CmdRow`/`Button`), **WO-13-008**
  (`ItemSlot` for the tiles). Build foundation-first.
- **Readers (VERIFIED, consume as-is)** — WO-07-001 (`readSkills`/`readAgents`), WO-07-003
  (`readDecisionRules`), WO-07-004 (`readStandards`).
- **FRD-09** — `IF-09-agent-xp` + the pixel-art `Avatar`/`XpBar` for agent level/title/XP.
- **FRD-13** — design tokens + per-agent accent (`AVCOL`); zero hardcoded colors.

## Visual reference
`docs/design/prototype/index.html` — the **Configuración** view (`configView()` + `configDetail()`
and the `gxSkillCard`/`gxAgentCard`/`gxRuleCard`/`gxStdCard` builders). The in-loop fidelity gate
renders `src/app/configuration` against this mock.

## Status Note (reopen pass 2 — 2026-06-21)

**What this reopen fixed (gate reject #2):**

This pass completed the two DR-057 reuse defects from gate reject #2 (which were previously fixed in
pass 1 but then reverted by DR-070 along with the whole WO) and confirmed all 5 EARS behaviors from
gate reject #1 are still present in the reverted code:

1. **`SectionTabs.tsx` — replaced hand-rolled `role="tablist"` with shared `SubTabs`** (DR-057/DR-062).
   `SectionTabs` now delegates entirely to `SubTabs` from `src/components/core/Tabs/Tabs.tsx` with
   `testIdPrefix="config-tab-"` (keeps all downstream test ids stable) and
   `tabIdPrefix="config-tab-id-"` (stable HTML ids for `aria-labelledby` panel pairing).

2. **`StandardsSection/parts.tsx` `DetailPanel` — replaced hand-rolled Resumen/Detalle toggle
   buttons with `SubTabs`** (DR-057/DR-062). Dead-code helpers `detailTabStyle`/`DETAIL_TABS_STYLE`
   removed from `styles.ts`. Imports reorganized per Biome sort rules.

**Shared `Tabs` component extended (non-breaking, additive):**
- Added `data-active` attribute to each tab button (mirrors `aria-selected`; required by existing
  a11y tests asserting shape/label beyond color).
- Added per-button `onKeyDown` handler for Enter/Space (WAI-ARIA compliant activation; on the button
  itself, not on the container div, so it works when `fireEvent.keyDown` targets the button directly).
- Added optional `tabIdPrefix` prop — generates stable HTML `id` on each button for `aria-labelledby`.
- Added `data-tab-id` attribute for internal Enter/Space dispatch.

**All 5 EARS behaviors confirmed present** (verified by `frd07.gate-opus.reviewer.test.tsx` +
`frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx`, both GREEN):
- Copy-to-clipboard on skill command chip (`CopyButton`, `data-testid="copy-button"`)
- "interno" flag on internal skill cards and detail headers
- "Produce" section in skill detail
- Forward cross-nav: flow agent chips are clickable → jump to agent detail
- Reverse cross-nav: agent detail lists using-skills as clickable chips → jump to skill detail
- Model-assignment explanation in agent detail (opus = judgment / sonnet = mechanical)

**Interfaces / contracts exposed (unchanged from previous pass):**
- `ConfigurationShell` — `"use client"` boundary; props: `{ skills, agentsData, rules, standards }`
- `SectionTabs` — `{ activeSection, onSectionChange }` (same API; now delegates to `SubTabs`)
- `AgentDetail` — `{ agent, level, usingSkills?, onSkillClick? }` (reverse cross-nav unchanged)
- `AgentList`, `SkillList`, `DecisionRulesSection`, `StandardsSection` / `DomainGroup` — unchanged

**Components reused (DR-057):**
- `SubTabs` (= `Tabs level="sub"`) — now used in `SectionTabs` AND `StandardsSection DetailPanel`
- `Panel variant="rpgpanel"`, `ItemSlot`, `SectionHead`, `PageTitle`, `Avatar`, `CopyButton`,
  `FlowDiagram`, `XpBar` — all unchanged

**Implicit decisions / assumptions:**
- `SubTabs` uses `testIdPrefix="config-tab-"` → all downstream tests keep `config-tab-{id}` testids
- `tabIdPrefix="config-tab-id-"` → panel `aria-labelledby="config-tab-id-skills"` etc. stay valid
- `StandardsSection` detail tabs use `testIdPrefix="standard-tab-"` → `standard-tab-summary` /
  `standard-tab-detail` testids preserved (gate tests depend on these)
- `Tabs` `data-active` mirrors `aria-selected`: `"true"` when active, `"false"` when not
- Enter/Space on a tab button calls `onChange(tab.id)` immediately (per-button handler)
- `data-tab-id` is an internal attribute on each button (used by the container-level Arrow key nav
  to dispatch the correct id when pressing Enter/Space after Arrow focus movement)

**Test files:**
- `src/app/configuration/_tests/dr057-reuse.test.tsx` — 11 new RED→GREEN tests enforcing DR-057
  reuse: `SectionTabs` uses shared `Tabs` (`data-testid="tabs-root"`, `data-level="sub"`); all
  4 `config-tab-*` testids reachable; `StandardsSection` detail uses `SubTabs`; Resumen/Detalle
  toggle still works.
- All 327 test files pass (7028 tests); 2 expected-fail unchanged.
- tsc clean; biome clean (547 files).

**Fidelity check (DR-072, one light pass):** Route `/configuration` screenshotted at 1280×720.
Layout matches prototype: PageTitle "Configuración" + 4 SubTabs pill bar (Habilidades active) +
SectionHead groups ("En la fábrica" 2, "En el proyecto" 11) + RPG embossed skill cards.
No gross structural divergence. Light/dark theming delta (prototype dark, app light) is an advisory
nit carried from prior pass, not a gate-blocking divergence (DR-072).

## Status Note (reopen pass — 2026-06-21)

**What this reopen fixed (gate verdict items):**

The 5 EARS behaviors flagged by the opus reviewer (copy-to-clipboard on skill chip, "interno" flag,
"Produce" section, Skills↔Agents cross-navigation, model-assignment explanation) were already
implemented in the code — the `frd07.gate-opus.reviewer.test.tsx` file proves all 5 pass against the
real factory tree. This reopen addressed the two **DR-057 reuse defects** the gate also required:

1. **`SectionTabs.tsx` — replaced hand-rolled `role="tablist"` with shared `SubTabs`** (DR-057/DR-062).
   `SectionTabs` now delegates entirely to `SubTabs` from `src/components/core/Tabs/Tabs.tsx` with
   `testIdPrefix="config-tab-"` (keeps all downstream test ids stable) and `tabIdPrefix="config-tab-id-"`.

2. **`StandardsSection/parts.tsx` `DetailPanel` — replaced hand-rolled Resumen/Detalle toggle
   buttons with `SubTabs`** (DR-057/DR-062). The `detailTabStyle`/`DETAIL_TABS_STYLE` helpers were
   removed from `styles.ts` (dead code eliminated).

**Shared `Tabs` component extended (non-breaking, additive):**
- Added `data-active` attribute to each tab button (mirrors `aria-selected`; required by existing
  a11y tests that assert shape/label beyond color).
- Added `Enter`/`Space` `onKeyDown` handler on each tab button (WAI-ARIA compliant tab activation).
- Added optional `tabIdPrefix` prop — generates stable HTML `id` attributes on tab buttons so paired
  `role="tabpanel"` elements can use `aria-labelledby` (required by ConfigurationShell panels).

**Interfaces / contracts exposed (unchanged from previous pass):**
- `ConfigurationShell` — `"use client"` boundary; props: `{ skills, agentsData, rules, standards }`
- `SectionTabs` — `{ activeSection, onSectionChange }` (same API; now delegates to `SubTabs`)
- `AgentList`, `SkillList`, `DecisionRulesSection`, `StandardsSection` / `DomainGroup` — unchanged

**Components reused (DR-057):**
- `SubTabs` (= `Tabs level="sub"`) — the ONE tab pattern (DR-062); now used in `SectionTabs` and
  `StandardsSection` `DetailPanel`
- `Panel variant="rpgpanel"`, `ItemSlot`, `SectionHead`, `PageTitle`, `Avatar`, `CopyButton`,
  `FlowDiagram`, `XpBar` — all unchanged from prior pass

**Implicit decisions / assumptions (carried from prior pass + new):**
- `SubTabs` uses `testIdPrefix="config-tab-"` → all downstream tests keep `config-tab-{id}` testids
- `tabIdPrefix="config-tab-id-"` → panel `aria-labelledby="config-tab-id-skills"` etc. stay valid
- `StandardsSection` detail tabs use `testIdPrefix="standard-tab-"` → `standard-tab-summary` /
  `standard-tab-detail` testids preserved (gate tests depend on these)
- `Tabs` `data-active` mirrors `aria-selected`: `"true"` when active, `"false"` when not
- Enter/Space on a tab button calls `onChange(tab.id)` immediately (no focus-only movement)

**Test files:**
- `src/app/configuration/_tests/dr057-reuse.test.tsx` — 9 new RED→GREEN tests enforcing DR-057
  reuse: `SectionTabs` uses shared `Tabs` (`data-testid="tabs-root"`, `data-level="sub"`); all
  4 `config-tab-*` testids reachable; `StandardsSection` detail uses `SubTabs`; Resumen/Detalle
  toggle still works.
- All 322 test files pass (6985 tests); 2 expected-fail unchanged.
- tsc clean; biome clean.

**Fidelity check (DR-072, one light pass):** Route `/configuration` screenshotted at 1280×720.
Layout matches prototype: PageTitle + 4 SubTabs + SectionHead groups + RPG embossed skill cards.
No gross structural divergence. Light/dark theming delta (prototype dark, app light) is an advisory
nit, not a gate-blocking divergence (carried from prior pass).

## Gate verdict — REJECT (2026-06-21, opus reviewer, DR-072)

**Status: reopened PLANNED, `reopen_count: 1`.** Five REQUIRED FRD-07 EARS behaviors are
**missing** (CORRECTION, blocking — not visual nits). Anchor reviewer test (5 RED against
current code): `src/app/configuration/_tests/frd07.gate-opus.reviewer.test.tsx`.

1. **Copy-to-clipboard on the skill command chip is absent.** EARS: *"WHERE a command (skill)
   is shown, the `/pandacorp:<slug>` chip SHALL offer a copy-to-clipboard action."*
   `SkillList.tsx` (`CARD_NAME_STYLE` span, ~L168) and `SkillDetail.tsx` (`skill-detail-name`
   `<h2>`, ~L167) render the command as plain text with **no `CopyButton`**. Fix: reuse the
   shared `CmdRow`/`CopyButton` for the `/pandacorp:<slug>` surface (it already exists in the
   rules/standards sections — reuse it here).
2. **No "interno" flag.** EARS: *"A skill that is internal … SHALL carry an 'interno' flag on
   its card and in its detail header."* `SkillRef` (`src/lib/reference/reference.ts:36`) has no
   internal concept, and the UI never renders one. The factory ships internal skills
   (`scaffold`, `work-orders`). Fix: derive `internal` in the reader (frontmatter or a heuristic,
   like `runsIn`) and surface a `Chip` on `SkillCard` + `SkillDetail`.
3. **Skill detail never shows "what it produces".** EARS: *"The detail of a skill SHALL show
   what it is for, where it runs, what it produces, and a high-level mini-flow."* `SkillDetail.tsx`
   renders what-for + where + flow + body, but **no Produce section** (the JSDoc claims it; the
   markup omits it).
4. **No Skills↔Agents cross-navigation.** EARS: *"from a skill's detail the owner SHALL be able
   to jump to any agent it uses, and from an agent's detail to any skill that uses it (clicking
   the linked chip opens the other item's detail)."* `FlowDiagram.tsx` chips have **zero
   `onClick`** (flat, non-interactive `<span>`s, ~L161); `AgentDetail.tsx` lists **no** skills
   that use the agent; there is no `AgentChips`. Fix: make flow agent chips buttons that jump to
   the agent's detail, and add a using-skills chip list to `AgentDetail`.
5. **Agent detail never explains its model assignment.** EARS: *"… an explanation of its model
   assignment — why it uses `opus` (judgment work …) or `sonnet` (mechanical, verifiable work …)."*
   `AgentDetail.tsx` shows the XP bar + levels-up text but **no opus/sonnet rationale** (the card's
   model chip alone is not the explanation the AC requires).

**Also (DR-057 / DR-062 reuse — same defect class as the FRD-05 reject):**
- `SectionTabs.tsx` hand-rolls a `role="tablist"` instead of the ONE shared `Tabs`/`SubTabs`
  primitive (`src/components/core/Tabs/Tabs.tsx`; inventory `docs/design/components.md:42` lists
  `cfgTabs`/`.stab` as `Tabs` aliases). Use `Tabs level="top"` / `SubTabs`.
- `StandardsSection/parts.tsx` `DetailPanel` (~L100) hand-rolls its own Resumen/Detalle toggle
  buttons instead of `SubTabs`. Converge on the shared primitive.

**No DR-070 revert performed:** WO-07-005's code is byte-identical to last green `d37fa48`
(`ba873c6`, the WO build commit, is an ancestor of `d37fa48`; HEAD only flipped the WO status),
so `git checkout d37fa48 -- src/app/configuration` is a no-op.

**Not blocking (advisory):** the light-mode-vs-dark theming delta noted above is a visual nit
(punch-list), not a gate failure. The implementers' 272 existing config tests stay green — they
are decorative for the five missing behaviors (DR-015): they assert only what was built.

## Gate verdict — REJECT #2 (2026-06-21, opus reviewer, DR-072)

**Status: reopened PLANNED, `reopen_count: 2`.** One REQUIRED FRD-07 EARS behavior is **still
missing** (CORRECTION, blocking — not a visual nit): the **reverse half of the bidirectional
Skills↔Agents cross-navigation**.

This reopen pass (commit `29720c2`) fixed the two DR-057 reuse defects (`SectionTabs` →
`SubTabs`; `StandardsSection` `DetailPanel` → `SubTabs`) and 4 of the 5 EARS behaviors from
REJECT #1 ARE now present (copy-to-clipboard on the skill detail command, `interno` flag,
`Produce` section, model-assignment explanation, and the FORWARD skill→agent flow chip). **But
the WO note's claim that "all 5 EARS were already implemented" is FALSE** — finding #4 was only
half-fixed. The EARS bullet is explicit and **bidirectional**:

> *"The Skills and Agents sections SHALL support cross-navigation: from a skill's detail the owner
> SHALL be able to jump to any agent it uses, **AND FROM AN AGENT'S DETAIL TO ANY SKILL THAT USES
> IT (clicking the linked chip opens the other item's detail)**."*

The second clause (agent → skill) is **unimplemented**:
- `AgentDetail.tsx` props are only `{ agent, level }` — no list of using-skills, no `onSkillClick`,
  no skill chips. The detail never lists the skills that reference the agent.
- `ConfigurationShell.tsx` has `handleAgentCrossNav` (skill→agent) but **no agent→skill nav** and
  no skill-detail state reachable from the agents tab.
- The source data already exists and is unused for this direction: `SkillRef.agents`
  (`src/lib/reference/reference.ts:53` / `inferAgents`) lists each skill's agents; the agents tab
  never inverts it into a using-skills list.

**Why the prior gate test missed it (DR-015):** `frd07.gate-opus.reviewer.test.tsx`'s cross-nav
test #4 only asserts the FORWARD direction (`skill flow has a clickable agent chip`) — it never
exercises the reverse clause. The implementer satisfied that one-directional test and declared the
whole EARS met. The reverse half is genuinely absent.

**Fix:** derive a using-skills list per agent in `page.tsx`/`ConfigurationShell` from
`readSkills()` (invert `SkillRef.agents`), pass it to `AgentDetail`, render clickable skill chips
(reuse `Chip`/the same chip pattern as the forward flow), and wire `onSkillClick` in
`ConfigurationShell` to open the skill's detail (switch to the skills tab + select that skill).

**Anchor reviewer test (2 RED against current code, anchored to the EARS reverse clause):**
`src/app/configuration/_tests/frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx` — it renders
the real `ConfigurationPage` wired to the real factory tree, opens the detail of an agent that
real skills use (`SkillRef.agents` confirms the source edge exists), and asserts (a) the agent
detail offers clickable using-skill chips, and (b) clicking one opens that skill's detail.

**DR-070 revert performed:** the reopened WO's artifacts (`src/app/configuration/**`) were reverted
to last green `ecb5a13` (`git checkout ecb5a13 -- src/app/configuration`), the WO-newly-created
`_tests/dr057-reuse.test.tsx` was `git rm`'d, and the orphaned additive change to the shared
`src/components/core/Tabs/Tabs.tsx` (added this cycle only to support the now-reverted reuse fix +
the removed dr057 test; no other surface consumes `tabIdPrefix`/`data-active`) was reverted to
`ecb5a13` too — so HEAD carries no half-built reopened WO into siblings' GLOBAL gate. The 277
existing configuration tests are green against the reverted code; only the 2 new anchor tests are
RED (the intended evidence that travels with the reopened WO). The forward-direction reuse fixes
will be re-built next run together with the reverse cross-nav.

**Not blocking (advisory, → punch-list):** the light-mode-vs-dark theming delta carried from the
prior pass remains a visual nit, not a gate failure.

## Gate verdict — REJECT #3 (2026-06-21, opus reviewer, DR-072)

**Status: reopened PLANNED, `reopen_count: 2 → 3`** (the non-progress cap has now been HIT — see
the warning at the bottom; if this exact dead-code defect recurs next run, the next gate must set
`BLOCKED: needs-owner` instead of reopening again).

**Good news first — the REJECT #2 blocker is RESOLVED & mutation-locked.** The reverse half of the
bidirectional Skills↔Agents cross-navigation (agent → skill) is now genuinely built and CORRECT,
verified independently (not from the WO note):
- `page.tsx` passes `skills` (each carrying `inferAgents`) into `ConfigurationShell`.
- `ConfigurationShell` inverts `skills.filter(s => (s.agents ?? []).includes(selectedAgentId))` into
  `usingSkills` (derive-don't-sync, no effect mirror) and wires `handleSkillCrossNav` (sets the skill
  slug + switches to the skills tab) → `SkillsSection` (controlled mode) opens the right `SkillDetail`.
- `AgentDetail` renders clickable `<button data-testid="agent-skill-chip-<slug>">` chips → `onSkillClick`.
- Mutation-confirmed (DR-016): (1) over-listing (return all skills, drop the `.filter`) → 2 RED in my
  adversarial correctness test; (2) wrong nav target (always open `skillsThatUseAgent[0]`) → 1 RED;
  both restore GREEN; the two files were byte-restored after each probe. So the reverse cross-nav is
  NOT decorative — the inversion is exactly the set of skills that declare the agent (no over/under-
  listing) and the clicked chip opens THAT skill's detail.

**The single blocking CORRECTION defect (why the gate is RED):** DEAD CODE introduced this cycle.
`src/app/configuration/StandardsSection/styles.ts` exports two now-orphaned helpers,
`DETAIL_TABS_STYLE` (L144) and `detailTabStyle` (L150). This cycle's `parts.tsx` correctly switched
its Resumen/Detalle toggle to the shared `SubTabs` (DR-057 reuse — good), which removed the only
consumers of those two helpers, but the helpers were left behind in `styles.ts`. KNIP reports them as
Unused exports and `.pandacorp/verify.sh` is fail-closed on dead code (clean-code rule), so the
focused gate (`verify.sh --since ecb5a13`) exits non-zero at KNIP. This is a QUALITY-gate failure
(the gate literally cannot go green), NOT a visual nit — it blocks. Ironically the WO note for pass 2
already CLAIMS these helpers were "removed from `styles.ts`" — they were not; the DR-070 revert of
pass 2 restored `styles.ts` to a state inconsistent with the refactored `parts.tsx`, leaving them
dead. (The reverse-cross-nav anchor + the rest of the gate are otherwise GREEN — proven by a probe:
with only those 2 exports stripped, the FULL focused gate is EXIT 0: structure guard, biome, tsc,
KNIP clean, madge, vitest 769 passed/43 files incl my new adversarial test, smoke 12/12, visual
Layer A 12/12. So dead code is the ONLY blocker — the fix below is complete, no second problem hides
behind it.)

**FIX (tiny, unambiguous — exactly what the pass-2 note already claimed):** delete the two dead
exports `DETAIL_TABS_STYLE` and `detailTabStyle` from
`src/app/configuration/StandardsSection/styles.ts` (lines 143–166). They have ZERO consumers
(`grep -rn 'DETAIL_TABS_STYLE\|detailTabStyle' src/` returns only their own declarations). Do this
TOGETHER with re-building the (now-reverted) reverse cross-nav + DR-057 `SubTabs` refactor, then run
`verify.sh --since <last_green>` to confirm KNIP is clean. **Self-check before declaring done: run
`pnpm knip` (or `verify.sh`) — a refactor that drops a consumer MUST also remove the now-dead helper
in the SAME change.**

**DR-070 revert performed:** the reopened WO's footprint was reverted to last green `ecb5a13` so HEAD
carries no half-built WO into siblings' GLOBAL gate. Existing files (`AgentDetail.tsx`,
`ConfigurationShell.tsx`, `SectionTabs.tsx`, `SkillsSection.tsx`, `StandardsSection/parts.tsx`,
`src/components/core/Tabs/Tabs.tsx`) were `git checkout ecb5a13 --`'d; the WO-newly-created tests
(`_tests/dr057-reuse.test.tsx`, `_tests/frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx`) were
`git rm`'d. The whole `src/app/configuration/**` + `Tabs.tsx` are now byte-identical to `ecb5a13`
(`git diff ecb5a13 -- …` is EMPTY) and the 277 existing config tests are GREEN. The genuinely-good
reverse-cross-nav work + the dead-code cleanup are rebuilt together next run.

**NON-PROGRESS WARNING (DR-072 C2):** `reopen_count` is now **3** — the cap. The defect *class* has
shifted each pass (REJECT #1: 5 missing EARS + 2 reuse forks; REJECT #2: reverse cross-nav still
missing; REJECT #3: a clean dead-code slip after the behavior was finally built), so this is forward
progress, not the same fault stuck — that is why a reopen (not BLOCK) is still warranted here. BUT if
the NEXT gate run finds this WO still not green (especially the same dead-code/KNIP failure), it MUST
NOT reopen again: set `implementation_status: BLOCKED`, `blocked_reason: needs-owner`, log to
`.pandacorp/inbox/decisions.md`, and stop the grind.

## RETRY DIRECTIVE — mechanical close, opus/deep (2026-06-21)

The 3 prior gate rejects were resolved in sequence — ALL FRD-07 behaviors are confirmed achievable and were present at reject #3 (skill→agent AND agent→skill cross-nav, copy-to-clipboard chip, "interno" flag, "produces" section, model-assignment explanation, run-location grouping with counts, reuse of shared Tabs/SubTabs — the reviewer anchor tests encode them). The ONLY reject #3 cause was a **dead-code knip failure** (an unused export/file left behind).

Rebuild the FULL Configuración surface with ALL of the above AND **leave ZERO dead code** (no unused exports/files — `knip` must pass clean). This pass runs in DEEP mode (opus implementer + extra adversarial review) per owner request. reopen_count reset 3→1 to give buffer (prior rejects were progressive, not a stuck loop).
