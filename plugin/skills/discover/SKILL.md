---
description: "Searches the internet (Reddit, forums, 1-2★ reviews, social media, trends) for real opportunities —problems worth solving with a tech solution—, RED-TEAMS them against kill criteria, and documents only the survivors as decision-ready cards in the ideas base. Each survivor is a memo-pitch (hot→cold) that sells the dream AND gives the criterio to decide — problem, market, market-entry/distribution, technical gaps + source-of-truth, legal risk, all red-teamed. It blends two streams —general high-return opportunities and opportunities aligned with the owner's profile— biases toward easy-to-build micro-apps, and detects when an idea is better as an extension of an app the owner already has. Use when the owner asks \"find opportunities\", \"discover ideas\", \"what could I build\" or similar."
---

# /pandacorp:discover

Opportunity discovery **that makes the owner dream AND decide** — not a buffet of options, a curated, red-teamed shortlist where each survivor is a **memo-pitch**: it sells the value like a pitch to an investor (so a builder says "this is the one") and gives the cold criterio to decide (market, distribution, gaps, risk). `$ARGUMENTS` can narrow the niche (e.g.: "/pandacorp:discover tools for teachers"); without arguments, it explores broadly, guided by the profile.

**Open scope.** Not limited to "monetizable apps": an opportunity can be a web/mobile app, a Claude Code tool, a prompt system, an automation, a rework. What matters is **a real problem with good return**.

**Return is NOT just money, and the 3 return paths are EQUAL priority (owner rule).** A hit (many users), several micro-apps (~100-200 USD/mo each that add up), and a non-monetizable app that solves the owner's own life (e.g. helps his collection) all count the same. The hero of the report is chosen by **pain strength + founder-fit + buildability**, NOT by return type.

**Bias to easy-to-build micro-apps (owner rule).** Prefer **micro** (a cotizapdf — one role/one flow/one feature) and **small** ideas. A **large** idea (weeks, 10-15 FRDs) is only proposed when the pain is **highly recurrent, with strong complaints, and strong odds of monetization** — otherwise re-scope it to its core or kill it.

**The job is to DECIDE, not to inform.** The owner reads the memo and knows *this one yes / this one no*. Conviction comes from curation (the weak were killed before he saw them), the hot block that makes him dream, the cold block that answers every doubt (market, distribution, source-of-truth, legal), and an explicit verdict.

## Step 0 — Read the profile + map what the owner already has

Read `factory/profile.md` (interests, hobbies, likes/dislikes, goals, **assets/levers** —audience, community, niche, data—, monetization appetite, project types, and the owner's **country/market** — Perú/LATAM, on which the market-reality check depends). If it doesn't exist, say so and suggest onboarding (you can still run the general stream).

Then read **what the owner already owns**, for the extension/fold-in check (Step 5): `factory/portfolio.md` + the owner's existing project folders (the profile's `projects_path`, default = the factory's sibling folders). Note each app's name + one-line purpose. **Do NOT freeze their scope (owner rule):** these apps are built outside the factory; the goal is not to *subsume* near-niche ideas into them but to detect when a candidate is better delivered as a **proposed extension** of one of them.

**Build the EXCLUSION SET (do NOT re-recommend).** Read **every existing idea card** `factory/ideas/*.md` in **ANY status** — discovered / recommended / in-pipeline / shipped / **discarded**. The `discarded` cards (the Descartado column) are the **single source of truth for rejected ideas**. For each card, record **the PAIN/PROBLEM it solves + for whom** — NOT just its title or its solution. Dedup is **by problem, not by title or by solution**: a renamed, re-scoped, re-framed or differently-built attempt at a pain already on the board is the SAME idea (e.g. an "AI visual authenticator" and an "anti-fake checklist" both answer *"is my collectible real?"* → ONE idea). Anything whose core pain is already on the board in any status (incl. discarded) is excluded for the whole run (Gate 3.0 + Step 4).

**Learn from WHY he discarded (rejection patterns).** For each `discarded` card read its `discard_reason` (else the body) + the profile's dislikes/anti-patterns, and distil the recurring **rejection patterns** (the generalizable reason, e.g. "saturated/strong-incumbent", "B2B sales-heavy", "doesn't leverage my channel"). These feed kill criterion #9.

## Steps

1. **Gather candidates — launch `researcher` in parallel, in TWO streams (~50/50), evidence-first:**

   **Stream A — General opportunities (topic-independent):** complaints/pain on Reddit & forums; **1-2★ reviews** of existing tools (G2/Capterra/App Store/Trustpilot — people who ALREADY paid and suffer, the strongest WTP signal); "alternatives to X" / "tools for Y"; gaps AI opened.

   **Stream B — Aligned with the profile (bias here):** pain the owner or **his collector audience already live**; ideas that leverage his assets (channel/community/data) or open doors; tools that fix his own life/collection. **Bias toward problems he or his niche actually have** (this is what makes it feel *his*).

   Give each researcher the EXCLUSION SET (every existing card title, any status incl. discarded), instruct them to bring only **net-new** opportunities and to **avoid ideas that fit the owner's known rejection patterns**.

   Each opportunity comes with **EVIDENCE** (real links to the pain/demand) + the inputs the gates need:
   - **Prior workaround (The Mom Test — behavior over opinion):** how do people solve this TODAY (a spreadsheet, a manual process, hiring someone)? An existing workaround is the #1 predictor of willingness-to-pay; record it in `prior_workaround`. Prefer evidence of *past behavior* over hypothetical opinion.
   - **Source the pain in the RIGHT market:** when the idea is for the owner's niche, mine the **Spanish/LATAM collector** buyer's reviews — never mine an Anglo/B2B pain and then staple a Spanish channel on it (a false demand↔distribution match).
   - **Similares** — the real existing products/competitors, named, one line + link each.
   - **Differential / wedge** — concretely why ours is better/different.
   - **Dream features** — 3-6 capabilities that make it *exciting* (the prize).
   - **Demand signal**, **incumbent strength**, **why now**.
   - **Distribution / founder-fit** — can the owner reach the first 10 customers (his channel/niche)? or is there no clear channel?
   - **Market reality (owner's country) — for MONETARY ideas only (owner rule):** does the revenue rail (affiliate/payment/ads) AND the customer base actually exist and *pay* from Perú/LATAM? (Amazon Associates excludes Perú; Japan proxies pay only store credit.) Name the in-market alternative. **A personal-utility idea (helps the owner's own collection) skips this check** — it's welcome even without monetization.

2. **Feasibility filter** with Pandacorp criteria: implementable by one person in the **micro/small** band (golden paths, tooling, prompt, automation); no heavy regulatory load; **clear return** (monetary OR opportunity/personal).

3. **The gates (the curation) — run BEFORE carding, in order; each renders in the memo, never a footnote.**

   **3.0. DEDUP GATE (do-not-repeat) — the FIRST gate, hard, runs before everything and is RENDERED.** For **each** candidate, name the **single nearest existing card** (from the EXCLUSION SET) and the **pain each addresses**. Then decide:
   - **Same core pain → it is a DUPLICATE → DROP it from the run** (not carded, not presented as new), *regardless of* a different name, angle, solution, tech, or re-scope. "A different solution to a pain already on the board is NOT a new idea." This holds across **any status** — discarded means *do not bring it back*, in-pipeline/shipped/discovered means *already here*.
   - **A genuine improvement/re-scope of an existing card → UPDATE that card** (append the new evidence/angle to it), **never create a second card** for the same pain. A re-scope is an edit, not a birth.
   - **Genuinely different pain → it passes** to 3a. The bar: you can state the existing card's pain and this candidate's pain and they are *different problems*, not the same problem dressed differently.
   Render this as a one-line-per-survivor **"dedup check: nearest card = X · distinct because <different PAIN, not different solution>"**. If you cannot name a clearly different pain, it does NOT pass. (This gate exists because a re-scope/rename leaked a duplicate onto the board — e.g. authenticator → anti-fake checklist — which is the exact "don't repeat" the owner rejects.)

   **3a. PRE-FILTER founder-fit (Paul Graham's 3 traits) — runs BEFORE scoring, hard gate.** Does this nacer from something the owner or his niche *already live*? · can Pandacorp build it? · do few see it's worth doing? A candidate that isn't *his* is dropped (or demoted) **before** spending tokens on a memo. (Kills feedback #1: "ideas don't feel aligned".)

   **3b. GATE painkiller / vitamin / candy** — 4 hard questions: does the pain recur (weekly / embedded in a flow)? · ROI in one sentence? · is there a prior workaround? · would they not hesitate at a monthly price? Render as an **H/M/L label with the cited evidence per question** — NEVER a meter/gauge (an agent-self-scored gauge is theater). A vitamin is not killed but its priority drops.

   **3c. GATE complexity bucket** — classify **micro / small / large** (buildability, not a day count — discover never sees the code). List the **risk accelerators** that can break the estimate (auth, anti-bot scraping, third-party approval like Meta, non-existent ground-truth, PE payments). Default-acceptable = **micro + small**. A **large** only survives with a near-sure monetary case (recurrent pain + strong complaints + strong monetization); otherwise the memo PROPOSES the re-scope to its core, or kills it.

   **3d. GATE ground-truth + legal** — when the app emits a judgment, ask the kill question **"where does the app get the truth?"** (`ground_truth_source`: API/dataset/community/owner-as-curator/**none**). With no credible source the verdict **cannot be build** (drop to validate or re-scope: e.g. "authenticator" → expert-curated "signal checklist" that educates, never dictates). **Legal risk (owner rule): HIGH → kill; LOW → present with a disclaimer.** A generic disclaimer does NOT neutralize a high risk.

   **3e. Red-team kill-gate (pre-mortem).** Run every survivor through "it's 6 months later and this failed — why?" against the kill criteria, in order of how often they kill:
   1. **No distribution** — can't name the channel + the concrete first customer.
   2. **Vitamin, not painkiller** — "nice to have", not "need this week".
   3. **No observable demand** — no first-order evidence (complaints / 1-2★ reviews / searches / paid alternatives / hiring-to-do-it).
   4. **Strong well-funded incumbent without a defensible wedge.**
   5. **Too complex for the window** — beyond micro/small with no near-sure monetary case, or needs data/licenses/regulation that don't exist.
   6. **Not founder-fit** — the owner doesn't live the problem and has no access to users.
   7. **Market = "everyone"** — can't name a specific first customer.
   8. **Doesn't work in the owner's market** (monetary ideas) — the revenue rail / customer base doesn't exist/pay from Perú. Kill-or-reframe (build-for-others, or an in-market model); kill only if money was the sole value.
   9. **Matches an owner rejection pattern** (Step 0). Kill it and name the pattern.

   A hard failure (1-4 especially) is **KILLED** — it does NOT become a card. Killed ideas are listed in the report as "**descartadas y por qué**" (one line each). Auto-kills are reported, not carded (only the *owner* turns an idea into a `discarded` card, from Mission Control).

4. **Exclude — don't re-surface (enforced by Gate 3.0).** Any candidate whose **core pain** matches an existing card in ANY status incl. discarded — by title, solution, angle, OR re-scope/rename — is **dropped from the run entirely**: not presented, not carded. (You MAY silently append genuinely new evidence to an existing *active* card — that's the *update*, not a new card.) Survivors must be **genuinely NEW PROBLEMS**. Before writing any card, re-check its pain against the EXCLUSION SET one last time: if a card with that pain already exists, you UPDATE it; you never write a second.

5. **Verdict + extension check (for each survivor).**
   - **Verdict** (asymmetric): **🏆 build** · **🧪 validate** (a key unknown → a concrete 7-day test) · **🔌 integrate** — but per the owner rule, "integrate" means **propose it as an EXTENSION of the named owned app** (`fold_into`), framed as new value for that app, NOT a near-duplicate standalone and NOT silently dropped.
   - **Scorecard** — 5 axes, H/M/L: **founder-fit** · **wedge** · **esfuerzo** (micro/small/large) · **demanda** · **retorno**.
   - The conviction hooks: **why now**, **por qué tú** (anchored to his channel/niche), **#1 surviving kill-risk**, **7-day validation step**, `painkiller_class`, `ground_truth_source`, `legal_risk`, `distribution_channel` (or "none" = low priority), `prior_workaround`.

6. **Audit before rendering (the anti-hype belt).** Run **SUCCESs** (Simple · Unexpected · Concrete · **Credible** —evidence with real links— · Emotional · Story) + the **YC Email Test** on the one-liner (if a smart friend can't re-explain it without a question, rewrite it). If **Credible** fails (no real evidence), do NOT show it. Persuasion goes AFTER the curation — only sell hard what passed the hard gates; the owner is an engineer and punishes hype on weak ideas with more distrust.

7. **Document the survivors as decision-ready cards.** Curate, don't buffet: **~4 total** (weighted to the profile), never the old pile. Cards at `factory/ideas/<slug>.md` (`_idea-template.md` format, `origin: discovery`, `status: discovered`), full frontmatter incl. the gate fields (`complexity_bucket`, `painkiller_class`, `ground_truth_source`, `legal_risk`, `prior_workaround`, `distribution_channel`) + the decision fields. Score with the SAME rubric as `new-idea` step 4 (single scale across the funnel) and record the one-line breakdown in `score_rationale:`. **The body MUST follow `_idea-template.md`'s rendering contract EXACTLY** — Mission Control's **Propuesta** tab parses these markers to render the rich memo (hero, coloured quote, feature grid + mock, red/green risk↔mitigation cards, pre-mortem & ask boxes, scorecard + chart). **Mirror the proven worked example at `plugin/templates/idea-card-example.md`** (a complete card that renders rich — copy its structure, headings and markers; colours/charts/bold are applied AUTOMATICALLY by the component from the markers, you never "paint" them). Use them verbatim (body is gitignored Spanish):
   - The lead `> **Veredicto: …** — **La apuesta:** <one-liner>` **and** a `> **Badges:** <veredicto> | cubeta: <MICRO·2-3 días|…> | <painkiller|vitamin|candy>·<descriptor> | retorno: <…>` line (PIPE-separated).
   - **`## 🔥 De un vistazo`** with `### subsections`: `### La apuesta` · `### El problema` (PAS prose **then** a real testimonial as a `> blockquote`) · `### Por qué ahora` · `### Por qué tú` (anchored to @pandadcollector / One Piece) · `### La visión` (4 `- **Title** — desc` bullets → feature grid; optional `**Vista previa — <url>**` + `- ✓`/`- !` lines → UI mock).
   - The scorecard `| Eje | founder-fit | … |` table.
   - **`## ❄️ Profundizar`** with `### subsections`: `### Mercado` (honest SOM) · `### Distribución` (channel, or "no channel = low priority") · `### Gaps y fuente de la verdad` (the ground-truth question + a `| Riesgo | Mitigación |` table) · `### Riesgo legal` (HIGH→kill / LOW→disclaimer) · `### Red team` (pre-mortem) · `### El ask` · `### Evidencia` (≥2 real links).

   The card `.md` is the **source of truth** (state + reasoning); the Propuesta tab renders it natively. **Never hand-author bespoke HTML per idea** (that invites fabricated numbers) — write the markdown markers and let the component render.

8. **Report = a decision view** (not a catalog). Everything presented is **genuinely NEW**. Lead with **the hero** (the one to build — chosen by pain + fit + buildability, NOT return type) + a one-line why. Then a **scannable table** of the curated shortlist (idea · veredicto · la apuesta · cubeta · fit-canal), then "**descartadas y por qué**" (killed this run, one line each), then "**extender lo que ya tienes**" (extension proposals, naming the app). Close with "*(omití N ideas que ya están en tu base, incluidas las descartadas)*". Verdict-first, scannable, ONE clear recommendation.

## Rules
- **Curate, don't buffet.** ~4 survivors max; kill the rest and show why. What you DON'T show is as much of the value as what you do.
- **Hot → cold (Klaff STRONG).** The dream first (it ilusiona), the rigor after (it gives criterio). Never open with the scorecard.
- **The new gates are mandatory and rendered:** founder-fit pre-filter · painkiller H/M/L (no gauge) · complexity bucket (micro/small/large, no day count) · ground-truth + legal (high=kill, low=disclaimer). Each appears in the memo.
- **3 return paths equal priority; bias to micro/small.** A `large` only with a near-sure monetary case, else re-scope or kill.
- **Market-reality for monetary ideas only.** A personal-utility idea (helps the owner's collection) is welcome without monetization.
- **Extension, not subsumption.** When a candidate overlaps an owned app, propose it as an **extension** of that app (don't freeze the app's scope, don't hide the idea, don't ship a near-duplicate standalone).
- **Never re-recommend — dedup by PROBLEM (Gate 3.0).** An idea whose **core pain** is already a card in ANY status — including **discarded** — is excluded for the whole run, even if renamed, re-angled, re-scoped, or built differently (a different *solution* to the same *pain* is NOT a new idea). A genuine improvement **updates the existing card**, never spawns a second. Discarding = `status: discarded`, never delete (the Descartado column IS the do-not-recommend memory). Learn from the discard REASON, not just the title; distil durable patterns into `factory/profile.md` (DR-053).
- **Evidence first** (≥2 real links, prefer 1-2★ reviews and past-behavior workarounds over opinion); **problem as PAS storytelling**; **anti-hype** (SUCCESs Credible + Email Test gate before showing); **don't inflate** the score.
- It runs on demand today; designed to also run as a scheduled job (no human) — in that case it only reports and records.
