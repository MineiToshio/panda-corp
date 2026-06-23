---
title: "(short idea title)"
project_type: web | mobile | desktop | ai | claude-code | prompt-system | automation | cli | rework | other
origin: owner | discovery
status: discovered
verdict: build | validate | integrate      # the decision: do it / validate first / fold into an existing app
the_bet: ""                                  # one line: the crisp "why this wins" (the scannable hook)
fold_into: ""                                # if verdict=integrate, the existing app it belongs in (else empty)
why_now: ""                                  # the catalyst that makes this the right moment
kill_risk: ""                                # the #1 risk that survived the red team
validation_step: ""                          # a concrete 7-day test that would give go/kill evidence
score: 0
difficulty: low | medium | high
profile_alignment: low | medium | high
return_type: monetary | opportunity | personal | mixed
likely_stack: [A, D]
evidence: []
created: YYYY-MM-DD
project: ""
---

# (Title)

> **Verdict: 🏆 build | 🧪 validate | 🔌 integrate → <app>** — **La apuesta:** one line, the crisp "why this wins".

## At a glance
Decide here. Keep each to 1-2 lines.
- **Problema (storytelling):** a concrete scene — who they are, the exact moment it hurts, what it costs them. Not an abstract "users can't do X".
- **Diferencial:** the wedge, in one line.
- **Por qué ahora:** the catalyst.
- **Por qué tú:** founder-fit — the channel/asset/niche that makes this *yours*.
- **Riesgo #1:** the kill-risk that survived the red team.
- **Test de 7 días:** the concrete validation that would give go/kill.

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | H/M/L | H/M/L | ~N semanas | H/M/L | monetary/opportunity/… |

## Deep dive
Read more if the glance interested you.

### Proposed solution
What we would build, in 2-4 sentences.

### Features
High-level bullets of the key / **dream** capabilities (aspirational, not exhaustive).

### Similar (what already exists)
The real existing products/competitors, one line + link each — or an explicit "no direct equivalent found".

### Comparison & differential value (why ours)
How it stacks up against the similar ones and the clear **wedge**: why ours wins / where the value is.

### Return (monetary or opportunity)
What the owner gains — monetary and/or opportunity (reach/network/positioning) and/or personal. If it leverages an asset (audience, community, niche, data), say so. **Validate the revenue rail in the owner's market** (e.g. Perú): does the affiliate program / payment processor / ad network actually exist and pay there, or does the model only work abroad (then say so, and whether it's *build-for-others*)?

### Red team (why it could fail)
The 2-3 kill-risks with their mechanism (the pre-mortem). Be concrete: not "strong competition" but "Incumbent X ships this natively, covering 80% of the use case".

### Evidence
Links to Reddit/forum/social posts where people express this pain or demand, or the owner's personal context.

### Evaluation notes
What the scoring considered: need/pain, ease, return, fit (alignment + advantage), and why the verdict.

---
> Statuses (card lifecycle): discovered → recommended → in-pipeline → shipped | discarded.
> Transitions, each written by one skill: new-idea/discover → discovered; recommend → recommended; scaffold/spec (handoff) → in-pipeline; release → shipped. `discarded` is marked from Mission Control (human decision). The board is read-only.
> Once `in-pipeline`, fill `project:` with the created folder path and the card **freezes as a pointer** — it STOPS tracking the phase. The project's `.pandacorp/status.yaml` (`phase`) is the single source of truth for how far along the project is; the board derives the middle columns (documented/design/architecture/building) from that phase, NOT from the card status (see Mission Control FRD-02). There is no `documented` card status — the "Documentada" column = a project in phase `product`.
> `verdict` is the discovery decision (build/validate/integrate); a `discard` never becomes a card (it's red-teamed out before carding). `fold_into` names an existing owned app when the idea is better as its feature than a new project.
