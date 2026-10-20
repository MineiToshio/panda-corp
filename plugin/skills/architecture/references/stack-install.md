# Installing the stack (architecture steps 6 and 6b)

Follow `${CLAUDE_PLUGIN_ROOT}/templates/stack-<chosen>/STACK.md` and `factory/standards/`: strict typing,
linter+formatter, test framework, folder structure; lint + typecheck + test run clean before the step ends. A
STANDARD·medium installer subagent with Bash (`dispatch.md` G1, in parallel with the platform architect) does it,
given this file, the chosen stack and the versions record; the lead checks its byte-identity claims.

**Byte-identical-copy rule (DR-059), binding everything marked VERBATIM below.** Every canonical file this step
installs (gate config, `verify.sh`/`canary.sh`, the e2e set) is copied **byte-for-byte from
`${CLAUDE_PLUGIN_ROOT}/templates/stack-<chosen>/`, never hand-rolled, partially re-tuned or re-condensed**, exactly
the way `docs/rules/` are copied. A hand-rolled variant is the DR-059 pre-audit failure mode (each project inventing
its own gates, `/upgrade` unable to diff them). Project-specific additions go in **separate** files, never in an edit
of a canonical one, so `/pandacorp:upgrade`'s conformance check stays clean. Verify with `cmp` per file.

**Locked scope before installation (DR-131).** Read the five explicit decisions (PostHog, Sentry, multilingual i18n, SEO and mailing-list need) and install only current-version capabilities. Template package lists are suggestions, never consent. Deferred/excluded providers get no SDKs, helpers/stubs, credentials or required env validation; additional locale routing/SEO artifacts follow the chosen scope. Centralized launch-locale copy and structured logs remain baseline. Reconcile the exact install record and `.env.example` against these decisions before hand-off.

**MVP/v1 DB recovery installation boundary.** Use the verified native provider recovery from the recovery
ADR. Never add external DB-backup SDKs/jobs, backup buckets/keys, custom restore machinery or their env/secrets/
tests because a template suggests them; external DB backups wait until product validation. Product-export/media
storage dependencies remain valid when separately in scope. A legal/FRD recovery conflict stops installation for
resolution; it is not permission to add a backup system or alter a verbatim gate.

## (a) Provisional-stack harness gate (BL-0016, DR-105): BEFORE any VERBATIM copy

The VERBATIM copies assume the chosen stack's canonical harness exists under
`${CLAUDE_PLUGIN_ROOT}/templates/stack-<chosen>/` (it does for stack A). Stacks B (Hono) / C (FastAPI) / D (scraper)
are **PROVISIONAL**: their STACK.md carries a `PROVISIONAL STACK` banner and ships prose only. Check whether
`${CLAUDE_PLUGIN_ROOT}/templates/stack-<chosen>/verify.sh` exists: **the absent `verify.sh` is the load-bearing
signal**, corroborated by the banner. (Stack D is a pointer stub folded into stack C: a scraper/collector project
resolves to and installs **stack C**; run this gate against stack C.) If `verify.sh` is missing for the resolved
stack, this project is the FIRST real project on it (the BL-0016 trigger, DR-105): build that ONE stack's canonical
harness FIRST, mirroring stack A's shape:
- author `templates/stack-<chosen>/{verify.sh,canary.sh}` (`set -euo pipefail` + `inherit_errexit`; fail-closed
  lint/type/test/dead-code gates at max strictness; the stack's structural grep gates from its STACK.md "gate
  contract"; the DR-100 residual-ambiguity scan; actionable messages);
- author the canonical lint/type config (**B**: `biome.json` = stack A's minus the `react`/`next` domains +
  `knip.json`; **C/D**: ruff + mypy strict `pyproject.toml` tool sections);
- author `canary.sh` with deliberately-broken fixtures that prove every fail-closed gate still goes RED (DR-079),
  and wire the browser-gate opt-out as a DECLARED vacuous pass for a headless stack (an opt-out is a decision);
- run `verify.sh --canary` to PROVE the gates bite.

Too large to finish cleanly inline → STOP and escalate to the owner (file/advance BL-0016); never proceed with an
ad-hoc gate. Build ON FIRST USE only (DR-105). Once the harness exists (and, for one you just built, the STACK.md
banner is removed and DR-105's nota updated), continue exactly as for stack A.

## (b) Canonical gate config VERBATIM (DR-059)

Copy `templates/stack-<chosen>/biome.json` and `knip.json` to the project root, and `{verify.sh,canary.sh}` to
`.pandacorp/`. They carry the MAXIMUM fail-closed config (`react`/`next`/`test` domains, the `a11y` group,
hard-enforcement rules at **error**, `noExcessiveCognitiveComplexity: "error"`, the dead-code/circular/smoke/visual
gates). The STACK.md hard-enforcement section and Library conventions are the rationale.

## (c) e2e gate machinery VERBATIM (DR-055/056/074/075)

Copy `templates/stack-<chosen>/e2e/{smoke.spec.ts,visual.spec.ts,responsive.spec.ts,_responsive-helper.ts,shell.spec.ts,headers.spec.ts,hydration.spec.ts,_hydration.ts,prod-smoke.spec.ts,_prod-smoke.ts}`
into `e2e/` and `e2e/playwright.config.ts` to the project root (the conformance-checked set). **Seed, never
overwrite**, `e2e/routes.ts`, `e2e/_target.ts` and `e2e/shell.ts` from the templates only if missing (per-project,
never byte-diffed). For `e2e/shell.ts` (DR-075) materialize the nav contract `design` Step 8a recorded: with a
persistent shell, populate `SHELL_SELECTOR` + `NAV_DESTINATIONS` (`{label, path}` per top-level nav link, from the
prototype's nav block / the `components.md` `AppShell` row, NOT from `routes.ts`) + `SHELL_EXEMPT` + `NAV_TOGGLE`;
without one, leave `NAV_DESTINATIONS` empty (a vacuous pass). Ensure the scripts `test:smoke`, `test:visual`,
`test:responsive`, `test:shell` (`playwright test e2e/<name>.spec.ts`) exist and `@axe-core/playwright` is a
devDependency.

## (d) Dev ports

From `.pandacorp/status.yaml` `dev_port_base` (reserved at scaffold, DR-022): write `.claude/launch.json` with the
app on `base+0` (the stack's dev command, e.g. `pnpm` `["run","dev"]` plus the `--port`/`-p base` flag and
`"port": base`), and set local app/DB/service ports in the final local-only block of `.env.local` per the block offsets (Postgres `+2`, Redis `+4`). Configure Compose to read that file explicitly for port interpolation (for example `docker compose --env-file .env.local up -d`); do not generate a fourth `.env` file.
`dev_port_base: 0` → allocate a block from `factory/ports.yaml` exactly as `scaffold` does, then materialize.

## (e) Exact versions at the install point (DR-102, SEC-4 cooldown)

Resolve every library with the shipped resolver, from the project root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/resolve-versions.mjs" --node <project Node major> \
  next react react-dom <every other package the architecture names>
```

It picks the highest **stable** version published at least 7 days ago (a prerelease is never picked, even when it
holds the npm `latest` tag: funko-tracker's `prisma` `latest` pointed at an 8.0 RC, LESSON-0298), keeps an unpinned
`@types/node` on the project's Node major, FAILS on a peer range the picks do not satisfy, and WARNS when one family
lands on two majors (`@sentry/node` must follow `@sentry/nextjs`; `prisma` with `@prisma/*`). Record its table in
`docs/product/architecture.md` ("Pinned versions", committed) so the work orders and the grounding gate cite one
place. Then `pnpm add --save-exact <pkg>@<version>` for what the scaffold needs now, OR (a dependency a foundation WO
installs later, to keep `knip` clean) write that exact command INTO the WO's install step. Set `.npmrc`
`minimum-release-age` where the package manager supports it. A version that lives only as prose lets a build agent
resolve a different (often newer-major) one. Because the installer runs in parallel with the platform architect
(G1), it resolves and installs only what the scaffold needs now (the stack's own packages); once `architecture.md`
exists the lead re-runs the resolver over every package it names, pastes the table into "Pinned versions" and the
map carries each later install as its exact command.

`server-only`: plan it only when a WO installs it AND no worker, CLI or script imports the modules that use it (it
throws outside the framework's server bundle). Otherwise guard server modules by location and the data-layer gate.

## (f) `.env.example`, `AGENTS.md`, README (DR-102, DR-112/DOC-3)

- Exactly three root dotenv files: tracked `.env.example` with empty approved names, protected ignored `.env.local` for development and `.env.production` for production handoff. Group by service within labelled destination blocks; app secrets state their consumers. Local-only dev/test/oracle/CI tooling is last in guide/dev and absent from production. Distinct runtime privileges use storage aliases plus explicit target selectors/exporters, not extra files or duplicate keys. Check actual framework precedence and destination isolation with fake values; preserve injected fixture DB/seed inputs. Finalize the contract before step 9b3 (`environment-delivery.md`) fills private values. Existing values/port setup survive an inventoried consolidation without rotation; missing loader/build bindings stay pending.
- `AGENTS.md` pointing agents at the framework's VERSION-MATCHED docs when the framework ships them (Next.js
  `create-next-app` emits the pointer), merged below the managed Pandacorp header: the direct fix for coding against
  an API the model only remembers.
- The root README's "Getting started": prerequisites, install/dev/test commands and a pointer to `.env.example`,
  read from what was just installed (the `package.json` scripts, `launch.json`), never guessed.

## 6b. Tech-gated engineering rules, then the conflict check

Copy from `${CLAUDE_PLUGIN_ROOT}/templates/rules/` every rule file whose `applies_when` (or `also_applies_when`)
matches a technology this project uses (`react.md`, `nextjs.md`, `styling-and-ui.md`, `web-performance.md` /
`web-security.md`, `prisma.md`, `i18n-next-intl.md`, `analytics-and-errors.md`, ...) into `docs/rules/` (the
`always` files came with scaffold); a technology the project does not use → not copied. Regenerate
`docs/rules/README.md` (canonical spec in the `scaffold` skill). Copy verbatim, never re-condense.

**Then cross-check the injected rules against the frozen design contract** (`docs/design/technical-assumptions.md`,
`docs/design/fidelity-checklist.md`, `DESIGN.md`). A rule the frozen contract contradicts (funko-tracker:
`web-performance.md` asks for `next/image` + `next/font`, while the pixel-exact fidelity contract self-hosts the
prototype's fonts and renders `<img>` as captured) is recorded as a **project exception**: an ADR (the rule, the
contract clause, why the contract wins for this project, the compensating control) plus one line in
`architecture.md` "Cross-cutting concerns". Never edit the copied rule file (it is byte-diffed by `upgrade`) and never
leave the conflict for a build agent to discover.
