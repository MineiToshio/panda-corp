---
description: Searches the internet (Reddit, forums, social media, reviews, trends) for real opportunities —problems worth solving with a tech solution—, RED-TEAMS them against kill criteria, and documents only the survivors as decision-ready cards in the ideas base (a verdict + a 1-page memo each). It blends two streams —general high-return opportunities (topic-independent) and opportunities aligned with the owner's profile (their interests, assets and goals)— and detects when an idea should fold into an app the owner already has. Use when the owner asks "find opportunities", "discover ideas", "what could I build" or similar.
---

# /pandacorp:discover

Opportunity discovery **that helps the owner decide** — not a buffet of options, a curated, red-teamed shortlist where each survivor carries an explicit verdict. `$ARGUMENTS` can narrow the niche (e.g.: "/pandacorp:discover tools for teachers"); without arguments, it explores broadly, guided by the profile.

**Open scope.** It is not limited to "monetizable apps": an opportunity can be solved with a web or mobile app, a Claude Code tool or tooling, a prompt or prompt system, an automation, a rework, etc. What matters is **a real problem with good return**.

**Return is NOT just money.** The **opportunity** (reach, contacts, positioning), learning and personal value also count. A modest monetization idea can be worth a lot if it leverages an owner's lever or opens doors.

**The job is to DECIDE, not to inform.** The owner should read the output and know, at a glance, *this one yes / this one no*. Conviction comes from curation (the weak ones were killed before they reached him), an explicit verdict, and the hooks that make a builder say "this is the one": why YOU, why NOW, what winning looks like, and an honest risk the idea survived.

## Step 0 — Read the profile + what the owner already has

Read `factory/profile.md` (interests, hobbies, likes/dislikes, goals, **assets/levers** —audience, community, niche, data—, monetization appetite, project types). If it doesn't exist, say so and suggest onboarding (you can still run the general stream).

Then read **what the owner already owns**, for fold-in detection (Step 5): `factory/portfolio.md` + the owner's existing project folders (the profile's `projects_path`, default = the factory's sibling folders). Note each app's name + one-line purpose, so a new idea can be judged *standalone* vs *a feature of something he already has*.

## Steps

1. **Gather candidates — launch `researcher` in parallel, in TWO streams (~50/50):**

   **Stream A — General opportunities (topic-independent):** complaints/pain on Reddit & forums; negative reviews of existing tools (what users beg for and nobody gives); trends, "alternatives to X" / "tools for Y", gaps AI opened.

   **Stream B — Aligned with the profile:** pain in the owner's interests/niche; ideas that leverage their assets (audience/community/data) or open doors; tools that fix their own life/work.

   Each opportunity must come with **EVIDENCE** (links to real expressions of the pain/demand), plus the inputs the red-team + scorecard need:
   - **Similares** — the real existing products/competitors, named, one line + link each (pricing when it frames the gap); "nobody, as far as I found" is a valid *explicit* answer.
   - **Differential / wedge** — concretely why ours would be better/different and where the value is.
   - **Dream features** — 3-6 high-level capabilities that make it *exciting*.
   - **Demand signal** — observable? (Reddit complaints / active searches / paid alternatives / people hiring to do it by hand). How strong.
   - **Incumbent strength** — is a well-funded player already covering this use case?
   - **Distribution / founder-fit** — can the owner reach the first 10 customers (their channel/niche/asset)? or is there no clear channel?
   - **Why now** — the catalyst that makes this the right moment.
   - **Effort** — honest weeks-to-first-usable-MVP for one person.

2. **Filter (feasibility)** with Pandacorp criteria: implementable by one person in **weeks** (not months) with the golden paths or as tooling/prompt/automation; no heavy regulatory load (health, regulated finance); **clear return** (monetary OR opportunity/personal).

3. **Red team — the kill-gate (this is the curation).** Run EVERY surviving candidate through an adversarial pre-mortem ("it's 18 months later and this failed — why?") against the **kill criteria**, in order of how often they kill:
   1. **No distribution** — can't name the channel + the concrete first customer. (the #1 killer)
   2. **Vitamin, not painkiller** — "nice to have", not "need this week or it costs me real money/time".
   3. **No observable demand** — no first-order evidence (complaints / searches / paid alternatives / hiring-to-do-it-by-hand).
   4. **Strong well-funded incumbent without a defensible wedge** — a big player covers the same use case and could copy our edge in ~3 months.
   5. **Too complex for the window** — honest MVP > ~4-6 weeks for one person, or needs data/licenses/regulation that don't exist.
   6. **Not founder-fit** — owner doesn't live the problem and has no access to users to iterate.
   7. **Market = "everyone"** — can't name a specific first customer (industry + size + specific problem + where they live).

   An idea that fails a hard criterion (1-4 especially) is **KILLED** — it does NOT become a card. A *valid problem* with a *strong incumbent and no wedge*, or *no distribution*, is a **kill**, not a card. Killed ideas are listed in the report as "**descartadas y por qué**" (one line each) — that one-line honesty is what makes the survivors feel earned.

4. **Deduplicate** against the existing base: read the frontmatter of `factory/ideas/*.md`; if it's already there, add the new evidence/angle to that card instead of duplicating.

5. **Verdict + scorecard + fold-in (for each survivor).** Assign:
   - **Verdict** (asymmetric — not everything is "could work"): **🏆 build** (do it — strong, ready) · **🧪 validate** (promising but a key unknown → a concrete 7-day test first) · **🔌 integrate** (better as a feature of an app the owner already has → name it in `fold_into`). (A 4th outcome, *discard*, never becomes a card — it stayed in Step 3.)
   - **Scorecard** — 5 axes, H/M/L (or 0-5), the lens the owner cares about: **founder-fit** (channel/asset), **wedge** (defensibility), **effort** (weeks), **demand signal**, **return type**.
   - **La apuesta (the bet)** — one line: the crisp "why this wins".
   - **Why now**, **founder-fit**, **#1 kill-risk** (the one that survived the red team), **7-day validation step**.
   Check fold-in against Step 0's inventory: prefer **integrate** into an owned app over a near-duplicate standalone.

6. **Document the survivors as decision-ready cards** — **curate, don't buffet**: aim for **~4 total** (e.g. ~2 aligned + ~2 general, weighted toward the profile), never the old ~3-5-per-stream pile. Cards at `factory/ideas/<slug>.md` (`_idea-template.md` format, `origin: discovery`, `status: discovered`), full frontmatter incl. the decision fields (`verdict`, `the_bet`, `fold_into`, `why_now`, `kill_risk`, `validation_step`) + `project_type`/`profile_alignment`/`return_type`/`score`. Body = a **1-page memo, TL;DR-first** (Spanish headings — the body is gitignored Spanish):
   - **Veredicto + la apuesta** at the very top (the label + the one-line bet).
   - **De un vistazo** (decide here): Problema as *storytelling* (a concrete scene — who they are, the moment it hurts, what it costs) · Diferencial (1 line) · Por qué ahora · Por qué tú (founder-fit/canal) · Riesgo #1 · Test de 7 días · the **scorecard** (small table).
   - **Profundizar** (read more if interested): Solución · Features (qué haría) · Similares (qué ya existe) · Comparación y valor diferencial · Retorno · Red team (full kill-risks) · Evidencia (≥2 real links) · Notas de evaluación.

7. **Report = a decision view** (not a catalog). Lead with **the hero** (the one to build) + a one-line why. Then a **scannable table** of the curated shortlist (idea · veredicto · la apuesta · fit-canal), then "**descartadas y por qué**" (the killed ones, one line each), then "**integrar en lo que ya tienes**" (fold-ins, naming the app). Verdict-first, scannable, ONE clear recommendation — never a flat buffet.

## Rules
- **Curate, don't buffet.** ~4 survivors max; kill the rest and show why. What you DON'T show is as important as what you do — the curation is the value.
- **Red team every idea.** A valid problem with a strong incumbent + no wedge, or no distribution, is a **discard**, not a card. Run the kill-gate BEFORE presenting, not as a footnote.
- **Verdict is explicit and asymmetric.** Every survivor gets build / validate / integrate, up front. Say "no" with conviction where it's warranted.
- **Check what he already has first.** Prefer **integrate** into an owned app over a near-duplicate standalone; name the app.
- **The conviction hooks are mandatory.** Founder-fit, why-now, the #1 surviving risk, and a 7-day validation step — these are what make it a "wow", not a feature list.
- **Problem as storytelling**; **sell the differential value**, never a me-too; **evidence first** (≥2 real links); **don't inflate** the score (70+ must be genuinely promising — rubric in `/pandacorp:new-idea`).
- Honor the dual criterion: don't kill an aligned idea only for low monetization, nor a brilliant general one only for being off-topic.
- It runs on demand today; designed to also run as a scheduled job (no human) — in that case it only reports and records.
