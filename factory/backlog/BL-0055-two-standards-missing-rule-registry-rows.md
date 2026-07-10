---
id: BL-0055
type: bug
area: standards
title: "check-standards.sh is RED: document-consistency.md and single-source-of-truth.md have no rule-registry.md rows"
status: open
severity: p1
opened: 2026-07-09
closed:
source: "panda-corp 2026-07-09, promoting LESSON-0001 via /pandacorp:learn — `bash factory/standards/check-standards.sh` exits 1 with two FAILs unrelated to that change"
closes:
links: [DR-116, DR-115]
---

## Problem
`bash factory/standards/check-standards.sh` exits 1 today, on a clean tree, with:

```
FAIL document-consistency.md: not represented in rule-registry.md (every standard needs registry rows)
FAIL single-source-of-truth.md: not represented in rule-registry.md (every standard needs registry rows)
```

Two standards shipped (`factory/standards/document-consistency.md`, DR-116; `factory/standards/single-source-of-truth.md`, DR-115) without adding their rows to `factory/standards/rule-registry.md`. The registry is the catalog's health metric — the % of rules with a named automated check, and the burn-down list of aspirational MUSTs. Two standards missing from it means their rules are invisible to that metric, and the shape gate that would have caught it is itself red, so it can no longer catch the NEXT omission (a red gate nobody can go green on stops being read).

Impact: the standards catalog cannot be validated end-to-end; any future `/pandacorp:learn` that runs `check-standards.sh` sees a pre-existing red and has to reason about whether it caused it.

## Root cause
`/pandacorp:learn` step 3 tells the author to update `factory/standards/README.md` (the index) but the registry-row obligation is stated only in `rule-registry.md`'s own preamble ("Update the row in the same change") and in the README's shape section — nothing blocked the change. `check-standards.sh` exists precisely to catch this, but it is not wired into any hook, gate or routine: nobody runs it, so the two omissions landed and sat. Promise-without-mechanism, one level up: the *checker* of the catalog has no trigger.

## Fix plan
1. Add the missing rows to `factory/standards/rule-registry.md`, following the existing format (`| ID | Rule | Sev | File | Enforced by | Status |`). Derive each rule and its honest enforcement status from the standard's own "How it is verified" section — do **not** invent a `wired` status:
   - `document-consistency.md` → the fresh-set blocking verifier (spec/architecture phase gates), the supersession-completeness check (change/iterate/learn), the advisory `pandacorp-consistency-sweep` routine. Prefix `DOCC-`.
   - `single-source-of-truth.md` → the single-writer law and its checks (DR-115). Prefix `SSOT-`.
2. Give `check-standards.sh` a trigger so it cannot silently rot again. Cheapest honest option: call it from the `pandacorp-consistency-sweep` routine (`plugin/docs/routines.md`) and from `/pandacorp:learn`'s closing step, reporting its exit code. A Stop hook is the stronger option but adds per-turn cost — pick one and record the choice.
3. Record the decision in `factory/decision-log.md`.

## Tests (prove the fix — RED → GREEN)
- RED now: `bash factory/standards/check-standards.sh; echo $?` → `1` with the two FAILs above.
- GREEN after: same command → `0`.
- Regression canary: temporarily add a throwaway `factory/standards/zz-canary.md` with a valid preamble and no registry row; assert the script still exits 1 (the gate detects a missing row), then delete it.

## Done when
- `bash factory/standards/check-standards.sh` exits 0 on a clean tree.
- Both standards have rows in `rule-registry.md` with an honest `wired`/`manual`/`aspirational` status.
- The script has a named trigger (routine step or hook), documented where that trigger lives.
- `factory/decision-log.md` carries the entry.

## Out of scope
Re-auditing the enforcement status of the other ~116 rows (that is the periodic catalog audit, docs/proposals/24). This item only closes the two missing standards and wires the checker.
