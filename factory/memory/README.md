# Factory memory — the cross-project engineering brain

This is the factory's **durable, cross-project engineering memory**: the lessons learned while
building real projects, captured once and reused so every future build is smarter and faster. It is
the substrate that lets the factory "get better with use" without retraining any model — the same
gradient-free, externalized-memory pattern used by A-MEM, Letta/MemGPT, Voyager and Anthropic's
memory tool (see `docs/proposals/09-self-learning-factory.md`).

Policy: **DR-047** (`factory/decisions/registry.yaml`). History: `factory/decision-log.md` (2026-06-15).

## What this is (and is not)

- **Committed English know-how**, like `factory/standards/` — it is the *company's* knowledge, shared
  by anyone who clones the factory. It is **NOT** owner personal data (DR-033): nothing here names the
  owner, a customer, a secret, or a specific business strategy. Project-specific or strategic notes
  stay in the gitignored Spanish layers (`portfolio.md`, `iteration.md`, `summary.md`).
- **Raw, evolving lessons**, not yet a rule. A lesson is an observation harvested from experience.
  When a lesson proves durable and general, it is **promoted** to its canonical home:
  - a recurring engineering rule → a `factory/standards/` standard,
  - a recurring decision with a default → a `DR` in `factory/decisions/registry.yaml`,
  - a recurring capability gap → a new `plugin/skills/` skill (via `learn` + `skill-creator`).
  Memory is where know-how *incubates*; standards/registry/skills are where it *graduates*.

## Lesson types

| Type | Captures | Example trigger |
|---|---|---|
| `problem-solution` | A concrete problem and how it was solved | a bug fixed in a project |
| `library-verdict` | A dependency that worked or failed, and why | a library chosen in blueprint, judged after use |
| `pattern` | A reusable approach that worked well | the reviewer praises the same approach twice |
| `gotcha` | A non-obvious trap in a tool/service/API | "Vercel Hobby suspends the whole account" |
| `anti-pattern` | An approach to avoid, and what to do instead | the reviewer flags the same mistake ≥2× |

## Frontmatter schema

```yaml
---
id: LESSON-NNNN            # zero-padded, monotonic
type: problem-solution | library-verdict | pattern | gotcha | anti-pattern
domain: <area>            # e.g. auth, payments, nextjs, data-modeling, factory-engineering
tags: [<kw>, <kw>]        # for retrieval
context: <one line>       # what this lesson is about — used to match it at retrieval time
source: <project + capture point or doc reference>
provenance: owner-stated | ci-verified | agent-inferred   # trust source (owner > CI > agent); gates promotion
created: YYYY-MM-DD
status: candidate | active | deprecated
promotion: none | proposed | approved | rejected   # rule-promotion track; `proposed` = pending your approval (review anytime via /pandacorp:memory status)
confidence: low | medium | high
times_applied: 0          # incremented when an agent retrieves+uses it (drives pruning)
links: [LESSON-XXXX, DR-XXX, standards/<file>.md]
---
```

## Capture → refine (the hybrid flow)

Lessons are **captured always-on**: in any skill or plain conversation, a one-line candidate is jotted to a raw inbox (`.pandacorp/run/lessons.md` per project, `factory/memory/_inbox.md` in the factory — both gitignored, provisional). The `librarian` then **refines** the inbox (plus project traces) into the clean `LESSON-*.md` here, with **A.U.D.N. dedup** (each candidate resolves to ADD / UPDATE / MERGE / NO-OP, so capturing a lot does NOT bloat the store) and **provenance** (owner-stated > ci-verified > agent-inferred). Refining runs at skill boundaries, on a scheduled sweep, and on demand (`/pandacorp:memory`).

## Lifecycle (the tiers of DR-047)

1. **Harvest → `candidate`.** The harvester (Phase 1) proposes a candidate at a capture point. A
   candidate is *never* treated as confirmed truth (anti-poisoning; the ExpeL finding that
   reflections-on-reflections poison insight extraction).
2. **Eval-gate → `active`.** A candidate becomes `active` (low-risk, auto) when it is schema-valid
   **and** corroborated (seen ≥2× OR confirmed by a real outcome) **and** does not contradict a
   higher-confidence lesson. Everything else escalates to the owner (Mission Control Propuestas
   inbox, FRD-17).
3. **Retrieve.** Agents query this store by `domain`/`tags` before `design`/`blueprint`/`implement`
   and pull the relevant lessons into context. Retrieval is the whole point — a lesson nobody recalls
   is a graveyard, not a memory.
4. **Promote.** When `review` judges a lesson rule-worthy it sets **`promotion: proposed`** (durable —
   it sits in the lesson file, reviewable anytime via `/pandacorp:memory status` or the Mission Control
   proposals page, FRD-17; you are never forced to decide in the moment). On your approval, `learn`
   promotes it to a standard/DR/skill (verifier/benchmark eval-gate) and sets `promotion: approved` +
   back-links; if you reject, `promotion: rejected` (it stays a useful lesson, just not a rule).
   High-risk promotions always pass the owner.
5. **Prune → `deprecated`.** The prune job (Phase 4) proposes deprecating lessons never retrieved in
   N months or contradicted by newer evidence. **Never delete** — deprecate (DR-011/DR-007). A
   `library-verdict` that failed once but is fixed later is *reconciled*, not erased.

## Worked example — `library-verdict`

```markdown
---
id: LESSON-0042
type: library-verdict
domain: pdf-generation
tags: [pdf, rendering, serverless]
context: server-side PDF generation on Vercel serverless functions
source: project "facturas" — blueprint choice + reviewer finding
created: 2026-07-10
status: active
confidence: high
times_applied: 3
links: [DR-036]
---
**Need:** generate invoice PDFs server-side on Vercel.
**Tried:** `puppeteer` — FAILED. Chromium exceeds the serverless bundle/size & cold-start limits.
**Use instead:** `@react-pdf/renderer` (no headless browser) — WORKED, fast cold starts.
**Recommend next time** this need appears: reach for `@react-pdf/renderer`; avoid `puppeteer` on serverless.
```

When a future project hits "server-side PDF on serverless", the agent retrieves this and skips the
trap — that is the factory getting faster with use.

## Conventions

- One lesson per file: `LESSON-NNNN-<short-kebab-slug>.md`.
- Copy `_lesson-template.md` to start.
- English (committed know-how). The agent still talks to the owner in Spanish (DR-009).
- Link liberally in `links:` — a link to a not-yet-written lesson marks something worth writing.
