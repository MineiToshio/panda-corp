---
title: "(short idea title)"
project_type: web | mobile | desktop | ai | claude-code | prompt-system | automation | cli | rework | other
origin: owner | discovery
status: discovered
status_before_discard: ""                    # written by Mission Control on discard: the status the card had before, so a restore can undo the discard
discard_reason: ""                           # written by Mission Control on discard: WHY it was rejected — feeds discover's rejection-pattern learning
verdict: build | validate | integrate      # the decision: do it / validate first / fold into an existing app
the_bet: ""                                  # one line: the crisp "why this wins" (the scannable hook)
fold_into: ""                                # if verdict=integrate, the existing app it belongs in (else empty)
why_now: ""                                  # the catalyst that makes this the right moment
kill_risk: ""                                # the #1 risk that survived the red team
validation_step: ""                          # a concrete 7-day test that would give go/kill evidence
score: 0
score_rationale: ""                          # one line: the weighted breakdown behind `score`, same rubric across the funnel (e.g. "pain 8×0.3 + ease 7×0.25 + return 6×0.25 + fit 7×0.2 = 71") — written by new-idea/discover
complexity_bucket: micro | small | large     # buildability: micro (a cotizapdf — one role/one flow/one feature, no external data source, no payments, ~2-3 días) / small (~1-2 weeks) / large (weeks, 10-15 FRDs — only with a near-sure monetary case)
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
created: YYYY-MM-DD                          # skills write the date; Mission Control may write a full ISO timestamp — both are valid
project: ""
---

> **Veredicto: 🏆 build | 🧪 validate | 🔌 integrate → <app>** — **La apuesta:** one crisp line — the product in a sentence (this becomes the hero one-liner). Lego language, no pizzazz.
> **Badges:** <veredicto> | cubeta: <MICRO·2-3 días | PEQUEÑA·1-2 sem | GRANDE> | <painkiller·viral | vitamin | candy> | retorno: <oportunidad+personal | monetary | …>

<!--
  RENDERING CONTRACT (Mission Control's Propuesta tab — IdeaPitch parses this body):
  · The body is two labelled blocks ("De un vistazo" hot, "Profundizar" cold), each a set of `### subsections`.
    Each `### Label` renders as a row: the label on the left, its rich markdown on the right.
  · The `> **Badges:** a | b | c` line (PIPE-separated, so a badge may contain `·`) renders the hero pills,
    auto-coloured (build→green, validate→amber, painkiller→magenta, retorno→blue, cubeta→neutral).
  · "El problema": write the storytelling prose, then a real testimonial as a `> blockquote` — it renders as a coloured quote.
  · "La visión": 4 `- **Title** — desc` bullets render as a 2×2 feature grid; an optional
    `**Vista previa — <url>**` line followed by `- ✓ …` / `- ! …` check lines renders as a UI mock preview.
  · "Gaps y fuente de la verdad" / any cold section: a `| Riesgo | Mitigación |` markdown table renders as
    red-risk / green-mitigation cards. Bold text inside it is coloured (risk red, mitigation green).
  · "Red team" renders as a red pre-mortem box; "El ask" as a highlighted box; "Evidencia" as a collapsible.
  · The scorecard `| Eje | founder-fit | … |` table renders as bars + an esfuerzo-vs-valor chart. Keep total copy ~400-600 words.
-->

## 🔥 De un vistazo

### La apuesta
The strategic bet in 1-2 lines — why this content/idea becomes a tool the owner would build (the prize framing, not the literal description, which is the one-liner above).

### El problema
PAS (Problema→Agitar→Aliviar): a concrete scene (who, the exact moment it hurts) → **agitate** the consequence/cost → the relief. Then a literal testimonial:

> "A real quote from a forum/review where someone voices this pain." — where it's from.

### Por qué ahora
The catalyst (tech / behavior / regulatory change) that opens the window — with the named source.

### Por qué tú
Founder-fit (Paul Graham's 3 traits) anchored CONCRETELY to the owner's channel/niche (@pandadcollector, One Piece, Funkos) — never generic ("the Peruvian SMB").

### La visión
- **Feature 1** — the dream capability in one line.
- **Feature 2** — …
- **Feature 3** — …
- **Feature 4** — …

**Vista previa — <app>.app/<ruta>**
- ✓ a concrete "looks-right" signal the UI would show
- ✓ another green signal
- ! a "check this" caution signal

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | H/M/L | H/M/L | micro/small/large | H/M/L | monetary/opportunity/… |

## ❄️ Profundizar

### Mercado
TAM/SAM/SOM landed on an **honest SOM** (bottom-up: "X collectors in Perú/LATAM × Y price = Z USD/mo"), and which of the 3 equal-priority return paths it serves. **Monetary ideas must validate the revenue rail in the owner's market (LATAM/Perú)**; a personal-utility idea is welcome even without monetization.

### Distribución
The acquisition play, audience-first: the named channel + a sales model viable in Perú (TikTok Live, MercadoLibre/Buscalibre affiliates, own store, subscription), "post the pain, not the product". If the collector channel does NOT apply, say so honestly: **"no channel for this = low priority"**.

### Gaps y fuente de la verdad
**¿De dónde saca la verdad la app?** (API / dataset / community / **owner-as-curator** / none) — with no credible source the verdict **cannot be build**. Frame it positively (bold key phrases — they render green), then the risk↔mitigation table:

| Riesgo | Mitigación |
|---|---|
| **Risk name** — its mechanism (concrete, e.g. a real precedent). | How it's neutralised (not a generic disclaimer). |
| **Second risk** — … | … |

### Riesgo legal
**HIGH → kill; LOW → present with a disclaimer** (owner rule). State the level and the disclaimer; bold the verdict (renders green when low/by-design).

### Red team
**Pre-mortem — "it failed in 6 months, why?":** the most likely failure. **Kill-shot #1:** the #1 surviving risk. **Mitigación:** the concrete de-risking step.

### El ask
Translated to Pandacorp: "this is a **<cubeta>** micro-app that returns **<return path>**". The complexity bucket + the return path, concrete, no rodeos.

### Evidencia
<!-- Each item renders as a "descripción — link" row: write the description, then an em-dash, then the link. -->
- What it proves, in one line — [source](https://…)
- … — [source](https://…)
(≥2 real links; prefer 1-2★ reviews / past-behavior workarounds over opinion.)

---
> Statuses (card lifecycle): discovered → recommended → in-pipeline → shipped | discarded.
> Transitions, each written by one skill: new-idea/discover → discovered; recommend → recommended; scaffold/spec (handoff) → in-pipeline; release → shipped. `discarded` is marked from Mission Control (human decision). The board is read-only.
> Once `in-pipeline`, fill `project:` with the created folder path and the card **freezes as a pointer**. The project's `.pandacorp/status.yaml` (`phase`) is the single source of truth for how far along it is; the board derives the middle columns from that phase (Mission Control FRD-02).
> `verdict` is the discovery decision (build/validate/integrate); a `discard` never becomes a card. `fold_into` names an existing owned app when the idea is better as its feature.
> The card `.md` is the source of truth; Mission Control's **Propuesta** tab renders this memo natively (the rendering contract above). Keep the headings/markers exactly (`### La apuesta`, `> **Badges:**`, `| Riesgo | Mitigación |`, `- ✓`/`- !`) so it renders rich.
