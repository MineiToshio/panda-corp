---
title: "(short idea title)"
project_type: web | mobile | desktop | ai | claude-code | prompt-system | automation | cli | rework | other
origin: owner | discovery
status: discovered
discard_reason: ""                           # set on discard (from Mission Control): WHY it was rejected — feeds discover's rejection-pattern learning
verdict: build | validate | integrate      # the decision: do it / validate first / fold into an existing app
the_bet: ""                                  # one line: the crisp "why this wins" (the scannable hook)
fold_into: ""                                # if verdict=integrate, the existing app it belongs in (else empty)
why_now: ""                                  # the catalyst that makes this the right moment
kill_risk: ""                                # the #1 risk that survived the red team
validation_step: ""                          # a concrete 7-day test that would give go/kill evidence
score: 0
complexity_bucket: micro | small | large     # buildability: micro (a cotizapdf — one role/one flow/one feature, no external data source, no payments) / small (~1-2 weeks) / large (weeks, 10-15 FRDs — only with a near-sure monetary case)
painkiller_class: painkiller | vitamin | candy  # how acute the pain is (with the evidence that classifies it, in the body)
ground_truth_source: ""                      # where the app gets "the truth" (API / dataset / community / the owner-as-curator / "n/a") — empty/"none" forbids verdict:build for truth-claiming ideas
legal_risk: none | low | high                # none / low (present with a disclaimer) / high (kill — DR owner rule)
prior_workaround: ""                          # the manual workaround people use today (spreadsheet, manual process) — the #1 willingness-to-pay signal; "" = none found
distribution_channel: ""                      # the named acquisition channel (e.g. @pandadcollector, TikTok Live) or "none" (then = low priority, say so honestly)
difficulty: low | medium | high              # technical hardness (distinct from complexity_bucket = scope); optional
profile_alignment: low | medium | high
return_type: monetary | opportunity | personal | mixed
likely_stack: [A, D]
evidence: []
created: YYYY-MM-DD
project: ""
---

# (Title)

> **Verdict: 🏆 build | 🧪 validate | 🔌 integrate → <app>** — **La apuesta:** one line, the crisp "why this wins".
> Badges: `complexity_bucket` (micro/small/large) · `painkiller_class` (painkiller/vitamin/candy) · `legal_risk` (none/low/high).

The body is ordered **hot → cold** (Klaff STRONG): the dream first (so it ilusiona), the rigor after (so it gives criterio). Same facts, persuasive order. Keep the copy tight (≈400-600 words total); the visuals carry the weight in the rendered HTML memo.

## 🔥 De un vistazo
The hot block — make the owner *feel* it before he analyzes. Keep each to 1-2 lines.
- **Problema (PAS · Problema→Agitar→Aliviar):** a concrete scene (who they are, the exact moment it hurts) → **agitate** the consequence (what it costs them) → the relief. Anchor it with a literal quote from a real review/post.
- **Por qué ahora:** the catalyst (tech / behavior / regulatory change) that opens the window.
- **Por qué tú (founder-fit, Paul Graham's 3 traits):** something the owner or his niche *already live* · Pandacorp can build it · few see it's worth doing — anchored CONCRETELY to his channel/niche (@pandadcollector, One Piece, Funkos), **never** generic ("the Peruvian SMB").
- **La visión (the prize):** the dream features described as the prize, with a preview of the gamified RPG UI he loves.

## ❄️ Profundizar
The cold block — the criterio to decide with a clear head. Read more if the glance interested you.

### Mercado
TAM/SAM/SOM **landed on an honest SOM** (bottom-up: "X collectors in Perú/LATAM × Y price = Z USD/month"), and which of the 3 equal-priority return paths it serves (hit / micro-app 100-200/mo / personal). **Monetary ideas must validate the revenue rail in the owner's market (LATAM/Perú)**; a personal-utility idea (helps the owner's own collection) is welcome even without monetization.

### Entrada al mercado / distribución
The acquisition play, audience-first: the named channel + a sales model viable in Perú (TikTok Live, MercadoLibre/Buscalibre affiliates, own store, subscription), "post the pain, not the product". If the collector channel does NOT apply (e.g. a B2B idea), say so honestly: **"no channel for this = low priority"** — never fill a generic template.

### Gaps y riesgos
- **Fuente de la verdad (ground-truth) — mandatory when the app emits a judgment:** *where does the app get the truth?* (API / dataset / community / owner-as-curator / **none**). With no credible source the verdict **cannot be build** — it drops to validate or re-scopes (e.g. an "authenticator" → an expert-curated "signal checklist" that educates, never dictates a verdict).
- **Riesgo legal — framed first, each risk paired with its mitigation.** Owner rule: **high legal risk → kill; low → present with a disclaimer** (a generic disclaimer does NOT neutralize a high risk).
- The other 2-3 risks the decider would ask about, each with its concrete mitigation.

### Red team (pre-mortem)
"It's 6 months later and this failed — why?" → the #1 kill-shot + its mitigation + the final verdict. Rendered, not hidden.

### El ask
Translated to Pandacorp: "this is a `<complexity_bucket>` micro-app that returns `<return path>`". The complexity bucket + the return path, concrete, no rodeos. A `large` idea is only proposed with a near-sure monetary case; otherwise re-scope to its core or kill.

### Similares (what already exists)
The real existing products/competitors, one line + link each — or an explicit "no direct equivalent found".

### Evidencia
≥2 links to real Reddit/forum/social posts or 1-2★ reviews where people express this pain or demand (behavior over opinion — The Mom Test), or the owner's personal context.

### Notas de evaluación
What the scoring considered: pain/need, painkiller-class (with the evidence), complexity bucket, ground-truth + legal, return/fit, and why the verdict.

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | H/M/L | H/M/L | micro/small/large | H/M/L | monetary/opportunity/… |

---
> Statuses (card lifecycle): discovered → recommended → in-pipeline → shipped | discarded.
> Transitions, each written by one skill: new-idea/discover → discovered; recommend → recommended; scaffold/spec (handoff) → in-pipeline; release → shipped. `discarded` is marked from Mission Control (human decision). The board is read-only.
> Once `in-pipeline`, fill `project:` with the created folder path and the card **freezes as a pointer** — it STOPS tracking the phase. The project's `.pandacorp/status.yaml` (`phase`) is the single source of truth for how far along the project is; the board derives the middle columns (documented/design/architecture/building) from that phase, NOT from the card status (see Mission Control FRD-02). There is no `documented` card status — the "Documentada" column = a project in phase `product`.
> `verdict` is the discovery decision (build/validate/integrate); a `discard` never becomes a card (it's red-teamed out before carding). `fold_into` names an existing owned app when the idea is better as its feature than a new project.
> The card `.md` is the source of truth (state + reasoning); Mission Control's **Propuesta** tab renders this memo as a native React component (DR — discover redesign). The owner-facing HTML memo (if generated) derives from this `.md`, never the other way around.
