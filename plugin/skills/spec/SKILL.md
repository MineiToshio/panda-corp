---
description: Pandacorp's handoff + product phase. Creates an idea's project (folder/repo) and generates research + PRD + FRDs for the MVP. Runs FROM the factory with the idea's name. It is the discovery → documented step.
---

# /pandacorp:spec

Takes the idea indicated in `$ARGUMENTS`, **creates its project** (handoff) and documents the MVP. Runs FROM the factory (panda-corp) because the project folder doesn't exist yet — that's why it takes the idea's name.

## Step 0 — Handoff (create the project)

1. Read the card `factory/ideas/<idea>.md`. It must exist and NOT be `discarded`. **If the project ALREADY exists** (the card has `project:` with a path): the handoff was already done — **skip all of Step 0** (don't re-scaffold) and go straight to Step 1 to **iterate** the product documents.
2. Run the project scaffold (same steps as the `scaffold` skill): create `<slug>/` as a **sibling of the factory root** (never inside; use `ruta_proyectos` from `factory/profile.md` if it is defined, by default the parent directory of the factory), copy the overlay from `${CLAUDE_PLUGIN_ROOT}/templates/shared/`, process the `.tpl` files, create the `docs/` structure (frds, design/mockups, adr, work-orders, reviews, iteration.md), copy the card to `docs/idea-origin.md`, initialize git, create a private repo with `gh` if available (DR-010), and write the bidirectional links (card → `status: documented` + `project:` with the path; row in `factory/portfolio.md`).

> From here on you work INSIDE the project folder. The other skills (`design`, `blueprint`, `implement`, `release`) run there and do NOT need the name.

## Step 1 — Product (in the project)

3. **Deep research** (`researcher` agents in parallel): competitors and their complaints, users, table-stakes vs differentiating features, feasibility (APIs/data, costs, terms). Consolidate in `docs/product-research.md` with sources. This is the PRODUCT research (at FRD level): the more complete it is, the fewer decisions are left to resolve during the build.
4. **PRD** (`product-manager` agent): `docs/prd.md` — vision, problem, users, value hypothesis, monetization (including the explicit decision **v1 with payments? yes/no**, DR-035), metrics, minimum v1 scope + backlog.
5. **FRDs** (same agent): `docs/frds/frd-NN-<name>.md`, one per v1 feature, testable EARS acceptance criteria.
6. Self-review: each FRD traceable to the PRD; v1 truly minimal (DR-012); criteria machine-verifiable.
7. **Iterate / resume (DR-032)**: if a PRD/FRDs already existed, this is an **iteration** — read `docs/iteration.md` (phase `product`) and the existing docs, refine with the owner's feedback (do **not** regenerate from scratch or repeat what was already discarded) and **append** an entry per round (what was tried, what was rejected and why, what's still open). Present to the owner: value hypothesis, v1 FRDs, what was left out.
8. **Advance gate (DR-032)**: leave `advance_pending: true` in `docs/status.yaml` and **wait for the owner's "ok, advance"** — re-running `spec` in the meantime = keep polishing. **DO NOT write `phase: design` before.** Only when they approve: `docs/status.yaml` → `phase: design` + `advance_pending: false`, and close the `product` thread in `docs/iteration.md`. Next step: open Claude Code in the project folder and run `/pandacorp:design`.

## Rules
- If the research contradicts the idea (nonexistent pain, unbeatable competition), SAY SO and recommend killing/pivoting before writing the PRD.
- Documents in Spanish; identifiers in English.
