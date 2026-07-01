---
id: BL-0011
type: bug
area: build-engine
title: A needs-owner-BLOCKED route must not red-lock the whole-project gate (baseline/close-out/sibling FRDs)
status: open
severity: p2
opened: 2026-07-01
closed:
source: LESSON-0005
closes:
links: [LESSON-0005, DR-085, DR-075, DR-055]
---

**Problem:** The whole-project gates assert over EVERY nav route — `shell.spec.ts` (Shell-Presence,
DR-075) checks `<main>` on each destination, and the baseline `verify.sh` (baseline self-heal on resume +
the close-out) runs that suite. When one route's owning work order is legitimately `BLOCKED: needs-owner`
(personal-page-v2 FRD-07 `/contact` fails-loud without `NEXT_PUBLIC_WEB3FORMS_KEY`), that single node turns
the whole-project gate RED — which then blocked the unrelated FRD-01 foundation from closing and blocked
the baseline on resume. The per-FRD `--since` gates missed it (they don't run `shell.spec` on contact), so
the coupling only bit at the FULL gate. Net: a one-form env var stalled an otherwise-finishable build.
Evidence: runs `wf_9e98acaf-92e` / `wf_978129ab-eca`.

**Fix plan:**
1. **Make the whole-project gate blocked-route-aware.** When the engine runs the baseline self-heal /
   close-out / a whole-project re-gate, it must pass the set of routes owned by work orders currently in
   `BLOCKED: needs-owner` and EXCLUDE those routes' deterministic assertions (shell-presence / smoke /
   visual), or treat their failure as ADVISORY (loud, non-fatal) — until the block clears. Touch
   `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (the baseline self-heal + FRD/close-out
   gate steps that shell out to `verify.sh`): derive the blocked-route set from the work-order frontmatter
   (`implementation_status: BLOCKED` + `blocked_reason: needs-owner` + the WO's `artifacts`/route) and thread
   it to the gate as a skip-list.
2. **Give `verify.sh` a skip mechanism the engine can drive.** Add an env/flag (e.g.
   `PANDACORP_GATE_SKIP_ROUTES="/en/contact,..."`) the e2e specs read (`e2e/shell.ts`/`routes.ts` filter, or
   a Playwright `grepInvert`) so the shell/smoke/visual gates omit a quarantined route. Keep it fail-closed:
   only a route whose WO is provably `BLOCKED: needs-owner` may be skipped, and the skip is logged loudly.
3. **Standard.** Document the "blocked node is quarantined, not coupled" rule in
   `factory/standards/build-orchestration.md` (gate + needs-owner handling) and reference it from DR-085.

**Done when:** a build with one `BLOCKED: needs-owner` route reaches a green baseline + closes every
independent FRD (the blocked route stays quarantined, surfaced as the owner TODO), verified on a repro; the
skip is fail-closed (only needs-owner-blocked routes, logged); `build-orchestration.md` updated; then set
LESSON-0005 `promotion: approved` and back-link.
