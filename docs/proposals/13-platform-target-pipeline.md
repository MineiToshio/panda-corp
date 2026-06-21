# Proposal 13 — Platform target as a first-class, pipeline-propagated decision

> Status: DRAFT for owner review (red-team pending). Author: factory supervisor, 2026-06-21.
> Origin: Mission Control shipped desktop-first / non-responsive. Owner-stated principle:
> "the target platform (desktop / mobile / both) must be decided when the app is DEFINED, and
> from there flow into design, blueprint, work orders, implementation AND the verification gates."

## The problem (evidenced in MC)

MC is **not responsive** (verified at 390px: the GuildBar overflows on every page, the Tablero kanban overflows horizontally, Portfolio's rail+table doesn't collapse, the project workspace has no mobile baseline at all). It shipped GREEN anyway. Three root causes, each a pipeline stage that didn't carry the platform intent:

1. **Definition (spec/PRD): no explicit platform decision.** `spec/SKILL.md` step 4 (PRD) captures vision/users/scope/monetization/metrics — but **nothing about target platform**. So "who is this for, on what device" is never decided; it's left implicit.
2. **Design: the intent exists but isn't enforced or propagated.** `design/SKILL.md` *says* "mobile-first" + screenshots at 375px/1280px — but the **ADOPT-VISUAL path** (which MC used) shards whatever prototype exists; MC's prototype was **desktop-only**, so every per-FRD `mocks/` shard was desktop-only. The 375px screenshot is an owner-gate visual, not an enforced contract, and `design.md` (the standard) says **nothing** about responsive/platform.
3. **Implement gate: it blesses baseline-MATCH, not responsiveness.** The visual gate (`e2e/visual.spec.ts`, playwright "mobile" project = Desktop Chrome @ 390px) passed GREEN because `toMatchSnapshot` only checks "matches its OWN committed baseline" — and the baseline WAS the overflowing layout. Consistency, not correctness. The workspace route had no mobile baseline at all.

## The change — decide the platform at definition, propagate it to every stage

**A new tracked field `target_platforms` ∈ { `desktop`, `mobile`, `responsive` (both) }** (default `responsive`), decided at definition and threaded through:

1. **Spec / PRD** (`spec` skill + PRD template): the PM **decides + records `target_platforms`** in the PRD (a one-line product decision with rationale — who uses it on what device), and mirrors it as a machine field (`.pandacorp/status.yaml` `target_platforms` and/or PRD frontmatter). For a personal/internal tool it's an explicit choice too (MC is "responsive" because the owner wants it on his phone).
2. **Design** (`design` skill + `design.md` standard): produce + verify mocks for the **declared** platform(s).
   - **EXPLORE path**: mockups at the target breakpoints (375px for mobile/both, 1280px for desktop/both) — already "mobile-first", now tied to the declared target.
   - **ADOPT path (the MC gap)**: before sharding, **CHECK the adopted prototype actually covers the target platforms**. If `target=responsive` but the prototype is desktop-only → FLAG it: the prototype/mocks need mobile layouts before sharding (don't silently ship desktop shards as "responsive"). Each per-FRD `mocks/` carries the layouts for the declared platforms.
   - `design.md` codifies the rule (today it says nothing).
3. **Blueprint / work-orders**: the responsive/platform requirement becomes **explicit acceptance criteria** the WO carries (a UI WO whose FRD targets mobile/both states the responsive behavior: stack vs horizontal-scroll, breakpoints, no-overflow), so the implementer builds it and the gate can check it — not an unwritten assumption.
4. **Implement + gates** (the enforcement, the MC failure's real fix): when `target_platforms` includes mobile —
   - **A mechanical no-horizontal-overflow assertion** in the smoke/visual gate at mobile width (e.g. `document.documentElement.scrollWidth <= viewport.width + tolerance`, per route) — catches the exact MC failure BEFORE a baseline is blessed. Fail-closed.
   - The reviewer's visual lens checks **responsiveness** (stacks/fits/usable), not just baseline-match; a mobile baseline is only blessed once it's responsive-correct.
   - Every route in `e2e/routes.ts` is gated at the declared platform widths (incl. the workspace, which MC skipped).
5. **Standards + registry**: `design.md` (platform decision + responsive rule + per-platform mocks), `quality.md` (the overflow gate), `build-orchestration.md` (gate behavior), registry **DR-074**.

## Feasibility

- **Spec/PRD field: HIGH** — one decision + one field + PRD-template line.
- **Design: MEDIUM** — the EXPLORE path already screenshots 375/1280; the new work is the ADOPT-path coverage check + codifying it in `design.md`. For `responsive`, the design phase produces/keeps both layouts (more mock work — see risk 3).
- **Blueprint/WO: LOW-MEDIUM** — additive ACs.
- **Gate: MEDIUM** — the mechanical overflow assertion is a small playwright helper, but the smoke/visual specs are authored per-project today (not a stack template), so the pattern must be specified as a standard and/or shipped as an `e2e/` template so it's consistent (today each project re-authors them — that's how MC's gate ended up lenient).

## Pre-identified risks (input for the red team)

1. **Over-engineering / wrong default.** Most web apps should just be responsive. Is a per-project `target_platforms` decision real signal, or ceremony? Maybe "responsive is the enforced default; desktop-only/mobile-only is the rare opt-out" captures ~all the value with less process.
2. **Is "no horizontal overflow at 390px" a sufficient / reliable responsiveness gate?** It catches overflow but not tiny tap targets, unusable density, or content hidden off-canvas. And it can **false-positive** on *intentional* horizontal scroll (a wide data table / a kanban designed to scroll-x with snap). The gate must distinguish broken overflow from intentional scroll — how?
3. **Design effort doubles for `responsive`** (mocks/verification at 2+ breakpoints). Is that sustainable, or should responsive rely on the design system + fluid layout rather than per-breakpoint mocks?
4. **The ADOPT-path coverage check** — how to enforce "the prototype covers the target platforms" without blocking every adopt on a full mobile redesign? Degrees: warn vs hard-block.
5. **Retrofit** — existing projects (MC) have no `target_platforms` and desktop-only mocks. Migration path?

---

# RED-TEAM RESULTS (3 adversarial agents, opus) + v2 design

Unanimous: the v1 was OVER-ENGINEERED. The rule already exists (`styling-and-ui.md:25` "no overflow on any device size"; `design/SKILL.md:23` "mobile-first" + 375/1280 screenshots) — MC shipped non-responsive ANYWAY → the failure is **non-enforcement, not a missing field**. ~80% of the value is in ONE stage (the gate), and the proposed gate is both unreliable and doesn't ship.

## Findings
1. **Naïve overflow gate is unreliable (red-team B).** `scrollWidth<=width` FALSE-POSITIVES on MC's legitimate scroll-x kanbans (`/board` IdeaBoardView `overflowX:auto`, WoDag SVG) → false reds implementers game by wrapping in `overflow:hidden` (which CREATES clipping bugs). And FALSE-NEGATIVES on what MC actually shipped: content clipped off-canvas (`overflow:hidden`), 8px tap targets, fixed GuildBar occluding `<main>`, crushed columns — all pass. The "reviewer visual lens" is the SAME mechanism that blessed MC's broken baselines.
2. **The gate doesn't ship (red-team C).** `verify.sh` only checks the `test:smoke`/`test:visual` SCRIPT STRING exists; the `e2e/*.spec.ts` are authored PER-PROJECT and ship in NO stack template (`find stack-*/ -name '*.spec.ts'` → empty) — that's WHY MC's gate was lenient. Prose in a standard repeats DR-055's mistake.
3. **No retrofit (red-team C).** `upgrade` conformance-checks `verify.sh`/`biome`/`knip` but never the e2e spec bodies nor a platform field; `adopt` captures no platform. Brownfield never gets it.
4. **Threading through 5 LLM-prose stages = ceremony (red-team A).** The field is 90% set to the same value (`responsive` — even MC); per-breakpoint mocks ~double design effort and contradict "one mock per FRD" + the fluid-layout mandate.

## v2 — the minimal, robust design (DR-074)
1. **Ship the gate as VERBATIM stack templates (the real fix).** Add `stack-a-nextjs/e2e/{smoke.spec.ts,visual.spec.ts,routes.ts}` + a responsive helper, propagated by `blueprint` (install) + conformance-checked by `upgrade` — the DR-059 mechanism that already works for `verify.sh`/`biome.json`/`knip.json`. Kills the per-project-lenient-authoring root cause + gives retrofit for free.
2. **Smart responsive gate (not naïve).** At each declared mobile width, per scroll-root: RED if `scrollWidth>clientWidth+tol` UNLESS the container is author-marked `data-scroll-x="intentional"` (kanban/DAG/wide-table mark once — broken-vs-intentional is AUTHOR-DECLARED, not heuristic). PLUS flag silent-clip (`overflow:hidden` wider-than-container), tap-target (reuse axe `target-size`, already in `quality.md`), and `<main>` not occluded by fixed elements.
3. **Responsive = enforced default.** No per-breakpoint mocks (responsiveness from the fluid design system + the gate; one mock per FRD).
4. **One machine field** `target_platforms` ∈ {desktop|mobile|responsive} in `.pandacorp/status.yaml` (default `responsive`), read ONLY by the gate to choose which widths to assert. desktop-only/mobile-only = a one-line opt-out. **CUT** the threading through design/blueprint/WO prose as separate enforcement.
5. **Lightweight spec note (owner's "decide at definition"):** the PRD records the platform target in one line (documents intent + sets the field) — documentation, not the enforcement (the gate is). Optional per owner.
6. **Retrofit:** `upgrade` installs the e2e templates + conformance-checks them + back-fills `target_platforms: responsive`; `adopt` sets the field. MC then gets the real gate.

Net: fixes MC's actual failure (lenient per-project gate blessed a broken layout) at the root, robustly, at roughly the gate-only cost — dropping the per-stage ceremony.
