---
description: Captures an owner's idea or problem into the Pandacorp ideas base. Use when the owner describes an app they want, a problem they have, says "I have an idea", or asks to turn what was discussed into a proposal for the board. It synthesizes the idea from the whole conversation, researches lightly and assigns it a score. It is also the crystallizer of /pandacorp:explore.
---

# /pandacorp:new-idea

Crystallizes an idea as a card in the ideas base. The idea can come from `$ARGUMENTS`, from a specific description, or from **a whole discovery conversation** (e.g. after `/pandacorp:explore`).

## Steps

1. **Synthesize from the whole conversation.** Don't stop at just `$ARGUMENTS` or the last message: go back through **the whole** conversation and reconstruct the idea with what was said, pushed back on and concluded. If the idea comes from `/pandacorp:explore`, also read its draft `factory/ideas/_drafts/<slug>.md` if it exists (it concentrates the exploration thread). Rules depending on what you find:
   - If the conversation explored **several** candidate ideas, list each one on a line and confirm with the owner which one(s) to capture (you can create one card per idea).
   - If there is only a short description and little context, ask at most 2-3 questions for the essentials that are missing (what exactly hurts? is it for them or to sell? what do they imagine as the solution?). If it's already enough, don't ask.
2. **Locate the factory**: the ideas base is in `factory/ideas/`, at the factory root (the repo where this skill runs). Read `_idea-template.md` for the exact format.
3. **Light research** (delegate to the `researcher` agent, a quick pass): do solutions exist? is there evidence of the pain in others? obvious technical feasibility? If the discovery conversation already brought evidence, reuse it instead of repeating the search. This is not the deep research — that comes in the product phase.
4. **Score (0-100)** (read `factory/profile.md` to weigh return and fit): real and frequent need/pain (30%), ease of implementation with golden paths or as tooling/prompt/automation (25%), **return or value to the owner** —monetary, of opportunity (reach/network/positioning/learning) or personal, weighted by the profile's appetite— (25%), **fit and advantage** —alignment with the profile + differentiation— (20%). Document the rationale in "Evaluation notes".
5. **Create the card** `factory/ideas/<slug-in-english>.md` with complete frontmatter (includes `project_type`, `profile_alignment` and `return_type`), `status: documented`, `created:` with today's date. If an exploration draft existed (`factory/ideas/_drafts/<slug>.md`), **delete it** — the card now replaces it.
6. Report to the owner: card summary, score and whether you recommend it or not (with a short rationale).

## Rules
- One card per idea; if a similar one already exists (read the frontmatter), update it instead of duplicating.
- Always classify the card with `project_type` (what type of solution: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and `return_type` (monetary, opportunity, personal or mixed).
- A `personal` or `opportunity` return is also documented with rigor — the score weighs value and opportunity, not just monetization.
- To explore and clarify a fuzzy idea BEFORE capturing it, that's the job of `/pandacorp:explore`; this skill is the crystallization step.
