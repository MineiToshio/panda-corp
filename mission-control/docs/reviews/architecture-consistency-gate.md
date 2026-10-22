# Architecture contradiction gate (step 9b-consistency, DR-116): Mission Control v2 «Órbita»

- Date: 2026-10-22
- Plan commit judged: `e46f3a70`
- Reviewer: fresh contradiction-gate judge (not an author of this plan; generator ≠ verifier)
- Canonical rule: `plugin/skills/architecture/references/gates.md` §3, `factory/standards/document-consistency.md`

Verdict: FAIL (10 blockers)

## What was checked

- `docs/product/prd.md` in full, including § Version 2 «Órbita».
- `docs/product/architecture.md` in full (v2 revision).
- Every `docs/adr/*.md` status line. ADR-0001, ADR-0012 and ADR-0013 were read in full. ADR-0008 and ADR-0009 are SUPERSEDED by ADR-0012 and were treated as history.
- Every `docs/frds/*/frd.md`, read in full (FRD-01 to FRD-26; FRD-16 is REMOVED).
- The v2 blueprints of FRD-02, 03, 04, 05, 06, 11, 13, 14, 17, 18, 19, 22 and 25, read in full or in their contract, reconciliation and build-plan sections. The other blueprints were read at the seams named below.
- The live work orders: all 38 PLANNED v2 WOs were read at their seams and contracts. WO-01-010, WO-03-007 (missing-path section), WO-06-013, WO-11-004, WO-13-013, WO-14-005, WO-21-003 and WO-25-001 were read in full. The 50 kept-live legacy WOs are VERIFIED history and were sampled only where a v2 doc cites them.
- The shared seams were traced across every doc that names them: `WoDetail`, `buildSignal`, `FreshnessBadge`, `StateTile`, `MoreBar`, `SnapshotPanel`, `countOpenChanges`, `src/lib/copy` (`t`/`tRich`, dates) and the WO-25-001 URL codec.
- Seams found consistent across every doc that names them:
  - `WoDetail({ project, woId, view })`, created by WO-04-010, mounted by WO-05-008, rewritten by WO-05-009;
  - `countOpenChanges` = status not `done`/`discarded`;
  - `StateTile` (core, WO-22-002, reused by WO-05-008);
  - `FreshnessBadge({ signal, nowIso })`;
  - `SnapshotPanel`'s explicit props, a recorded deviation from the map's `({ project })`;
  - `t()` per ADR-0013;
  - `view=cuentas` canonical with `portfolioView=accounts` as an accepted alias.

The intended removals were not counted as contradictions: they are the owner's 2026-10-22 decision that "v2 may remove v1 features". SUPERSEDED WOs were not counted either. The oracle-versus-FRD precedence (`FRD > FDD > design-tokens > blueprint > WO`) was applied.

## Blockers

1. **The bounded write set is stated two ways.**
   - Doc A:
     - `docs/product/prd.md:52` and `:189` (v2 Constraints): "the only writes remain discard/restore and `favorite` on one idea card".
     - `docs/frds/frd-01-data-reading/frd.md:32` (amended 2026-10-22): "except the FRD-02 discard case".
     - `docs/frds/frd-02-ideas-board/frd.md:334`: writes are discard/restore and favourite only, "all isolated to `lib/discard/` + `lib/favorite/`".
   - Doc B:
     - `docs/product/architecture.md:305-313`: the complete write set has five entries, which add change-queue discard (FRD-04, WO-04-012), backlog discard (FRD-22 REQ-22-007, WO-22-001/002) and the guild-ledger writer (ADR-0005, FRD-09 AC-09-006.2).
   - Contradiction: these are two current, mutually exclusive statements of the read-only invariant. A builder reading the PRD or FRD-01 would treat the change and backlog discard actions as forbidden.
   - Fix: the PRD (Principles and v2 Constraints), FRD-01:32 and FRD-02:334 state the complete set by reference to architecture §7, with a decision-log line.

2. **Explicit-scope check: Sentry and SEO/metadata have no owner answer and no explicit ADR.**
   - Doc A: `docs/product/architecture.md:398` and `:400` say so themselves: "no explicit owner quote recorded" and "no explicit owner answer recorded".
   - Doc B: gates.md §3 says "a silent default or generic stack approval is a blocker". ADR-0001 excludes "external services (storage/email/payments/analytics)". That generic exclusion names neither error tracking nor SEO/metadata.
   - Accepted rows:
     - PostHog: ADR-0001 excludes analytics.
     - Multilingual i18n: the owner decision of 2026-10-21 and ADR-0013.
     - Mailing list: ADR-0001 excludes email. Cite it in the table instead of "evident".
   - Fix: record the owner's answer for Sentry and for SEO/metadata in the decision log, or in an owner-approved ADR-0001 amendment. Then update the Source column.

3. **The `MoreBar` step for the «Por conquistar» list is stated two ways.**
   - Doc A: `docs/frds/frd-10-achievements-hall/frd.md:189` (AC-10-028.3, amended): the first 12, then the next 24 per press («Mostrar 24 más · quedan 46»).
   - Doc B:
     - `docs/frds/frd-13-visual-system-accessibility/work-orders/wo-13-011-leaf-primitives.md:83-84`: "FRD-10's «Por conquistar» passes 12".
     - `docs/frds/frd-10-achievements-hall/blueprint.md:175` (binding reconciliation): "passes step 12 … FRD over the prototype's doubled step".
     - `docs/frds/frd-10-achievements-hall/work-orders/wo-10-016-logros-orbita.md:136`: the same.
   - Contradiction: a step of 12 reveals 12 per press, which violates the FRD's 24. WO-10-016:59 and blueprint:92/112 say "up to 24", so they contradict their own reconciliation lines.
   - Fix: pass `pageSize` 12 and keep the default step (2 × 12 = 24). Correct those three lines.

4. **«Sin señal» has two derivations on the same Resumen screen.**
   - Doc A:
     - FRD-06 AC-06-019.7 (`frd.md:74`): stale means the freshest of the heartbeat and the latest event is older than the TTL.
     - `frd-06-party/blueprint.md:44`: `buildSignal()` is "THE single resolver of a project's build signal".
     - `frd-04-project-workspace/blueprint.md:86-88`: "never a second derivation from `src/lib/status/liveness.ts`".
   - Doc B:
     - FRD-14 AC-14-002.2 (`frd.md:30`): heartbeat only, worded "Sin señal · último evento hace N".
     - `frd-14-snapshot-and-feedback/blueprint.md:47`: no-signal age "from the shared liveness module".
     - WO-14-005: `snapshot.noSignal`, «no hay señal del supervisor».
     - `wo-04-011-resumen.md:57`: the same.
   - Contradiction: when the heartbeat is stale but an event is fresh, `build-no-signal` shows «Construyendo» in La Fragua and the hero, and «Sin señal» in the snapshot panel. That is one term meaning two things and a second resolver, which DR-115 forbids.
   - Fix: amend AC-14-002.2 to the AC-06-019.7 rule and feed `SnapshotPanel` from `buildSignal()`, through `WorkspaceProject.build`, in WO-04-011 and WO-14-005.

5. **`PANDACORP_STALE_HOURS` is planned as configuration after FRD-21 removed its meaning.**
   - Doc A:
     - `docs/product/architecture.md:382`: "Hours of inactivity after which unmerged work is flagged stale", default 3, set by the owner.
     - WO-01-010:80: documents it in `.env.example` and `env.ts`.
   - Doc B:
     - FRD-21:43: the idle-past-3h `PANDACORP_STALE_HOURS` threshold "is replaced by the legend rule".
     - WO-21-003 uses fixed constants (24 h, 7 d).
     - WO-13-013 deletes its only reader, `src/lib/pendingMerge/pendingMerge.ts`.
   - Contradiction: after W7, a documented, owner-settable variable has no consumer. This fails the environment-contract check.
   - Fix: architecture marks it legacy, read only by `getPendingMerge` until WO-13-013. WO-13-013 removes it from `.env.example`, `env.ts`, the README and the architecture table, and adds those files to its artifacts.

6. **FRD-04 REQ-04-006 contradicts WO-11-004 on the Comandos tab.**
   - Doc A: `docs/frds/frd-04-project-workspace/frd.md:26` (v1 text, not amended):
     - `implement <frd>` and `change:<slug>` appear "when the phase is `implementation` or `release`";
     - a CommandsBox sits below the picker with release/iterate (or iterate/new-version).
   - Doc B:
     - `wo-11-004-comandos-tab.md` and the FRD-11 blueprint, following the oracle (`commandsView`): the target card "Construir un objetivo concreto" is always drawn, with FRD, WO and change options, regardless of phase.
     - «Cambios y decisiones» holds change, decide and new-version.
   - Contradiction: the WO, which cites REQ-04-006, does not meet it as written, and the FRD outranks the WO.
   - Fix: the PM amends REQ-04-006 to the drawn v2 layout, or WO-11-004 gates the target card by phase.

7. **FRD-03's no-remote warning is planned as "not built".**
   - Doc A: `docs/frds/frd-03-portfolio/frd.md:32`: "IF there is no `repo:`, the system SHALL show a warning «Sin remoto registrado …»".
   - Doc B: `frd-03-portfolio/blueprint.md:144` and `wo-03-007-portafolio-overview.md:121,218`: "drawn nowhere … not built (design item)".
   - Contradiction: the plan works around an FRD SHALL. gates.md §1 routes this case to design instead: draw it, or the owner removes it from the FRD.
   - Fix: design draws it (or adds a catalogue key and the owner confirms the copy), or the PM marks it Out of v2 in FRD-03. Then align WO-03-007.

8. **The Tu turno dialog drops the command sentence for decisions younger than 7 days.**
   - Doc A: FRD-18 AC-18-022.2 (`frd.md:65`) requires the dialog to explain "what the command does". Its worked example (`:69`) is a 6-day-old decision whose dialog has "a sentence on what the command does".
   - Doc B: `frd-18-dashboard/blueprint.md:79-80,153` and WO-18-002: "A younger decision shows the command without a run sentence … not built".
   - Contradiction: the plan contradicts the FRD's own worked example. The frozen catalogue also has the fresh variant `dialogs.turnDecision.run` (`microcopy.es.json:1904`), so the "drawn nowhere" premise is false.
   - Fix: render `dialogs.turnDecision.run` below 7 days and `runStale` from 7 days.

9. **The URL codec key set differs between FRD-25's blueprint and its WO.**
   - Doc A: `frd-25-persistent-navigation/blueprint.md:105-132`:
     - "`relationship` … retires … no longer produced";
     - lists `trophyCategory`, `hallTab`, `configSection` and `standardView` as kept;
     - omits the v2 keys for Logros, Configuración, Documentación and Propuestas.
   - Doc B:
     - `wo-25-001-url-contract-v2.md:84`: `relationship` is kept and round-tripped. Its own list adds `category`, `trophy`, `eras`, `q`, `type`, `approval`, `severity`, `domain` and `index`, and it calls the blueprint "the full table".
     - `frd-02-ideas-board/blueprint.md:180` (C4): the viewer keeps its `relationship` key.
     - FRD-02 AC-02-015.5 keeps relationship selection by row in v2.
   - Contradiction: one artifact has two key sets. `trophyCategory` does not exist in `src/lib/navigation`.
   - Fix: make the blueprint registry identical to WO-25-001's list. Retire only per-connector selection.

10. **A locked ADR says the fixture seams are absent from production; the plan ships them inert.**
    - Doc A: `docs/adr/ADR-0012-adopt-orbita-design-system.md:46`: "The seams exist in gate and test builds only and are absent from production".
    - Doc B:
      - `docs/product/architecture.md:354`: "inert unless its variable is set: `pnpm dev`/`pnpm start` never set them".
      - WO-01-010: `runGit` and `now()` read `MC_GIT_FIXTURE` and `MC_CLOCK` at runtime in every build.
    - Contradiction: the seam code is present in the production build. A gate reviewer of WO-01-010 would find the ADR violated.
    - Fix: amend ADR-0012's sentence to "present but inert unless its variable is set" with a decision-log entry, or plan build-time exclusion in WO-01-010.

## Explicit-scope check (gates.md §3)

| Scope | Recorded answer | Evidence | Result |
|---|---|---|---|
| PostHog | Excluded | ADR-0001 (analytics), `docs/analytics/events.md` | pass; no SDK, env var or task anywhere in the plan |
| Sentry | Excluded | architecture says "no explicit owner quote recorded" | **blocker 2** |
| Multilingual i18n | Single locale, Spanish; `t()` | owner decision 2026-10-21, ADR-0013 | pass; no locale routing, switcher or `next-intl`; centralized strings kept |
| SEO / metadata | Excluded (tab title only) | "no explicit owner answer recorded" | **blocker 2**; no WO plans OG, sitemap, robots or `generateMetadata` (searched) |
| Mailing list | Excluded | ADR-0001 excludes email | pass; cite ADR-0001 instead of "evident" |

No deferred or excluded scope leaves an SDK, stub, required credential or provider task in the plan (searched every live v2 WO).

## MVP DB-recovery check

Not applicable. MC has no database: `docs/product/data-model.json` declares `persistence: none`, and architecture §4 says "no DB, no ORM, no migrations". No backup job, bucket or restore machinery is planned.

## Environment contract check

The three-file handoff (`.env.example`, `.env.local`, `.env.production`) is not applicable. MC has no deploy target, no secrets and no provider credentials: every variable is an optional path override or a test/oracle seam, and only `.env.example` is tracked (architecture §7, decided). Every listed variable has a consumer except `PANDACORP_STALE_HOURS` after W7 (blocker 5).

## Advisories (wording drift, non-blocking)

- PRD v2 is stale in three places:
  - it says "Non-UI FRDs (01, 23, 24, 25) are unchanged";
  - the FRD-25 row says "not amended by the freeze";
  - open decisions 1 to 3 are still listed as open.

  The plan has since amended FRD-25 and FRD-01, reconciled the frontmatter and used «Docs» as the rail label. Mark them resolved.
- The owner-pending change count is described two ways. FRD-04 REQ-04-010 and its blueprint §4.5 say owner-pending items (Tu turno and the sidebar) are `ready`/`draft`. FRD-18 IF-18-turn, WO-18-002 and WO-04-011 count `ready` only and put drafts in «En marcha». Align FRD-04 to the FRD-18 rule.
- «En pausa» is described two ways. Architecture §5 lists it as a liveness label of the one signal resolver. The FRD-06 blueprint IF-06-verdict defines it as a verdict (no movement for more than 7 days), and `buildSignal` returns `idle | live | no-signal`. Align §5.
- ADR-0011's status line ("until one is settled"), FRD-03 REQ-03-009 and PRD M1 item 3 still present `portfolioView=accounts` as the key. FRD-26 AC-26-002.1 settled `view=cuentas` with `portfolioView=accounts` as an alias.
- FRD-21 AC-21-007.1 says "one row per repository that has unmerged branches or leftover worktrees", while its edge case and WO-21-003 also draw clean repositories as «Limpio». FRD-21's Notes still say MC "reads files only" and that the `pending-work.json` snapshot is in scope, which `git worktree list` superseded.
- Stale cross-references:
  - FRD-10 says the report UI is "WO-10-015", and FRD-23's out-of-scope note does too; it is now WO-10-017.
  - FRD-20's implementation note still describes the flow as ProjectWorkspace → TabSummary.
  - FRD-22 AC-22-002.4 says "Both panels"; there are three.
  - FRD-22 AC-22-006.3 cites "REQ-04-009", which no longer exists.
  - FRD-02's graph-control amendment cites the superseded ADR-0008.
  - FRD-02 AC-02-009.1 says "three horizontal tabs".
- WO-06-013 draws five forging-bar segments (verified, review, workshop, failed, queue). AC-06-020.2 names four counts.
- WO-10-017 lists phase transitions "ten at a time", but `MoreBar` defaults to a step of 2 × pageSize. State `step` = 10 explicitly (AC-10-028.5).
- FRD-03's edge case keeps "the rest of its card intact" for a missing folder, while WO-03-007 omits counts and age. The omission is honest; align the FRD wording.
- FRD frontmatter rollups are out of step with their work orders:
  - most v2-changed FRDs say `implementation_status: VERIFIED` while they own PLANNED v2 WOs (FRD-25 alone says PLANNED);
  - FRD-17 has `status: VERIFIED` where the others say `ACTIVE`.

  This matters for AC-12-003.3, whose drift badge keys on "rolled-up state is verified".
- ADR-0001's body still says "the single allowed write" and "Dagre for FRD-12". These are historical and its status line is amended, but blocker 1's fix should touch them too, for consistency.

## Method note

Contradictions were judged per `document-consistency.md`: two authoritative, current, mutually exclusive statements. Dated decision-log entries, SUPERSEDED WOs and «Out of v2» items were not counted. Each blocker was confirmed by reading both sources at the cited lines in this session.

## Resolution addendum (2026-10-22)

Every blocker above was fixed in one pass (commit d0c65539; scope decision in commit ee7dfd2a) and re-verified by the lead: `waves.mjs` exit 0, `ac-matrix.mjs` exit 0 (AC MATRIX OK), `plan-consistency.mjs` exit 0, `check-fdd-coverage.mjs --plan` COVERED, `doc-lint.sh` exit 0, `verify.sh --only=residual-ambiguity` exit 0, `data-model.json` parses, no `# OBSOLETE:` tombstone. Targeted checks: B1 the PRD (Principles, v2 constraints), FRD-01 and FRD-02 now point to `docs/product/architecture.md` §7 for the write set; B2 `docs/decision-log.md` 2026-10-22 records Sentry, SEO/metadata and mailing list as excluded (owner-delegated) and architecture.md cites it; B3 WO-13-011, WO-10-016 and the FRD-10 blueprint pass `pageSize` 12 and `step` 24, matching AC-10-028.3; B4 AC-14-002.2 uses the AC-06-019.7 rule and WO-14-005/WO-04-011 read `buildSignal()` (re-copied verbatim, ac-matrix green); B5 `PANDACORP_STALE_HOURS` left out of the env contract (architecture.md:388 note, WO-01-010); B6 REQ-04-006 amended to the drawn Comandos tab and WO-11-004 / FRD-04 and FRD-11 blueprints aligned; B7 FRD-03's no-remote warning is Out of v2 in the FRD, blueprint and WO-03-007; B8 AC-18-022.2 asserts the run sentence only for decisions 7 days old or more, and the plan builds only the drawn variant (check-fdd-coverage COVERED); B9 the FRD-25 blueprint key table and WO-25-001 list the same keys (`relationship` kept, per AC-02-015.5); B10 ADR-0012:46 now describes seams present in every build and inert unless their variable is set. PRD advisory: FRD-25 row now "Changed". No fix changed scope beyond the gate's own requests (no new AC, no data-model change, no WO added or removed). Verdict after resolution: PASS.
