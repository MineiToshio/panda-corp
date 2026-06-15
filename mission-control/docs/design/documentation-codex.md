# Guild Codex — the IA of Mission Control's documentation

**Design decision · 2026-06-15.** Merge of the *Documentation* + *Configuration* tabs into one: **Manual** (hero "Guild Codex"). Based on research (deep-research) with adversarial verification.

## Why

1. **"Configuration" configures nothing.** Mission Control is read-only by design; its catalogs (Commands, Agents, Rules, Standards) are not settings, they are **reference for how it works and what can be done** — the same nature as Documentation. The label promised something false.
2. **Having two tabs to "read about the system"** + a flat sidebar that mixed narrative and catalogs = confusing. A developer would come in and not understand what it is, what it's for, or how to use it.

## The framework: Diátaxis (industry standard)

All good docs (Next.js, Stripe, Django…) separate **4 types, one page = one job**. Mixing types is anti-pattern #1 ([diataxis.fr](https://diataxis.fr/), [NN/g – Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), verified 3-0).

| Diátaxis type | Group in the Manual | Content |
|---|---|---|
| Tutorial | **Start here** | Value landing (default) + "Your first mission" (guided tour) |
| How-to | **Guides** | 7 tasks, one goal each (capture, handoff, mode, feedback, test, transfer, plugin) |
| Reference | **Reference** | The catalogs of the former Configuration: Commands, Agents, Rules, Standards (with cards) |
| Explanation | **Concepts** | The why and the technical depth (model, pipeline, build, state, hooks, Mission Control, stacks, plugin) |

Nav order: **Start here → Guides → Reference → Concepts** (learn by doing first; the why at the end).

## Principles applied (with backing)

- **Action before explanation**: the default is the value landing; the 2nd page already gets something running (it doesn't open with "how it works"). The engineer's mistake is the opposite.
- **Progressive disclosure, NOT splitting by audience.** The research **refuted** (0-3) splitting by role (product vs dev); instead, each page starts simple and reveals technical depth below/linked. It serves the PM and the dev on the same page.
- **Diagrams that accompany the prose, never replace it** (verified 3-0). The pipeline/team/architecture diagrams are kept with text alongside.
- **DRY**: the data lives in ONE place. "The team" (narrative) was merged into *Agents* (Reference); "Standards and rules" into their catalogs.
- **Problem/value landing, not a feature list.**

## Key adaptation (read-only case)

The top examples (Stripe/Firebase) are interactive products. Pandacorp is **read-only** — you don't "integrate", you *operate by pasting commands into Claude Code*. That's why "Your first mission" is a **guided tour/observation** (you paste 2-3 real commands) whose *first victory* is **seeing the party work in Mission Control**, not a "first API call".

## Implementation (prototype)

`mission-control/prototype/index.html`: `MANUALNAV` (4 groups) → `manualView()` / `manualContent()`; the new content pages (`manualLanding`, `manualQuickstart`, `manualGuide`); the Reference reuses `refSection()` (extracted from `configView`) + the existing cards (`configDetail`); the Concepts reuse `docPage()`. Top-nav: 5 → 4 tabs. Cross-links (`gotoagent`/`gotoskill`) re-routed to `manual`.

**Pending / future**: if there are ever real settings (e.g. a light/dark toggle), that is a **⚙️ icon in the topbar**, not a tab — "adjust the app" ≠ "read how it works". The guides written here should migrate to FRD-08 when it is formalized.

**Core sources**: [Diátaxis](https://diataxis.fr/) · [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) · [GitBook docs structure](https://gitbook.com/docs/guides/docs-best-practices/documentation-structure-tips). Caveat: the landing/onboarding part relies on practice sources (no A/B data).
