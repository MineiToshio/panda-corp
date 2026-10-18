# Decision round (architecture step 1, DR-131)

The owner decides every owner-visible technical choice in ONE round, with context and alternatives, BEFORE any
document under `docs/` is written. Everything else follows the standards silently.

**Why.** In funko-tracker (2026-10-16/17) the stack was approved as one block and two choices inside it were made
silently by the architect: product images stored in R2, and an in-app operator console for ingestion. The owner
reversed both after the docs existed: ADR-0012 (ingestion as owner-run skills over an ops CLI, FRD-06/07 rewritten,
10 work orders regenerated) and ADR-0013 (official images hotlinked by URL, the media model reshaped, about 20 work
orders touched, a delta round on all three gates). One question each would have settled them in minutes, and one of
them had prior art in another factory project (OP Character Dex hotlinks card images through a same-origin proxy).

## 1. What counts as a decision

Ask when the choice has an **owner-visible trade-off**: monthly cost, legal or rights exposure, a workflow the owner
will personally operate, something the end user sees, or lock-in that is expensive to undo. Do NOT ask about choices
with no such trade-off (folder layout, lint config, ORM inside the golden path, test runner): those follow
`factory/standards/` and the registry. Ten crisp questions beat thirty.

## 2. Mandatory triggers

Scan `docs/product/prd.md`, every `frd.md` + `fdd.md`, `docs/design/technical-assumptions.md` and
`.pandacorp/idea-origin.md`. Whenever the product has the item, it is a decision in the round:

| # | Trigger | Typical alternatives to lay out |
|---|---|---|
| 1 | Stack and any golden-path deviation (`factory/standards/stack.md`, latest stable) | golden path · the deviation with its reason |
| 2 | Hosting and the monthly cost envelope (DR-005 for anything paid; DR-035/038 payments on Vercel) | free tiers · the paid plan with the amount |
| 3 | **Media and third-party content**: where images/files/video come from, and store vs hotlink vs same-origin proxy, rights stance, fallback, link rot | store in object storage · hotlink by URL · same-origin proxy (allowlisted hosts) · no images |
| 4 | **Data ingestion and curation**: in-app pipeline vs owner-run agent skills over a CLI vs manual entry; and whether an admin/operator web UI is needed at all | web console · skills + ops CLI · seed files · none in v1 |
| 5 | External data sources: access and legal (scraping vs ToS, licensed feed, owner-supplied evidence), rate limits | official API · licensed feed · read-through-a-browser curation · manual |
| 6 | Background compute (worker, queue, schedule) and the AI provider + cost per run | none · cron · queue + worker · owner-triggered |
| 7 | Auth methods and account-deletion promises | email + password · OAuth providers · magic link; erasure window |
| 8 | Email and notifications | none · transactional provider · in-app only |
| 9 | Analytics consent and PII | cookieless · consent banner · none |
| 10 | Backups and retention | provider snapshots · own dumps · retention window |
| 11 | **Prior art**: anything the owner already solved in another factory project | reuse that pattern · do it differently, with the reason |

Content-heavy product: also say plainly that the app build and the real-content production are separate tracks
(fixtures exist to exercise the app; the real catalog is produced later by its own flow, BL-0244), and ask only if
the owner might expect otherwise.

## 3. Research, verified live

- **Prior art first.** Read `factory/portfolio.md` (gitignored; skip if absent) and the sibling projects it points
  to: their `docs/product/architecture.md` and `docs/adr/`. Grep `factory/memory/INDEX.md` for the trigger
  (hotlink, scraping, ingestion, storage, auth...). When a sibling solved it, the brief says so in one line
  ("En <proyecto> lo resolvimos así: ...") and that option is usually the recommendation. Legal/rights calls on an
  unproven MVP: present the reversible mitigation first (credit, link, honour takedowns), LESSON-0343.
- **Verify, never recommend from memory.** Test what can be tested and record the date and the evidence: response
  headers of the actual media URLs (`curl -sI`: `cross-origin-resource-policy`, `cache-control`, status from a
  non-browser client), the terms/ToS page, the pricing page, the API's rate limits and auth. The `researcher` reads
  the web; the LEAD runs the commands (`researcher`/`architect` have no Bash). A fact you could not verify is
  labelled "no verificado".
- Budget: about 20 to 40 minutes of research for the whole round. Spikes that need code wait for step 5.

## 4. The brief

The `architect` drafts it (the lead adds the verified facts), in Spanish, at
`.pandacorp/comms/arquitectura-decisiones.md` (gitignored comms layer, written in the MAIN checkout so it survives
the worktree). One block per decision:

```markdown
### D3 · Imágenes de producto: guardar, enlazar o servir por proxy

**Contexto:** por qué importa en ESTE producto (FRD-02 AC-02-003.1 muestra la foto; FRD-05 la usa en el póster).
**Alternativas:**
| Opción | Costo/mes | Riesgo (incl. legal) | Esfuerzo | Qué operas tú |
|---|---|---|---|---|
| A · Enlazar la URL oficial (recomendada) | 0 | medio: sin licencia, mitigado con crédito y retiro a pedido | bajo | nada |
| B · Proxy del mismo origen | 0 | igual que A | medio | nada |
| C · Copiar a R2 | ~0,5 USD | alto: copia sin licencia | alto | nada |
**Recomendación:** A, porque ... (y B si un host bloquea el embebido).
**Hechos verificados (2026-10-17):** `curl -sI <url>` → 200, sin `cross-origin-resource-policy`; términos: <URL>.
**Precedente:** en OP Character Dex enlazamos las imágenes de Bandai por un proxy del mismo origen.
**Costo de cambiarlo después:** alto (modelo de datos, ~20 work orders).
```

Start the file with a one-table summary (decisión · recomendación · costo/mes). The chat message is that table plus
the link to the file, never the whole brief.

## 5. Asking (one round)

- `AskUserQuestion`, at most 4 questions per call; send the calls back to back as one round. Each question: a
  short header, 2 to 4 options, the **recommended option first** with "(Recomendada)" in its label, one-line
  descriptions with the cost/risk difference. Other runtimes ask in chat with the same shape.
- "Como recomiendes" accepts every recommendation. A question the owner skips or declines takes the
  recommendation, recorded as "por defecto, el owner no eligió".
- Ask once. A follow-up question is allowed only when an answer opens a new decision (e.g. "proxy" makes the host
  allowlist a question). Never reopen a locked decision on your own.

## 6. Locking the answers

- One ADR per decision (`docs/adr/NNNN-<slug>.md`, `${CLAUDE_PLUGIN_ROOT}/templates/docs/adr-template.md`): the
  context, the alternatives considered, the decision, "decided by the owner on YYYY-MM-DD" (or "default"), and the
  consequences. A dated entry in `docs/decision-log.md` links them.
- `docs/product/architecture.md` takes the decisions as given (its "Media & third-party content" and "Operations &
  admin tooling" sections are filled from D3/D4 even when the answer is "none in v1").
- An FRD that contradicts an answer is amended by the `product-manager` before step 9 (same rule as step 5).
- Changing a locked decision later is an owner decision again (`/pandacorp:decide` or `/pandacorp:change`), never a
  blueprint author's call. When the owner changes one mid-phase, re-plan only what it touches and run a delta review
  (`gates.md` §5), not a full regeneration.
