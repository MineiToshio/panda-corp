# 42 — Absorb: Claude Design moves into Claude (standalone sunset 2026-12-14)

> Status: **PROPOSED — awaiting owner approval** (absorb step 1). Nothing executed yet.
> Date: 2026-10-10 · Produced by `/pandacorp:absorb`.

## Manifest

| Field | Value |
|---|---|
| Source | https://support.claude.com/en/articles/17440474-migrate-from-standalone-claude-design-to-claude |
| Type | Article (Anthropic help center) + additional web research + live probe of this Claude Code session (v2.1.286) |
| License | Proprietary Anthropic docs — summarized, not reproduced |
| Local cache | `../pandacorp-research/claude-design-migration/source.md` (outside the repo) |

---

## 1. What it is & what it's for

**Claude Design is moving house.** Until now it was a separate app (`claude.ai/design`): a canvas where Anthropic's model drew screens, and our factory talked to it *through a window*, by pasting prompts into the owner's browser and polling files back with `DesignSync`. Now the canvas becomes **a kind of page inside Claude itself**, an *Artifact*, that any Claude session (including Claude Code) can create and fill **directly**, with no window to talk through.

Analogy: before, we were sending letters to a design studio across town and checking the mailbox every 90 seconds. Now the studio's drawing table is in our own office. **But the designer at that table is our own agent.**

## 2. Main features

**The sunset (source article)**
- Standalone `claude.ai/design` **closes 2026-12-14**, then redirects to Claude.
- New designs, design systems and slide decks are **Artifacts**.
- Design systems migrate org-wide from a banner on the Artifacts page. Migrated systems can't be edited on their page yet ("ask Claude").
- **Projects do NOT migrate** (a path is "coming"). Export them one at a time: Share → Project HTML → Project archive (.zip, free).
- **Chats and comments are lost.** Public project links die on 2026-12-14.

**What exists now (verified live in this session)**
- **Artifact types:** `Design`, `Design System`, `Slides`, `Docs` and `Dashboard`.
  - **Design** is a canvas: `project/canvas.json` plus one `project/<name>.dc.html` per artboard (the `x-dc` runtime).
    - Tweak levers come from `data-props`.
    - Prototype links and interactive boards are supported.
    - A full web page can be an artboard that is fluid and must work at phone width.
    - It supports comments, downloads and a shared database.
  - **Design System** holds a README (the brand book), `tokens.json`, live component previews (`@dsCard`), a bundle and assets.
    - Its `tokens.json` uses a **LIST shape with light/dark themes. It is NOT the DTCG map format, and not our `design-tokens.json` shape either.**
    - Systems can be built from code (`from-code.md`).
- `Artifact action:quickstart intent:design` picks the type plus the account's **default** design system. The owner's account has none today.
- **`DesignSync`'s own description now says:** "Never use it to make a design, deck or prototype: those are made from a Slides or Design Artifact type with the Artifact tool." It still talks only to standalone design-system projects.
- The Design type's own SKILL says **"NEVER VERIFY UNLESS THE USER ASKED"** (no render or screenshot of the canvas).

**From web research (official unless marked)**
- Claude Code has a native **`/design <brief>`** command (research preview, ≥ v2.1.265): it drafts artboards, publishes a Design artifact, then *implements* the one you pick. **`/slides`** works the same way. ([artifacts docs](https://code.claude.com/docs/en/artifacts), [w34](https://code.claude.com/docs/en/whats-new/2026-w34))
- `/design-sync` (best for code-first React systems) and `/design-login` are still listed. ([commands](https://code.claude.com/docs/en/commands))
- Design, Slides and Docs are included on every plan. ([claude.com/product/design](https://claude.com/product/design)) *Unverified, third-party:* GA came on 2026-10-08.
- Publishing artifacts needs a **claude.ai login**. It does not work on API-key, Bedrock, Vertex, ZDR or HIPAA, and is off by default in `-p` and the SDK.
- Usage now shares the pool with chat and Claude Code; there is no separate design allowance.
- Known issues: no version history, multi-person editing is unreliable, and output has a recognizable "house style" unless a design system is supplied. ([get started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design), [eesel review](https://www.eesel.ai/blog/claude-design-review-2026), third-party)

---

## 3. What Pandacorp gains / is exposed to

**Exposure (where we depend on standalone)** comes only from the **generation** step. Everything downstream reads local HTML in `docs/design/prototype/` and `docs/frds/*/mocks/`: the engine, the reviewer's DR-056 fidelity gate, the work orders, and the smoke and shell gates. That part is unaffected.

- `plugin/skills/design/SKILL.md` Step 0: the engine table and facts block (:20-36). Claude Design is the EXPLORE default.
- `plugin/skills/design/references/canvas-procedure.md`: the whole relay ladder (chrome → clipboard → manual), `DesignSync` polling, and the `_ds_manifest.json` → `components.md` bridge.
- `factory/standards/design.md` §1c (:52-159). DR-058 and DR-109 depend on standalone entirely, and so does DR-081's mirror clause.
- **`plugin/agents/designer.md:33`** tells the agent to generate "with the `/design-sync` skill + `DesignSync` tool". **The tool now forbids exactly that.** The Codex mirror says the same.
- Also: `constitution.md:32`, `AGENTS.md:97`, `agent-portability.md`, `skill-capabilities.json`, BL-0058 (open, p1, chrome relay) and BL-0117 (rejected because "no Artifact tool surface", which is **no longer true**).
- **Projects at risk:**
  - **pandacast** (phase `design`, `advance_pending: true`): its runnable `_ds_bundle.js` lives **only** in canvas project `a560df2e…`, because it was over the DesignSync 256 KiB cap. The prototype cards do not render in-repo without it (`pandacast/docs/design/prototype/README.md:23-29`).
  - personal-page-v2 (canvas `611c52f0…`; it already has an in-repo prototype).
  - Mission Control is ADOPT-VISUAL with no dependency, but its app copy says design "uses Claude Design" (`phases.ts:139,151`, Manual pages, FRD-02 AC-02-010.8).

**Gains on offer**
1. **The relay is gone.** No more chrome/clipboard courier work and no polling. BL-0058 becomes moot.
2. **A real review surface for the owner.** Screens side by side, viewable on the phone, comments the agent reads back (`ArtifactComments`), and tweak sliders.
3. **The design system can be enforced on the canvas**, by mounting a system so artboards use exact tokens.
4. **Mockups become shareable links** (BL-0117's original goal).

---

## 4. Improvement proposal (draft, before the red team)

| # | Move | Plane |
|---|---|---|
| P0 | **Rescue** the pandacast and personal-page-v2 canvas projects (zip export into the repo) before 2026-12-14 | project (owner action) |
| P1 | New EXPLORE engine: the agent drives a **Design artifact** directly, which replaces the relay. Keep the DR-101 cadence, the tracker and the §12 rubric. Supersede DR-058/109. | plugin skill + standard → `learn` |
| P2 | A Design System artifact as a **one-way projection** of `design-tokens.json` (the repo stays the SSOT, DR-115), installed into the canvas. Never set it as the account default. | plugin skill → `learn` |
| P3 | **Freeze-export contract:** approved artboards become renderable local HTML for the DR-056 chain (spike first) | plugin → BL |
| P4 | **Retire DesignSync from generation:** fix `designer.md:33`, close BL-0058, reopen BL-0117 | plugin → BL |
| P5 | Sweep the cross-references (standards, constitution, portability, sync, adopt, templates) | factory → BL |
| P6 | Mission Control copy "Claude Design" → the new wording | project (MC) → `/pandacorp:change` |
| P7 | Lessons: the sunset, DesignSync's new scope, the LIST-shape tokens | memory |
| P8 | Validate on a real UI project (this replaces proposal 22 Phase E) | owner-gated |

---

## Red team (independent, adversarial — opus)

**Key finding: the Design artifact is NOT a fidelity upgrade.**
- Our own agent now writes the artboards, so for **generation quality it is largely hand-written HTML in a better viewer**.
- The old "Claude Design output builds with HIGH fidelity" claim rested on the owner's impression from about one project (proposal 22 F6). LESSON-0141 records four separate failure modes of that same canvas on pandacast.
- Build-time fidelity comes from **our** frozen tokens, the per-FRD shards and the DR-056 gate, and none of that changes.
- **The real win is the review loop** (no relay, comments, phone viewing). Plain HTML artifact pages capture most of that win, with no export problem.

**What we lose:** Anthropic's compiled component library and the `_ds_manifest.json` → `components.md` bridge (DR-057). We also gain a new problem: exporting the `.dc.html` runtime.

**Native `/design`:** its "implement the picked one" step **bypasses our design → architecture → work-order gates**. Use it at most for drafting. It is also a research preview, so expect churn.

| Item | Verdict | Why |
|---|---|---|
| P0 | **KEEP — top, now** | The only irreversible risk. Also commit a check that the archived bundle renders. |
| P1 | **MODIFY** | Sell it as a review loop, not fidelity. The repo copy is the source and is verified locally (§12 + Playwright + axe) *before* the lead session publishes it as a projection. Don't make it the default or write a new DR until P8 passes. |
| P2 | **DEFER** | The LIST converter plus mounting is machinery with nothing proven yet. An inlined `tokens.css` generated from `design-tokens.json` gets 80%. Note the account-default leakage risk now. |
| P3 | **KEEP the spike, run it before P1** | If `.dc.html` can't export cleanly, use plain-HTML artifact pages (BL-0117 reopened). "Never verify" is moot because verification runs on the repo copy. |
| P4 | **MODIFY** | Fix `designer.md:33` now and close BL-0058. **Don't** add Artifact to the designer's tools: whether a subagent can publish (login, approvals) is unverified. The skill's main session publishes; the designer writes files. |
| P5 | **DEFER into one BL item** after P8 | Otherwise the work gets rewritten twice. Only fix SKILL Step 0 and the facts block now, so nothing routes to a dead engine. |
| P6 | **KEEP, low priority** | Do it once the wording is settled (AC-02-010.8 changes too). |
| P7 | **KEEP** | Add: "a tool's own description is the live contract; re-check it before relying on a recorded DR." |
| P8 | **KEEP, as THE gate** | Measure owner courier work, tracker completeness and the reviewer's fidelity punch-list against the pandacast baseline. |

**Overall: modify and shrink.** Only P0 and a small honesty fix to the design skill are needed before 2026-12-14.

**Unverified (flagged):** GA on 2026-10-08, how `/design` behaves, whether DesignSync stops on 2026-12-14 (its description gives no date), whether a subagent can publish Artifacts, and how quota is metered.

---

## Plan (red-team-adjusted, ready for step 6 on approval)

1. **Rescue now** *(project plane, owner action; the agent can't drive the export).*
   - The owner exports the pandacast and personal-page-v2 canvas zips (Share → Project HTML → Project archive).
   - The agent unpacks them into `docs/design/prototype/_canvas-export/`, verifies the cards render locally with the bundle, and commits in each project.
   - Add a dated reminder for 2026-12-07.
2. **Honesty PATCH to the plugin** *(plugin plane → BL → `implement-backlog`).*
   - Fix `designer.md:33` and regenerate the Codex mirror.
   - SKILL Step 0 and the facts block: the standalone canvas is sunsetting 2026-12-14. EXPLORE routes to hand-written HTML until step 4 lands. Drop the "HIGH fidelity" rationale.
   - Close BL-0058 as obsolete. Reopen BL-0117.
   - Add a `plugin/docs/decision-log.md` entry and bump the PATCH version.
3. **Spike, one session** *(plugin plane → BL).*
   - Publish one pandacast screen two ways: as a plain-HTML artifact page and as a Design-type artboard.
   - Test: comments read back through `ArtifactComments`, static-HTML export, phone viewing, and a token mount.
   - Record which one survives, in this memo's Iteration section.
4. **Implement the winner minimally** *(plugin skill + standard → `learn`).*
   - The designer writes repo HTML with an inlined `tokens.css`.
   - The §12 rubric, Playwright and axe run locally first. Then the lead session publishes, and the tracker records the artifact URLs. The owner reviews and comments there; the agent reads the comments and revises.
   - No design-system artifact and no LIST converter yet.
5. **Validate (P8)** on the next UI project.
   - If it passes: one new DR superseding DR-058/109, the P5 sweep (one BL), the P6 Mission Control copy change via `/pandacorp:change`, and reconsider P2.
6. **Memory** *(memory plane):* lessons for the sunset, DesignSync's scope and the LIST-shape tokens, plus "tool description = live contract".
7. **Re-check DesignSync and `/design` after 2026-12-14**, in case Anthropic re-points them.

## Iteration

- 2026-10-10 — Memo created. Awaiting the owner's decision.
- 2026-10-10 — **Owner approved the plan; step 1 (rescue) DONE.**
  - The real canvas inventory, read live in the owner's Chrome, was wider than the repo scan suggested.
    - 5 design systems: PandaCast, PersonalPage v2, **Pandacorp Cockpit** (an early Mission Control exploration, marked **org default**), PandaWatch and CotizaPDF.
    - 2 projects: PandaWatch, plus PandaWatch v2, which is empty and had nothing to export.
  - All 6 non-empty items were exported as Project archives and committed into their repos under `claude-design-archive/`:
    - pandacast `faa7d78`, personal-page-v2 `cfbb0e6`, mission-control `32cc73b4`, manga-watch `8325578`.
    - cotizapdf is **left uncommitted**, because its checkout is on branch `codex/complete-mvp-flow`.
  - PandaCast's cards now render in-repo with `_ds_bundle.js` (verified live: Button and Panel cards, no console errors).
  - New risk for P2: **"Pandacorp Cockpit" is the org DEFAULT design system.** If it is migrated as-is, every new Design artifact would default to it. Before migrating, remove it as the org default, or don't migrate it at all.
- 2026-10-11 — **Owner: merge the CotizaPDF branch, push everything, fix the org default, continue with all the steps.** Done:
  - **Repos.**
    - CotizaPDF: `codex/complete-mvp-flow` was fast-forwarded into `main` (main was its ancestor), the archive was committed and main pushed (`145d1ee`).
    - The other four repos were pushed.
    - Pandacorp Cockpit was **removed as the org default** (verified in the UI).
  - **Step 2:** BL-0229 shipped as plugin **9.121.1** (`d8dcea90`).
  - **Step 3, the spike:** see the verdict in `factory/backlog/BL-0117-*.md`.
    - **A wins:** a static HTML artifact from a Playwright DOM snapshot (https://claude.ai/artifact/3CXVtSguC61VaeMgauagv8).
    - **B loses:** the Design canvas (https://claude.ai/artifact/41xiwkbFNtVmUHMz3eMPe5) needs hand-ported inline-style `.dc.html`, and its HTML export is a 2.2 MB bundled runtime page.
  - **Step 4:** BL-0117 shipped as plugin **9.122.0** (`b1797983`). Design Step 6 publishes the directions as private Artifacts, with local files as the fallback.
  - **Step 6, memory:** 6 notes jotted to `factory/memory/_inbox.md`.
  - **Step 7:** filed as BL-0230 (re-verify after 2026-12-14).
  - **P6:** filed in Mission Control's change queue.
  - **Still owner-attended:** open spike A on the phone and leave one comment, which the agent reads back with `ArtifactComments`.
  - **Still pending:** step 5, validation on the next real UI project. It gates the replacing DR, the P5 sweep and P2.
