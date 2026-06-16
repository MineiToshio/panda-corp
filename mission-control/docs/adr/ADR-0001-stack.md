# ADR-0001 — Trimmed Next.js stack for a local, read-only dashboard

- **Status:** Accepted
- **Date:** 2026-06-16
- **Scope:** Platform-level (cross-feature), Mission Control
- **Decided by:** the `architect` agent (Claude Opus 4.8), approved by the owner in the
  architecture phase (DR-002). The owner had already locked the stack in `PLAN.md`; this ADR
  records the rationale and the discards.

## Context

Mission Control is the Pandacorp factory's own dashboard, living **inside** the factory repo at
`panda-corp/mission-control/`. It is a **local, 100% read-only** tool with one hard rule: it
**never calls Claude and never executes anything** — it only reads files (the factory repo + the
user's `~/.claude/`) and renders state + a "next command" to copy. The single allowed write is
rewriting a card's `status: discarded` frontmatter (FRD-02).

This profile removes the usual reasons to reach for the full golden-path-A machinery (a database,
auth, a deploy pipeline, external services). We need the minimum that fulfils the 18 FRDs with
quality; over-engineering here is a defect.

Inputs consulted: `factory/standards/stack.md` (golden path A), the recommended-stack template
(`plugin/templates/stack-a-nextjs/STACK.md`), the factory durable conventions (`AGENTS.md`:
TS strict, isolated data layer, design tokens, TDD), the factory memory (`factory/memory/` — no
library verdict touches this stack today, so none is overridden), and `PLAN.md`/`CLAUDE.md` (the
in-factory deviations and the already-decided trim).

## Decision

Adopt **golden path A (Next.js)**, **trimmed** to an internal read-only tool:

- **Next.js `^16.2.7`** (App Router) — Server Components read the filesystem on the server.
- **TypeScript `^5.9.3`**, `strict` + `noUncheckedIndexedAccess` (factory convention).
- **React `^19.2.7`** (bundled with Next 16).
- **Tailwind CSS v4 `^4.1.13`** (CSS-first `@theme`; OKLCH tokens for FRD-13).
- **Biome `^2.4.16`** (lint + format; gate #1).
- **Vitest `^4.1.9`** + `@testing-library/react` + `jsdom` (TDD in `lib/`).
- **Data libs:** `gray-matter` (idea frontmatter), `yaml` (`status.yaml`/registry),
  `react-markdown` (doc rendering).
- **Package manager:** `pnpm`. **Node:** ≥20.9.

Excluded by design: **no database / ORM**, **no auth**, **no Docker / no t3-app generator**, **no
Claude SDK or subprocess execution**, **no Playwright/e2e in v1**, **no external services**
(storage/email/payments/analytics), **no deploy** (local `127.0.0.1` only).

### TypeScript version note
At decision time the npm `latest` for TypeScript is 6.0.x, but the Next 16 / `@types/*` /
Biome ecosystem at this date is validated against TypeScript **5.9.x**. To keep the foundation
green and low-risk we pin `typescript ^5.9.3` rather than chase the just-released 6.0 major. Revisit
once 6.0 is broadly validated against this toolchain.

## Discarded alternatives

- **Full golden path A via `create-t3-app` (with a DB + auth + tRPC).** Discarded: there is no
  database (the factory repo *is* the read-only data source), no users to authenticate (one local
  operator on `127.0.0.1`), and no need for a typed RPC layer when Server Components read the fs
  directly. It would add Prisma/Drizzle, NextAuth and migrations — pure over-engineering for a
  read-only viewer.
- **A database (Postgres/SQLite) as a cache/index of the factory state.** Discarded: it would
  duplicate the source of truth (the files), introduce a sync/staleness problem, and add ops where
  the goal is `$0` and zero maintenance. Tailing files + capped reads is sufficient (FRD-12).
- **Auth (even a single password).** Discarded: bound to `127.0.0.1`, single operator, no network
  exposure. Auth would add friction with no threat to mitigate.
- **Docker / a deploy target (Vercel, a VPS).** Discarded: it is a local tool by definition (no
  deploy, no production gate — `/release` here means "run it locally", CLAUDE.md). Hosting it would
  also risk exposing the owner's local factory data.
- **An AI/Claude SDK or a `claude -p` subprocess** (e.g. to summarize docs). Discarded: it
  violates the golden rule and would burn the subscription — the whole value hypothesis is "never
  calls Claude". MC only generates command *text* for the owner to paste.
- **ESLint + Prettier.** Discarded in favor of Biome (one fast tool; matches the factory standard).
- **Playwright / e2e in v1.** Deferred: the v1 gate is biome + tsc + vitest; e2e is optional later
  for critical flows only.
- **ELK.js for the FRD-12 DAG.** Pre-discarded in favor of **Dagre** (~39KB, cheaper) per FRD-12;
  added only when the DAG work orders land, not in the foundation.

## Consequences

- **Positive:** minimal dependency surface; the read-only invariant is auditable (no AI client in
  `package.json`; all writes isolated to `lib/discard.ts`); `$0/month`; one-person operable; the
  data layer is trivially testable with file fixtures (TDD); Server Components keep privileged
  fs/git access off the client.
- **Negative / trade-offs accepted:** reading files on every request (no cache layer) is fine at
  this scale but is not a high-throughput design — acceptable for a single local user. Robust
  live updates (file-watching) are Backlog; v1 uses polling/refresh. Pinning TS <6.0 means a
  later, deliberate upgrade. No deploy means the tool only exists where the factory repo is cloned —
  which is exactly the intent.
- **Follow-ups (noted, not blocking the foundation):** the factory's `emit-event.sh` should be
  namespaced by **project** so the Party can separate concurrent builds (the architecture's event
  contract already includes the new `project` field; MC reads it defensively and treats its absence
  as legacy/global). Tracked in the decision log.
