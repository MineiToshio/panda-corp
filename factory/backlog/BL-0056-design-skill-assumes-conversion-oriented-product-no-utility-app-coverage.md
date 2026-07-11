---
id: BL-0056
type: change
area: plugin-skill
title: "Design skill's anti-omission checklist (§1c/§7) and surface-playbooks.md assume a public, conversion-oriented product; no coverage path for a single-user utility app"
status: open
severity: p2
opened: 2026-07-10
closed:
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 harvest (2 notes, agent-inferred): during Stage 1/Stage 2 of /pandacorp:design for a single-user utility PWA (login, connections, status panel), NO surface playbook applied and §1c/§7 obligations (shared closing cta-band, SocialLinks) had no product to attach to"
closes:
links: []
---

## Problem
`plugin/skills/design/references/surface-playbooks.md` only covers portfolio/content surfaces (case
study, Now, blog, contact, archive, stack) — every playbook assumes a public marketing/portfolio site.
Building pandacast (a single-user utility PWA: login, connections-settings, an item-list-with-per-channel-
status panel, an empty/offline shell) left rubric check 10 of `factory/standards/design.md` §12 with
NO applicable playbook, forcing the agent to improvise a per-screen brief with no canonical guidance.

Separately, `factory/standards/design.md` §1c's anti-omission checklist and §7's rule ("ONE shared
closing `cta-band`, reused on every page", DR-101) both assume the product has a conversion action and a
public surface. A single-user tool with no public surface has no `cta-band` and no `SocialLinks` to
place — the standard currently forces the agent to hand-document a deviation on every such project
instead of the checklist/rubric conditioning those items on product type.

Both gaps share one root cause: the design skill's canonical checklist + reference playbooks were
authored against the portfolio/conversion-oriented product shape (personal-page-v2 class) and never
generalized to a second product shape (an internal/utility tool with no public surface, no conversion
funnel).

## Fix plan
1. Add a "product type" axis, decided at Stage 0/brief time (e.g. `public-with-conversion` vs
   `internal-tool`), read from the PRD/blueprint (or asked once if ambiguous) and recorded in the design
   brief.
2. `surface-playbooks.md`: add a set of utility-app playbooks — auth/login, connections-settings,
   item-list-with-per-channel-status, empty/offline shell — so rubric check 10 (§12) has something to
   score against for this product shape.
3. `factory/standards/design.md` §1c/§7: condition the cta-band/SocialLinks/closing-frame obligations on
   `product type == public-with-conversion`; for `internal-tool`, substitute an equivalent obligation (a
   consistent primary-action pattern per screen, still ONE shared component, just not a marketing CTA) so
   the checklist stays exhaustive without asking every internal-tool project to hand-write a deviation.

## Tests (prove the fix — TDD, RED → GREEN)
A documented manual repro: re-run the `/pandacorp:design` brief-construction step for a synthetic
utility-app blueprint (login + settings + status list) before/after — before, rubric check 10 has no
playbook to reference and §7 forces a manual deviation note; after, a playbook exists for each screen
class and §7 resolves via the internal-tool substitution with no manual deviation required. Automated
canary infeasible (this is prompt/reference-doc content, not executable logic) — manual repro plus
before/after diff of the generated brief is the proof.

## Done when
`surface-playbooks.md` has the 4 new utility playbooks; `design.md` §1c/§7 explicitly condition on
product type with the internal-tool substitution spelled out; plugin version bumped; Manual reference
catalog regenerated if it derives from this doc.

## Out of scope
Redesigning the rubric's 10 checks themselves — only conditioning the 2 that assume a conversion funnel.
