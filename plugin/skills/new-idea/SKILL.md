---
name: new-idea
description: Captures an owner's idea or problem into the Pandacorp ideas base. Use when the owner describes an app they want, a problem they have, says "I have an idea", or asks to turn what was discussed into a proposal for the board. It synthesizes the idea from the whole conversation, researches lightly and assigns it a score. It is also the crystallizer of /pandacorp:explore.
---

# /pandacorp:new-idea

Crystallizes an idea as a card in the ideas base. The idea can come from `$ARGUMENTS`, from a specific description, or from **a whole discovery conversation** (e.g. after `/pandacorp:explore`).

This is the owner's OWN idea — **document + improve, don't sell** (owner rule; see Rules). Unlike `/discover` (which hunts for opportunities and pitches them to convince the owner), here the owner already wants to build the idea. `new-idea` **captures the idea clearly, runs the quality gates to surface gaps, and proposes how to improve it**. It uses the same card structure as `/discover` (so it renders in Mission Control's **Propuesta** tab and the board stays consistent).

## Steps

1. **Synthesize from the whole conversation.** Don't stop at just `$ARGUMENTS` or the last message: go back through **the whole** conversation and reconstruct the idea with what was said, pushed back on and concluded. If the idea comes from `/pandacorp:explore`, also read its draft `factory/ideas/_drafts/<slug>.md` if it exists (it concentrates the exploration thread) — reuse the `slug:` field from its frontmatter for the card's filename, recomputing it (kebab-case of the English working title) only if the draft has none or there is no draft. Rules depending on what you find:
   - If the conversation explored **several** candidate ideas, list each one on a line and confirm with the owner which one(s) to capture (you can create one card per idea).
   - If there is only a short description and little context, ask at most 2-3 questions for the essentials that are missing (what exactly hurts? is it for them or to sell? what do they imagine as the solution?). If it's already enough, don't ask.
2. **Locate the factory**: the ideas base is in `factory/ideas/`, at the factory root (the repo where this skill runs). Read `_idea-template.md` for the exact format.
3. **Light research to ENRICH the owner's idea** (delegate to the `researcher` agent, a quick pass — NOT idea-hunting; reuse the conversation's evidence; this is not the deep research — that comes in the product phase).
   - **Enrich inputs**: name the main **similares** / competitors + our **differential / wedge**; evidence of the pain; obvious feasibility; and the inputs that fill the card honestly — **why now**, **por qué tú** (does an asset/channel of the owner apply?), the **#1 risk**, and a credible **mercado / SOM**.
   - **Discarded / rejection-pattern check**: check the existing cards **including the `status: discarded` ones** — if this idea matches one already **discarded** or fits a recurring **rejection pattern**, do NOT silently proceed: surface it ("ya descartaste esto / sueles rechazar esto por X; ¿lo capturo igual?") and only continue if he confirms.
   - **Standalone vs extension**: read what the owner already has (`factory/portfolio.md` + existing project folders) to judge **standalone vs an extension of an app he already owns** (don't freeze that app's scope — just note the overlap).
   - **Monetary-only market note**: **market reality (Perú/LATAM) only for a MONETARY idea**; a personal-utility idea (helps his collection) skips it.

4. **Run the quality gates + score (0-100).** The same gates as `/discover`, applied to surface gaps and propose improvements on the owner's own idea (to improve, not to sell — see Rules):
   - **Complexity bucket** (`complexity_bucket`: micro / small / large — buildability, not a day count; list the risk accelerators). If it's `large`, propose the re-scope to a micro/small core unless it's clearly worth it.
   - **Ground-truth** (`ground_truth_source`): if the app emits a judgment, where does it get the truth? Flag it as a gap to resolve if there's no credible source.
   - **Legal risk** (`legal_risk`): none / low (→ note the disclaimer) / high (→ flag it loudly as a blocker to rethink, owner rule).
   - **Painkiller class** (`painkiller_class`) + **prior workaround** (`prior_workaround`): a quick honest read of how acute the pain is.
   - **Score** (read `factory/profile.md`): need/pain (30%), ease/buildability (25%), **return or value** —the 3 paths are equal priority— (25%), **fit + differentiation** (20%). Assign an honest **verdict** (usually **build** — it's his idea — but say so honestly if a gate suggests **validate** first, or that it's better as an **extension** of an owned app → `fold_into`). Record the one-line weighted breakdown in the frontmatter `score_rationale:` (e.g. "pain 8×0.3 + ease 7×0.25 + return 6×0.25 + fit 7×0.2 = 71"); the fuller reasoning + the **proposed improvements** go inside the card's `### Evidencia` body section.

5. **Create the card** `factory/ideas/<slug-in-english>.md` (the slug from step 1 — the draft's frontmatter `slug:`, or freshly computed if absent) with full frontmatter incl. the decision fields (`verdict`, `the_bet`, `fold_into`, `why_now`, `kill_risk`, `validation_step`) **and the quality fields** (`complexity_bucket`, `painkiller_class`, `ground_truth_source`, `legal_risk`, `prior_workaround`, `distribution_channel`) + `score`/`score_rationale` + `project_type`/`profile_alignment`/`return_type`, `status: discovered`, `created:` today.
   - **Rendering contract** — write the body following **`_idea-template.md`'s rendering contract EXACTLY** and **mirror the byte-authoritative worked example at `plugin/templates/idea-card-example.md`** verbatim: the `### subsection` markers, the `> **Badges:**` line, the `> blockquote` testimonial, the `- **Title** — desc` feature bullets + `- ✓`/`- !` mock, the `| Riesgo | Mitigación |` table, evidence as `descripción — [fuente](url)` (colours/charts/bold are applied automatically by the component from the markers). So Mission Control's Propuesta tab renders it rich.
   - **Tone** — **clear documentation + improvement, not a hard sell**: state the idea plainly, fill *De un vistazo* and *Profundizar* with what's true, and use *Gaps y fuente de la verdad* + *El ask* to surface the gates' findings and **how to improve the idea**.
   - If an exploration draft existed (`factory/ideas/_drafts/<slug>.md`), **delete it** — the card now replaces it.
6. Report to the owner: card summary, score and whether you recommend it or not (with a short rationale).

## Rules
- **Document + improve, don't sell (owner rule).** It's the owner's idea; no persuasion/agitation layer and no hunting for alternatives. Run the quality gates to surface gaps and propose improvements, and fill the card honestly.
- One card per idea; if a similar one already exists (read the frontmatter), update it instead of duplicating.
- Always classify the card with `project_type` (what type of solution: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and `return_type` (monetary, opportunity, personal or mixed).
- A `personal` or `opportunity` return is also documented with rigor — the score weighs value and opportunity, not just monetization.
- To explore and clarify a fuzzy idea BEFORE capturing it, that's the job of `/pandacorp:explore`; this skill is the crystallization step.
