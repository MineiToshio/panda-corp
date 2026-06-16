# WO-07-009 — Standards section: categorized list + detail

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-standards-list`, `CMP-07-standard-detail`](../blueprint.md#3-components--interfaces).

## Goal
Render the Standards section: **categorized by domain** (Programming, Architecture, Design,
Technology, Quality, Security, Operation, Data/Privacy, Product/Docs), each standard with
**severity** (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate) badges, two views
(**Summary** key points + **Detail** markdown), and a **"New standard"** button copying
`/pandacorp:learn`.

## Acceptance criteria (EARS, from FRD-07)
- **AC-07-009.1** — The section SHALL group standards by domain (the 9 domains above), reading `readStandards()`.
- **AC-07-009.2** — Each standard SHALL show a **severity** badge (MUST/SHOULD/MAY) and an **enforcement** badge (lint/CI/checklist/human gate), paired with label/shape (not color alone, FRD-13).
- **AC-07-009.3** — Each standard SHALL offer a **Summary** view (real key points) and a **Detail** view (rendered markdown via `react-markdown`).
- **AC-07-009.4** — The section SHALL include a **"New standard"** button that **copies** `/pandacorp:learn` (clipboard, no exec).
- **AC-07-009.5** — The section SHALL render gracefully when a standard lacks metadata (falls back to derivation map / "Other", WO-07-004) — never empty, never crash.

## Dependencies
- WO-07-004 (`readStandards()`), WO-07-005 (page shell). Intra-feature.
- `CopyButton` (FRD-02), `react-markdown` (architecture §2). Cross-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for domain grouping, severity+enforcement badges, Summary/Detail toggle, copy-`/pandacorp:learn`, graceful no-metadata.
2. GREEN: implement categorized list + detail + badges + button.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; copy-only. `.pandacorp/verify.sh` passes.
</content>
