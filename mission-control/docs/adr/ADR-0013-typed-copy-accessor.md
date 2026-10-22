---
id: ADR-0013
type: adr
slug: typed-copy-accessor
title: A typed copy accessor over the frozen Spanish catalogue instead of an i18n library
status: ACCEPTED
supersedes:
last_updated: 2026-10-22
---

# ADR-0013 — A typed copy accessor over the frozen Spanish catalogue instead of an i18n library

- **Status:** Accepted (architecture stage 1, v2 «Órbita»; within the owner-approved stack, no new dependency)
- **Date:** 2026-10-22
- **Decided by:** the `architect` agent (Claude), implementing owner decisions already recorded: the
  Spanish interface with shown content in its own language (decision log 2026-10-21, ADR-0012 §2) and
  verbatim copy from the frozen catalogue (`docs/design/technical-assumptions.md` §1.4).

## Context

Mission Control v1 has no message catalogue: its Spanish strings are literals spread across components.
The Órbita freeze produced `docs/design/microcopy.es.json`, a nested key-value catalogue of 1,425
strings with `{name}` placeholders, frozen as part of the design contract (DR-080). The fidelity gate
compares rendered text with the prototype, so every interface string must come from that catalogue,
verbatim. The interface has exactly one locale (Spanish); the content MC only shows (documents, skill
descriptions, lessons, backlog items) keeps its own language and is never translated.

The factory's default for i18n in a Next.js App Router project is `next-intl` (`factory/standards/stack.md`,
`seo-i18n.md`; LESSON-0016). Its value is locale routing, `hreflang` alternates and per-locale message
loading. `seo-i18n.md` also says that a project with multilingual scope excluded adds no extra locale,
switcher or locale routing, while centralized launch-locale messages remain mandatory.

## Decision

All interface copy goes through one typed accessor, `t(key, vars?)`, in `src/lib/copy/`, created by
WO-13-010:

- It reads the frozen catalogue **in place** (`docs/design/microcopy.es.json`), so there is one copy of
  each string (DR-115); nothing is duplicated into `src/`.
- Keys are typed from the catalogue's shape, so a missing or misspelled key fails `tsc`, not the page.
- `vars` fill the catalogue's `{name}` placeholders; the accessor adds no formatting rules of its own.
- It works in Server and Client Components alike (no provider, no request-scoped locale).
- Implementers never edit the catalogue. A string the catalogue lacks is a design defect reported to the
  ledger (DR-130), never an inline literal. Corrections reach the catalogue through the design flow.
- Shown content and artifact names (FRD, PRD, ADR, work order, spec, backlog) bypass the accessor and
  render as written.

## Discarded alternatives

- **`next-intl`** (LESSON-0016, the factory default). Discarded for this project: with one locale and
  multilingual scope excluded, its locale routing, middleware and `hreflang` support have nothing to do,
  and it adds a provider boundary and a dependency to a tool that installs nothing in v2. LESSON-0016's
  trigger is "adding i18n or multi-locale routing", which this project does not do. If multilingual scope
  is ever approved, the keys move to `next-intl` messages unchanged.
- **Keep the literals and check them against the prototype.** Discarded: the fidelity gate would catch a
  drifted string only after the fact, and the same string would be typed by hand in several components.
- **Copy the catalogue into `src/`.** Discarded: two copies of a frozen contract drift (DR-115).

## Consequences

- **Positive:** one source per string; missing keys fail at compile time; no dependency; the gate's
  text comparison and the code read the same file.
- **Negative / trade-offs accepted:** the whole catalogue is importable by client bundles that use `t()`
  (small, text only); typing a 1,425-key nested object adds some type-checking cost; a future second
  locale means migrating the accessor, not just adding a file.
- **Follow-ups:** WO-13-010 builds the accessor; every UI work order uses it (v2 work-order map §0.1).
