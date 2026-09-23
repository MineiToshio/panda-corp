# `--now`: the fast change path (operative detail)

Driven by `plugin/skills/change/SKILL.md` §Fast path. That section states the contract and the
valves; this file holds the detail a running agent needs: the dispatch briefs, the repair loop,
the landing sequence and the canary scenario. Origin: proposal 37 §A.1/§A.2/§A.5/§A.8, DR-069,
DR-096, DR-097, DR-099, DR-015, DR-080, CONV-12, CONV-13, PROMPT-8.

**The one sentence that governs everything below:** the rigor level decides how much EVIDENCE a
change collects, never whether a red gate blocks. A red blocks at every level.

---

## 1. Provisional classification, by probable paths

**Record the project root now, before §3 isolates into a worktree and moves your cwd**
(BL-0162): `PROJECT_ROOT="$(pwd)"`. This is the checkout that actually has `.pandacorp/inbox/`
materialized — it is gitignored, so a worktree created later never contains it. §5 step 1 needs
this value; capturing it here, once, before any `cd`/`EnterWorktree`, is cheaper than
reconstructing it later and is the fix for the exact failure BL-0162 found (a `--card` path
resolved inside the isolated worktree, ENOENT, fail-closed to `critical`).

There is no diff yet, so the level is derived from the files the change will plausibly touch.

1. Enumerate the probable paths yourself, in this session, from the owner's description plus a
   bounded look at the tree (`ls`, `grep`, at most a couple of `Read` calls). Never fan out a
   subagent for this: it costs more than it saves at this size.
2. Run the classifier over that list:
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/classify-change.sh" --repo . --files "<comma list>" --card .pandacorp/inbox/changes/<slug>.md`
3. Write `rigor:` and `rigor_reasons:` into the card from the JSON verdict.
4. Show the owner ONE line, in Spanish: `clasificado como <nivel> (provisional): <razones>`. Never ask. The
   classifier decides; you may only escalate, and an escalation is written into `rigor_reasons`
   with its reason (composition rule 2: monotone upward).

**What `--files` can and cannot say.** It carries no diff body, so it emits S15 at ten files or
fewer (and S3 `critical` above ten) and can never certify `micro`. A provisional verdict is therefore `normal` or `critical`, and it is exactly
what the valves in §2 consume. The DEFINITIVE level is recomputed on the real diff in §5, and a
change can settle at `micro` only there. Say "provisional" in the owner line if you say anything
about the level at all.

**Floor hits below `critical`.** `floor_hits[]` entries carry their own `level`. Today the only
sub-critical one is S17 when `madge` is not installed ("cannot certify no reverse-dependency
risk onto a floor file"). It is a missing oracle, not a clean bill of health: copy it verbatim
into `rigor_reasons`, surface it in the owner line, and let it do what it already does, which is
hold the change at `normal` or above so the L1 reviewer is mandatory. Never drop it as noise.

---

## 2. The three valves, in order

Each valve ends the turn with the card captured and nothing else written. Capture-only is always
the safe fallback, so a valve never loses the owner's request.

**Before any of them: a `status: draft` card never enters the fast path.** DR-069 defines `draft`
as "the owner is still working out the details", which also covers "it needs a design pass first"
and "it is infra, not code the build implements". The build skips a `draft`, and so does this.
Capture it and stop. Only a `status: ready` card is eligible.

### (a) A build is active

Read liveness through the single helper, never by hand-parsing `status.yaml`:

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-build-liveness.sh" .pandacorp/status.yaml   # RUNNING | STALE | NOT_RUNNING
node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build-state.mjs" status --project .      # {"lease":…,"fresh":true|false}
```

`RUNNING`, or a lease with `fresh: true`, means the engine is the sole writer right now. Capture
only. Tell the owner, in Spanish, roughly: *"Hay un build activo, así que lo dejo capturado en la
cola. El build lo drena en su próximo safe point."* A `STALE` verdict is NOT a live build, but it
is also not yours to clear: proceed with `--now` and leave the stale lock to
`/pandacorp:implement`, which owns the reset.

This is the ONE place `change` reads build state, and the only decision it can reach from that
read is "do less". The DR-069 capture path stays build-detection-free.

### (b) `critical`, or a critical floor hit

Refuse the fast path when `rigor == critical`, or when any `floor_hits[]` entry carries
`level: "critical"`. By max-wins these describe the same set today; checking both keeps the valve
honest against a future signal that records a floor hit without raising the level.

**Two S12 gaps you must close by hand.** S12 (`difficulty: high` or `reopen_count >= 1` is
`critical`) is read from `--wo`, never from the card (`classify-change.mjs` reads only
`rebuilds_verified` and `supersedes` from a card). So: pass `--wo <path>` whenever a target work
order is known, AND treat `difficulty: high` / `reopen_count >= 1` written on the CARD as
`critical` yourself. Without this, a change the engine would have escalated sails straight
through the valve.

Capture only, with `class: expedite` if the owner signalled urgency. Name the exact signal that
fired (the classifier gives you `signal` plus `detail`, use them verbatim, for example
*"S5: auth/data surface: src/lib/auth/session.ts"*), and offer the two real continuations:
`/pandacorp:implement frds=<the affected FRD>` for a targeted build, or a bare
`/pandacorp:implement` to drain the queue. The fast path cannot touch auth, money, PII,
persistence, irreversible operations, secrets, CI, the oracles or the factory's own machinery.

### (c) The classifier failed

A non-zero exit, an unparsable verdict, or no verdict at all is treated as `critical` and routed
through valve (b). The wrapper already prints a `FAILCLOSED` verdict for you; use its `detail` as
the reason. A broken classifier must never be the reason a change ran cheap.

---

## 3. Delegated implementation

**Emit `ChangeNowStart` here, once, before delegating** (fire-and-forget observability, never
load-bearing): `echo '{}' | bash "${CLAUDE_PLUGIN_ROOT}/scripts/emit-event.sh" ChangeNowStart`
— the same helper the harness's own hooks use for `SubagentStop`; it reads `.cwd` off its input
(falls back to `$PWD`, which is `$PROJECT_ROOT` here, before any worktree isolation) and
resolves the project by walking up to the nearest `.pandacorp/status.yaml`. This is the only
signal that currently tells Mission Control's Party panel a `--now` run is in flight at all — the
`change.integrated`/`change.reconciled` events are wired only from the build engine's own drain,
never from this fast path.

**Never implement in the owner's session.** A turn in a long owner session carries the whole
accumulated context; a fresh subagent starts clean. Delegation is a cost lever even at equal
tier (proposal 37 §A.0 principle 5).

**Who.** `pandacorp:implementer` by default. Prefer `pandacorp:frontend-dev` or
`pandacorp:backend-dev` when the change is squarely one of those. All three pin `model: sonnet`
in their frontmatter, which is the CONV-12 floor for real implementation work and is what keeps
DR-015 true by construction once the L1 reviewer runs on opus. Never inherit the owner session's
own tier.

**Never escalate the implementer to opus on this path.** The L1 reviewer is opus
(`plugin/agents/reviewer.md`), so an opus implementer would make "a different agent AND a
different model" false and quietly void DR-015 in the exact cycle that is supposed to enforce it.
Work that genuinely wants an opus builder is `difficulty: high` work, and §2 valve (b) already
routes that to `/pandacorp:implement`, where `pickWorkerModel` escalates it under the engine's
own calibrated rules (DR-073/DR-108). If the change feels too hard for sonnet, that is the
signal, and the answer is the queue, not a bigger model on the fast path.

**Where.** Its own worktree (DR-096), because the gate is whole-program and a parallel session's
tree must not be disturbed:

```
EnterWorktree                                    # the tool, when available
git worktree add -b change/<slug> ../<repo>-<slug> HEAD   # fallback
bash .pandacorp/worktree-bootstrap.sh            # deps, launch.json, secrets
```

**The brief (PROMPT-8: self-contained, on camera, no pointer specs).** Inline all of this:

- Role and boundary in the first line. **The boundary is the classifier's floor, and the
  authoritative list is the one in `plugin/scripts/classify-change.mjs` (S5 through S9, S17), not
  a summary of it.** The summary is for recognition, not for deciding: auth and the data layer,
  money, PII, persistence and migrations, irreversible or destructive operations, secrets, CI and
  deploy config, the oracles (`e2e/**`, snapshots, `_tests/**` with net deletions,
  `design-tokens.json`, `.pandacorp/verify.sh`, `biome.json`), and the factory's own machinery
  (`plugin/**`, `factory/**`, `.pandacorp/*.sh`). It also covers things a short list reliably
  drops: `package.json` and every lockfile, `next.config.*`, `tsconfig*.json`, `knip.*`,
  `vitest.setup.*`, `src/test/**`, the playwright/vitest/jest/stryker configs, `.claude/**`,
  Dockerfiles and `*.tf`. **If the work turns out to need ANY of it, or any path it is unsure
  about, it STOPS and reports instead of proceeding.** Reclassification in §5 would refuse to land
  it anyway, so proceeding only wastes the work.
- The card verbatim: the owner's description, the acceptance criteria, and `rigor` with
  `rigor_reasons`.
- The probable-paths list from §1, marked as a starting point rather than a boundary.
- The context budget, stated as a budget: **at most ~40k tokens.** Read only what the change
  actually requires. `docs/design/design-tokens.json` only if the change touches UI. A manifest
  of candidate documents (path, what it is for, size) beats an imperative reading list; the
  standing instruction is "read only what your artifacts require".
- TDD: the acceptance test goes RED before the implementation makes it GREEN.
- The exact gate command for the level, and the rule that `--only` and `--files` NEVER certify:

  ```
  bash .pandacorp/verify.sh --since <last_green_sha> --report-all     # micro / normal
  bash .pandacorp/verify.sh --report-all                              # no usable anchor
  ```

  `--only`/`--files` are allowed inside its own bounded retry loop and nowhere else, because a
  `partial` scope can never promote anything to `VERIFIED` nor advance `last_green_sha`.
- Commit discipline: `git add` only its own files, never `git add -A` (DR-099); Conventional
  Commits in English, on the worktree branch, never on `main`.
- The output contract, verbatim: the list of files touched, the commit sha, the `rigor` it saw,
  and the path to `.pandacorp/run/gate-report.json` plus its `green` and `scope` values.

---

## 4. The level gate, and the L1 reviewer

### L0 (`micro`): no LLM judge

The oracle is the canonical `verify.sh`, which the implementer did not write (it comes verbatim
from the template and its drift is a red gate). The verdict is the gate report: `green: true` and
`scope` in `{since, full}`. A `partial` scope is not a verdict. There is no surface of judgment
here by definition, because `micro` means no new behavior, no new route, no new file and nothing
on the floor. If any of those appeared, the change stopped being L0 in §5 by construction.

### L1 (`normal`): one reviewer, on opus

`pandacorp:reviewer` (`model: opus`), which is a different agent AND a different model from the
sonnet implementer. That is DR-015 met explicitly, not by accident.

Give it pre-digested evidence and a budget, so it spends its turns judging instead of hunting for
the material. **The budget buys back exploration, never the independent oracle:** the reviewer
still RE-RUNS the gate itself rather than accepting the implementer's `gate-report.json` as proof
(`plugin/agents/reviewer.md` §1, and "generator is not verifier, re-run the evidence" in
`docs/rules/quality-and-testing.md`). A report handed over by the thing being judged is a
starting point, not a verdict.

Note the shape of what you are doing: `reviewer.md`'s standing contract is one review per FRD
when its work orders are `IN_REVIEW`. This is a per-change invocation of that agent. Changing the
agent's own definition to describe this path is a separate, frontmatter-level change (PROMPT-5),
not something to assume from here.

- Inject: the unified diff, `gate-report.json`, the acceptance criteria, the card, and the
  owning `frd.md` when one exists.
- Budget: **at most ~15 tool calls** and **at most 3 adversarial tests**, at most one per
  acceptance criterion. The cap applies to EXPLORATION turns, never to the number of findings.
- Output: structured findings, each with a class (`correctness` | `security` | `quality` |
  `nit`), a `file:line`, and what would prove it fixed. Correctness and security block. Nits are
  advisory (DR-072) and go into the card, not into a repair cycle.
- DR-080 holds: the reviewer writes the adversarial tests, the implementer does not touch them.

### The repair loop

A blocking finding or a red gate goes back to the SAME implementer (sonnet), pointed at the
findings, for **at most 2 cycles**. Each cycle may use `--only`/`--files` for speed and must end
with a non-partial gate run before anything is claimed.

Each red bumps this change's counter in `.pandacorp/run/change-attempts.json`, a flat
`{"<card-slug>": <n>}` map that `classify-change.sh` reads as S16 and that raises the level by
one on the next classification. Writing it is part of the loop, not an optional extra: an
unwritten counter is a signal the classifier cannot see.

**Still red after 2 cycles: stop and be honest (DR-099).** Hand the card back (see "How a
hand-back is recorded" below), leave the work preserved on its branch, attach the
`gate-report.json` path and the findings, and tell the owner IN CHAT, in Spanish, in the same
turn: what is blocked, the real reason, that nothing is lost, and what decision or condition
would unblock it. Never "one more try", never silence, never a workaround.

### How a hand-back is recorded

Proposal 37 calls this state `needs-owner`. It is recorded as **`status: draft` plus a
`## Bloqueado` section in the card body** (Spanish: what is blocked, the branch that holds the
work, what would unblock it), NOT as a new frontmatter value. Two reasons, both mechanical:

- `draft` already carries the exact operative contract needed here. The build drains only
  `status: ready` and skips everything else, so a handed-back card can never be silently drained.
- `needs-owner` has no readers. The queue's two consumers are the build's drain and Mission
  Control's validator (`mission-control/src/lib/changes/changes.ts`, enum
  `ready | draft | building | closing | done | discarded`), and that validator fails LOUD on
  anything outside its enum (DR-078). Promoting `needs-owner` to a real status means teaching
  both readers first; until then it would render as a parse error, which is worse than a
  truthful `draft`.

The label is a description of the state, not a token. Do not invent the token.

**Previously a known gap, now closed.** `building` (the engine, DR-069) and `closing`
(`/pandacorp:sync --close-out`, the F3 contract, backed by `doc-lint.sh`) used to render as parse
errors in Mission Control's queue panel. Mission Control's validator now accepts the full
`ready | draft | building | closing | done | discarded` enum (FRD-04 REQ-04-010, mission-control
commit `19ae06d7`). The lesson still applies to any FUTURE unread token: inventing a new one still
renders as a parse error until both readers (the build's drain and Mission Control's validator)
learn it — that is why `needs-owner` above stays a description, not a token.

---

## 5. Definitive classification, close-out and landing

1. **Reclassify on the REAL diff**, which is the only classification that certifies anything.
   **Point `--repo`/`--range` at the WORKTREE, but keep `--card` on `$PROJECT_ROOT` (§1) —
   never a path inside the worktree (BL-0162):**
   `--repo`/`--range` must resolve against the worktree because S17/madge only trusts the
   on-disk import graph when the classifier's own `HEAD` is the branch tip being classified
   (`isHeadRange` in `classify-change.mjs`) — pointing them at the original checkout, whose
   `HEAD` is still `main`, would silently SKIP S17 as "historical range" instead of running it.
   `--card`, by contrast, must stay on `$PROJECT_ROOT`: `.pandacorp/inbox/` is gitignored, so
   `git worktree add` never materializes it inside the worktree, and a `--card` path resolved
   there fails to read (ENOENT) — which the classifier, correctly, fails closed on to
   `critical` (valve (c) above). The two flags are already independent (`--card` is read as a
   plain file path, never joined against `--repo`), so this needs no new flag, only the right
   two paths:
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/classify-change.sh" --repo <worktree> --range <base>..<head> --card "$PROJECT_ROOT/.pandacorp/inbox/changes/<slug>.md"`
   where `<base>` is the merge base of the worktree branch. Write the verdict back into the card,
   replacing the provisional one.
2. **If it came out `critical`, do NOT land it.** The provisional pass missed something the real
   diff revealed, and that is exactly the case the floor exists for. Hand the card back (§4,
   "How a hand-back is recorded") with the firing signal as the reason, branch preserved, and
   offer `/pandacorp:implement`. Tell the owner in Spanish, in this turn.
3. **If `micro` or `normal`, close out in one batch:** `/pandacorp:sync --close-out <slug>`.
   It owns the proportional artifacts per level, the `status: closing` stamp with
   `implemented_sha` and `closing_at`, the single commit, and the move of the card to
   `changes/done/` with `shipped_sha`. It refuses on a missing, red or `partial` gate report, so
   run the level's gate first and do not paper over a refusal. Its `--force-critical` flag exists
   for the owner, never for you.
4. **Do NOT write the work order's `implementation_status` yourself.** Close-out's `normal` tier
   owns that field along with the WO's `## Status Note` (`plugin/skills/sync/SKILL.md`), and one
   fact has one writer (DR-115). What DR-097 requires is that the field end up matching reality,
   `VERIFIED` once the gate is green and never stranded at `IN_REVIEW`; your job is to verify
   close-out actually did it, and to say so if it did not.
5. **Land it.** A product project lands through its queue: `bash .pandacorp/merge-queue.sh`. The
   factory repo and Mission Control have no merge queue: merge the branch back to `main`
   directly (solo operator, constitution §11). Then `ExitWorktree(action: remove)`, falling back
   to `git worktree remove` if the tool no-ops. If the landing hands back (rebase conflict, red
   integration gate, busy main), say so in chat immediately per DR-099: the work is on its
   branch, nothing is lost, and here is what is needed.
6. **One closing line to the owner**, Spanish, for example:
   `hecho · nivel normal · gate verde (since) · commit a1b2c3d · card archivada en done/`.
   **Emit `ChangeNowEnd` alongside it**, the counterpart of §3's `ChangeNowStart`, in EVERY
   terminal outcome of the fast path — a clean landing here AND a hand-back at step 2 or step 5
   (a run that never lands is still a run that ended): `echo '{}' | bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/emit-event.sh" ChangeNowEnd`.
   Append the real cost only when a rollup actually produced it for THIS change. F5
   (`plugin/scripts/usage-rollup.mjs`) has a per-change session mode: run
   `node plugin/scripts/usage-rollup.mjs --session <transcript.jsonl> --commits <base>..<head> --repo . --card <card.md>`
   (dry-run, prints the summary to stdout) — add `--out .pandacorp/track.jsonl` to also record it
   on the timeline. When it exits 0 and prints `cost_usd_total`, quote that measured number; on any
   other exit (no transcript at hand, an ambiguous window, an unwritable `--out`), say nothing
   about cost rather than estimating it. CONV-13: an unmeasured number is not a number — never
   estimate one nobody measured.

---

## Dry run

A manual canary for the owner or an agent, sized to be genuinely `micro`. Run it in Mission
Control, which lives inside the factory repo and therefore lands by direct merge. Install its
dependencies first (`madge` is a declared devDependency): without `node_modules`, S17 cannot
certify and every verdict floors at `normal`, which makes rows 3 and 10 untestable.

**Request:** `/pandacorp:change "el borde de la card de portada debería ser recto"`

**Expected, step by step:**

| # | What should happen | How you know it did |
|---|---|---|
| 1 | The card is written to `.pandacorp/inbox/changes/<slug>.md` with `type: change`, `class: standard`, `status: ready` | the file exists, frontmatter matches the template |
| 2 | Probable paths enumerated without a subagent: `src/components/modules/IdeaCard/IdeaCard.tsx` plus its styles | no `Agent` call before the classifier runs |
| 3 | `classify-change.sh --files …` returns `normal` on S15 alone (plus S17 if `madge` is not installed). **S14 must NOT appear**: it is a path predicate over `app/**/*.tsx`, and this component is not under `app/`. A canary anchored on a route component could never reach `micro` at row 10, because a path predicate that fires in `--files` mode fires in `--range` mode too | the JSON on stdout; `rigor`/`rigor_reasons` land in the card |
| 4 | One Spanish line to the owner: `clasificado como normal (provisional): …` | it is shown, and nothing is asked |
| 5 | Valve (a) passes because no build is running | `check-build-liveness.sh` prints `NOT_RUNNING` |
| 6 | Valve (b) passes because the level is not `critical` | no `critical` in the verdict |
| 7 | A `pandacorp:implementer` on sonnet runs in its own worktree and changes the radius token usage, not a raw value | the diff touches the component, no arbitrary CSS value, `design-tokens.json` untouched |
| 8 | `verify.sh --since <last_green_sha> --report-all` is green, `scope: since` | `.pandacorp/run/gate-report.json` says `"green": true` |
| 9 | An opus `pandacorp:reviewer` re-runs the gate itself, judges the diff within its call budget, and returns no blocking finding | its own gate run, and structured findings that are all `nit` or empty |
| 10 | Reclassification on the real range returns `micro`: S1 (≤20 net lines, ≤3 files, no new file) with no signal above it. It stays `normal` if `madge` is missing (S17) or the diff grew, and that is a correct outcome, not a canary failure: just close it at the `normal` tier | the `--range` verdict, written back over the provisional one |
| 11 | `/pandacorp:sync --close-out <slug>` stamps `status: closing` + `implemented_sha` + `closing_at`, then writes the level's set. At `micro`: card to `done/` with `shipped_sha`, one line in `progress.md`, and NO decision-log entry because `supersedes:` is empty. At `normal`: also the WO Status Note, a decision-log entry and the `status.yaml` rollups | the card is in `changes/done/`; `docs/decision-log.md` unchanged at `micro`, one new entry at `normal` |
| 12 | The branch merges to `main` directly and the worktree is removed | `git log` on `main`, `git worktree list` clean |
| 13 | One closing Spanish line, with no invented cost figure | the message names level, gate, commit and the archived card |

**What makes this canary FAIL, in decreasing severity:** a `micro` verdict on anything that
touched the floor; a card that never reaches `done/`; a green claimed from a `partial` scope; a
cost number nobody measured; the implementer running in the owner's session or in the main
checkout; a red gate landed anyway.

**Flipping the default (REV3 defect D2, independent review 2026-09-22).** `--now` stays opt-in —
the default is `--queue` — until BOTH hold: (1) the Stop gate's D2 UI-artifact escalation is
shipped (a UI-only diff can no longer silently ride `--since` past the browser fidelity gates,
DR-056/DR-074), and (2) this canary has been run at least once, in full, end to end, with that fix
in place, and every row above passed. Only then does `change/SKILL.md` flip `--now` back to the
default and `--queue` to the explicit flag — as its own prose edit, citing this paragraph and the
canary run in the decision log. Do not flip it on the strength of the unit-test suite alone: this
row's whole point is that only a real, owner-attended run through Mission Control exercises the
non-mocked boundary (quality-and-testing.md: owner-attended live attempts are the scarcest gate).
