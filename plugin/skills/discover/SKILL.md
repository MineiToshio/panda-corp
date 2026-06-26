---
description: Searches the internet (Reddit, forums, 1-2★ reviews, social media, trends) for real opportunities —problems worth solving with a tech solution—, RED-TEAMS them against kill criteria, and documents only the survivors as decision-ready cards in the ideas base. Each survivor is a memo-pitch (hot→cold) that sells the dream AND gives the criterio to decide: problem, market, market-entry/distribution, technical gaps + source-of-truth, legal risk, all red-teamed. It blends two streams —general high-return opportunities and opportunities aligned with the owner's profile— biases toward easy-to-build micro-apps, and detects when an idea is better as an extension of an app the owner already has. Use when the owner asks "find opportunities", "discover ideas", "what could I build" or similar.
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

**Build the EXCLUSION SET (do NOT re-recommend).** Read **every existing idea card** `factory/ideas/*.md` in **ANY status** — discovered / recommended / in-pipeline / shipped / **discarded**. The `discarded` cards (the Descartado column) are the **single source of truth for rejected ideas**. Collect their titles + core concepts; anything already on the board in any status (including discarded) is excluded for the whole run (Step 4).

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

4. **Exclude — don't re-surface.** Any candidate matching the EXCLUSION SET (an existing card in ANY status incl. discarded) is **dropped from the run entirely** — not presented, not carded. (You MAY silently append genuinely new evidence to an existing *active* card.) Survivors must be **genuinely NEW**.

5. **Verdict + extension check (for each survivor).**
   - **Verdict** (asymmetric): **🏆 build** · **🧪 validate** (a key unknown → a concrete 7-day test) · **🔌 integrate** — but per the owner rule, "integrate" means **propose it as an EXTENSION of the named owned app** (`fold_into`), framed as new value for that app, NOT a near-duplicate standalone and NOT silently dropped.
   - **Scorecard** — 5 axes, H/M/L: **founder-fit** · **wedge** · **esfuerzo** (micro/small/large) · **demanda** · **retorno**.
   - The conviction hooks: **why now**, **por qué tú** (anchored to his channel/niche), **#1 surviving kill-risk**, **7-day validation step**, `painkiller_class`, `ground_truth_source`, `legal_risk`, `distribution_channel` (or "none" = low priority), `prior_workaround`.

6. **Audit before rendering (the anti-hype belt).** Run **SUCCESs** (Simple · Unexpected · Concrete · **Credible** —evidence with real links— · Emotional · Story) + the **YC Email Test** on the one-liner (if a smart friend can't re-explain it without a question, rewrite it). If **Credible** fails (no real evidence), do NOT show it. Persuasion goes AFTER the curation — only sell hard what passed the hard gates; the owner is an engineer and punishes hype on weak ideas with more distrust.

7. **Document the survivors as decision-ready cards.** Curate, don't buffet: **~4 total** (weighted to the profile), never the old pile. Cards at `factory/ideas/<slug>.md` (`_idea-template.md` format, `origin: discovery`, `status: discovered`), full frontmatter incl. the new fields (`complexity_bucket`, `painkiller_class`, `ground_truth_source`, `legal_risk`, `prior_workaround`, `distribution_channel`) + the decision fields. Body = the **memo-pitch, hot→cold** (Spanish headings — the body is gitignored Spanish):
   - **🔥 De un vistazo (open):** la apuesta · Problema as **PAS** (Problema→Agitar→Aliviar, with a literal real quote) · por qué ahora · **por qué tú** (anchored to @pandadcollector / collecting / One Piece) · **la visión** (dream features as the prize).
   - **❄️ Profundizar (collapsible):** Mercado (honest SOM) · **Entrada al mercado / distribución** (channel named, or "no channel = low priority") · **Gaps y riesgos** (ground-truth + legal, each risk paired with its mitigation) · Red team / pre-mortem · El ask · Similares · Evidencia (≥2 real links) · Notas de evaluación · the scorecard table.

   The card `.md` is the **source of truth** (state + reasoning). Mission Control's **Propuesta** tab renders this memo as a native React component (Atelier tokens). If an owner-facing standalone HTML memo is generated, it **derives** from this `.md` — never hand-author bespoke HTML per idea (that invites fabricated numbers).

8. **Report = a decision view** (not a catalog). Everything presented is **genuinely NEW**. Lead with **the hero** (the one to build — chosen by pain + fit + buildability, NOT return type) + a one-line why. Then a **scannable table** of the curated shortlist (idea · veredicto · la apuesta · cubeta · fit-canal), then "**descartadas y por qué**" (killed this run, one line each), then "**extender lo que ya tienes**" (extension proposals, naming the app). Close with "*(omití N ideas que ya están en tu base, incluidas las descartadas)*". Verdict-first, scannable, ONE clear recommendation.

## Rules
- **Curate, don't buffet.** ~4 survivors max; kill the rest and show why. What you DON'T show is as much of the value as what you do.
- **Hot → cold (Klaff STRONG).** The dream first (it ilusiona), the rigor after (it gives criterio). Never open with the scorecard.
- **The new gates are mandatory and rendered:** founder-fit pre-filter · painkiller H/M/L (no gauge) · complexity bucket (micro/small/large, no day count) · ground-truth + legal (high=kill, low=disclaimer). Each appears in the memo.
- **3 return paths equal priority; bias to micro/small.** A `large` only with a near-sure monetary case, else re-scope or kill.
- **Market-reality for monetary ideas only.** A personal-utility idea (helps the owner's collection) is welcome without monetization.
- **Extension, not subsumption.** When a candidate overlaps an owned app, propose it as an **extension** of that app (don't freeze the app's scope, don't hide the idea, don't ship a near-duplicate standalone).
- **Never re-recommend.** An idea already a card in ANY status — including **discarded** — is excluded for the whole run. Discarding = `status: discarded`, never delete (the Descartado column IS the do-not-recommend memory). Learn from the discard REASON, not just the title; distil durable patterns into `factory/profile.md` (DR-053).
- **Evidence first** (≥2 real links, prefer 1-2★ reviews and past-behavior workarounds over opinion); **problem as PAS storytelling**; **anti-hype** (SUCCESs Credible + Email Test gate before showing); **don't inflate** the score.
- It runs on demand today; designed to also run as a scheduled job (no human) — in that case it only reports and records.
