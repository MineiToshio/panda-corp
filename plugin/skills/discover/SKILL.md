---
description: Searches the internet (Reddit, forums, social media, reviews, trends) for real opportunities —problems worth solving with a tech solution—, RED-TEAMS them against kill criteria, and documents only the survivors as decision-ready cards in the ideas base (a verdict + a 1-page memo each). It blends two streams —general high-return opportunities (topic-independent) and opportunities aligned with the owner's profile (their interests, assets and goals)— and detects when an idea should fold into an app the owner already has. Use when the owner asks "find opportunities", "discover ideas", "what could I build" or similar.
---

# /pandacorp:discover

Opportunity discovery **that helps the owner decide** — not a buffet of options, a curated, red-teamed shortlist where each survivor carries an explicit verdict. `$ARGUMENTS` can narrow the niche (e.g.: "/pandacorp:discover tools for teachers"); without arguments, it explores broadly, guided by the profile.

**Open scope.** It is not limited to "monetizable apps": an opportunity can be solved with a web or mobile app, a Claude Code tool or tooling, a prompt or prompt system, an automation, a rework, etc. What matters is **a real problem with good return**.

**Return is NOT just money.** The **opportunity** (reach, contacts, positioning), learning and personal value also count. A modest monetization idea can be worth a lot if it leverages an owner's lever or opens doors.

**The job is to DECIDE, not to inform.** The owner should read the output and know, at a glance, *this one yes / this one no*. Conviction comes from curation (the weak ones were killed before they reached him), an explicit verdict, and the hooks that make a builder say "this is the one": why YOU, why NOW, what winning looks like, and an honest risk the idea survived.

## Step 0 — Read the profile + what the owner already has

Read `factory/profile.md` (interests, hobbies, likes/dislikes, goals, **assets/levers** —audience, community, niche, data—, monetization appetite, project types, and the owner's **country/market** — e.g. Perú/LATAM, which the market reality check below depends on). If it doesn't exist, say so and suggest onboarding (you can still run the general stream).

Then read **what the owner already owns**, for fold-in detection (Step 5): `factory/portfolio.md` + the owner's existing project folders (the profile's `projects_path`, default = the factory's sibling folders). Note each app's name + one-line purpose, so a new idea can be judged *standalone* vs *a feature of something he already has*.

**Build the EXCLUSION SET (do NOT re-recommend).** Read **every existing idea card** `factory/ideas/*.md` in **ANY status** — discovered / recommended / in-pipeline / shipped / **discarded**. The `discarded` cards (the Descartado column) are the **single source of truth for rejected ideas** — there is no separate ledger; a discarded card stays put precisely so discovery remembers not to re-propose it. Collect their titles + core concepts. Discovery surfaces only **genuinely NEW** opportunities: anything already on the board in any status (including discarded) is excluded for the whole run (Step 4). This is the rule the owner cares about most — *don't show me what's already on the board or what I already discarded.*

**Learn from WHY he discarded (rejection patterns).** For each `discarded` card, read its **discard reason** (frontmatter `discard_reason`, else the card body) + the profile's dislikes/anti-patterns. Distill the recurring **rejection patterns** — the *generalizable* reasons, not the specific idea (e.g. "saturated / strong-incumbent", "B2B sales-heavy", "doesn't leverage my channel", "US-only monetization", "not interested in topic X"). These feed a kill criterion in Step 3: discovery must not re-propose ideas that **fit a pattern he already rejected**, even when the idea itself is new.

## Steps

1. **Gather candidates — launch `researcher` in parallel, in TWO streams (~50/50):**

   **Stream A — General opportunities (topic-independent):** complaints/pain on Reddit & forums; negative reviews of existing tools (what users beg for and nobody gives); trends, "alternatives to X" / "tools for Y", gaps AI opened.

   **Stream B — Aligned with the profile:** pain in the owner's interests/niche; ideas that leverage their assets (audience/community/data) or open doors; tools that fix their own life/work.

   **Give each researcher the EXCLUSION SET from Step 0** (every existing card title, any status incl. discarded) and instruct them to bring only **net-new** opportunities — not the same idea (or a thin rename) already on the board or already discarded, and to **avoid ideas that fit the owner's known rejection patterns** (Step 0: the generalizable reasons he discarded past ideas).

   Each opportunity must come with **EVIDENCE** (links to real expressions of the pain/demand), plus the inputs the red-team + scorecard need:
   - **Similares** — the real existing products/competitors, named, one line + link each (pricing when it frames the gap); "nobody, as far as I found" is a valid *explicit* answer.
   - **Differential / wedge** — concretely why ours would be better/different and where the value is.
   - **Dream features** — 3-6 high-level capabilities that make it *exciting*.
   - **Demand signal** — observable? (Reddit complaints / active searches / paid alternatives / people hiring to do it by hand). How strong.
   - **Incumbent strength** — is a well-funded player already covering this use case?
   - **Distribution / founder-fit** — can the owner reach the first 10 customers (their channel/niche/asset)? or is there no clear channel?
   - **Why now** — the catalyst that makes this the right moment.
   - **Effort** — honest weeks-to-first-usable-MVP for one person.
   - **Market reality (owner's country)** — does the revenue rail (affiliate program, payment processor, ad network) AND the customer base actually exist and *pay* from the owner's country (e.g. Perú), or does the premise silently assume US/abroad infrastructure? (e.g. Amazon Associates excludes Perú; Japan proxies pay only store credit.) Name the in-market alternative if the default doesn't apply.

2. **Filter (feasibility)** with Pandacorp criteria: implementable by one person in **weeks** (not months) with the golden paths or as tooling/prompt/automation; no heavy regulatory load (health, regulated finance); **clear return** (monetary OR opportunity/personal).

3. **Red team — the kill-gate (this is the curation).** Run EVERY surviving candidate through an adversarial pre-mortem ("it's 18 months later and this failed — why?") against the **kill criteria**, in order of how often they kill:
   1. **No distribution** — can't name the channel + the concrete first customer. (the #1 killer)
   2. **Vitamin, not painkiller** — "nice to have", not "need this week or it costs me real money/time".
   3. **No observable demand** — no first-order evidence (complaints / searches / paid alternatives / hiring-to-do-it-by-hand).
   4. **Strong well-funded incumbent without a defensible wedge** — a big player covers the same use case and could copy our edge in ~3 months.
   5. **Too complex for the window** — honest MVP > ~4-6 weeks for one person, or needs data/licenses/regulation that don't exist.
   6. **Not founder-fit** — owner doesn't live the problem and has no access to users to iterate.
   7. **Market = "everyone"** — can't name a specific first customer (industry + size + specific problem + where they live).
   8. **Doesn't work in the owner's market** — the revenue rail (affiliate program, payment processor, ad network) or the customer base doesn't exist / isn't accessible from the owner's country (e.g. Amazon Associates excludes Perú; Japan proxies pay only store credit; no local affiliate programs), and there's no viable local alternative. A monetization premise that silently assumes US/abroad infrastructure is a **kill-or-reframe** flag: *reframe* = build-for-others (the owner is the builder, NOT the first monetizing user — name that validation risk), or find the in-market model; *kill* only if money was the sole value and no in-market model exists.

   9. **Matches an owner rejection pattern** — fits a generalizable reason the owner already gave for discarding (Step 0's rejection patterns / profile anti-patterns), even if the specific idea is brand-new (e.g. he keeps discarding saturated B2B tools → don't bring another). Kill it and name the pattern it matched.

   An idea that fails a hard criterion (1-4 especially) is **KILLED** — it does NOT become a card. A *valid problem* with a *strong incumbent and no wedge*, or *no distribution*, is a **kill**, not a card. Killed ideas are listed in the report as "**descartadas y por qué**" (one line each) — that one-line honesty is what makes the survivors feel earned. Red-team auto-kills are **reported, not carded** (only the *owner* turns an idea into a `discarded` card, from Mission Control — the human gate); if a killed idea is re-found in a later run it's simply re-killed before it ever reaches the owner, so he never sees a repeat.

4. **Exclude — don't re-surface** (the rule the owner cares about most). Any candidate that matches the **EXCLUSION SET** from Step 0 — an existing card in ANY status (discovered/recommended/in-pipeline/shipped/**discarded**) — is **dropped from the run entirely**: NOT presented, NOT carded. (You MAY silently append a genuinely new piece of evidence to an existing *active* card, but it still does NOT appear in the report.) **A discarded idea is never re-recommended, period** — which is why a rejected idea must stay as a `status: discarded` card (the Descartado column), never deleted: that card IS the memory. The survivors that move on must be **genuinely NEW**.

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

7. **Report = a decision view** (not a catalog). Everything you present is **genuinely NEW** — never re-list an idea already on the board in any status (including discarded). Lead with **the hero** (the one to build) + a one-line why. Then a **scannable table** of the curated shortlist (idea · veredicto · la apuesta · fit-canal), then "**descartadas y por qué**" (the killed ones this run, one line each), then "**integrar en lo que ya tienes**" (fold-ins, naming the app). Close with a one-line "*(omití N ideas que ya están en tu base, incluidas las descartadas)*" so the curation is transparent. Verdict-first, scannable, ONE clear recommendation — never a flat buffet, never a repeat.

## Rules
- **Curate, don't buffet.** ~4 survivors max; kill the rest and show why. What you DON'T show is as important as what you do — the curation is the value.
- **Red team every idea.** A valid problem with a strong incumbent + no wedge, or no distribution, is a **discard**, not a card. Run the kill-gate BEFORE presenting, not as a footnote.
- **Verdict is explicit and asymmetric.** Every survivor gets build / validate / integrate, up front. Say "no" with conviction where it's warranted.
- **Never re-recommend.** An idea already a card in ANY status — including **discarded** — is excluded for the whole run (not presented, not carded). Discovery surfaces only genuinely NEW opportunities.
- **Discarding = `status: discarded`, never delete.** The Descartado column IS the single do-not-recommend memory (one source of truth — no separate ledger). Deleting a discarded card erases that memory and the idea resurfaces, so a rejected idea stays as a `status: discarded` card (marked from Mission Control, the human gate).
- **Learn from the discard REASON, not just the title.** Read each discarded card's `discard_reason` + the profile anti-patterns, distil the recurring **rejection patterns**, and kill candidates that fit one (kill criterion #9) — even brand-new ideas. When a pattern is durable (recurs across discards), **distil it into `factory/profile.md`** dislikes/anti-patterns (DR-053) so `recommend` and future runs weigh it too. The reason lives on the card (raw, per-idea); the generalized preference lives in the profile (durable) — same data, two granularities, no duplication.
- **Check what he already has first.** Prefer **integrate** into an owned app over a near-duplicate standalone; name the app.
- **Evaluate in the owner's market, never a US default.** Verify the revenue rail (affiliate/payment/ads) AND the customer base actually exist and pay from the owner's country (Perú/LATAM). A monetization premise built on US infrastructure (Amazon Associates, US-only affiliate programs) that excludes the owner's country is a **kill-or-reframe** flag — find the in-market model (local affiliates, TikTok Live, sponsorships, own store) or say plainly it only works *built-for-others*.
- **The conviction hooks are mandatory.** Founder-fit, why-now, the #1 surviving risk, and a 7-day validation step — these are what make it a "wow", not a feature list.
- **Problem as storytelling**; **sell the differential value**, never a me-too; **evidence first** (≥2 real links); **don't inflate** the score (70+ must be genuinely promising — rubric in `/pandacorp:new-idea`).
- Honor the dual criterion: don't kill an aligned idea only for low monetization, nor a brilliant general one only for being off-topic.
- It runs on demand today; designed to also run as a scheduled job (no human) — in that case it only reports and records.
