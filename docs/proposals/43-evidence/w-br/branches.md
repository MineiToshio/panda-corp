# Trabajo existente sobre gate y cola

Inspección de solo lectura, 2026-11-20. Las salidas git y conteos son **medidas** del checkout observado; no se ejecutaron gates, tests, builds ni servidores. Los conteos `test\(` son **estimados** de declaraciones, no casos expandidos ni ejecuciones. Las rutas absolutas con línea constituyen las citas.


## Lectura rápida con evidencia

- CI: `bedacffb` corrige dependencias del runner limpio (Node/Codex reales, zsh, Chromium), fixtures Git locales sin firma, revocación sin carrera de timeout y oracle del Manual actualizado; no cambia la selección de specs del gate de producto. Está en main: `git merge-base --is-ancestor fix/engine-tests-ci main → exit 0`; log/diff/status completos debajo. Fuente adicional: `/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:9` (dependencias), `:25` (aislamiento), `:37` (oracle), `:45` (límites sandbox/Ubuntu).
- Variables del verify: `PANDACORP_VERIFY_OWNER_PID` es control interno de lock, no selector (:53–74); `PANDACORP_VERIFY_NO_BAIL` modifica bail de runners (:202, :670–672, :941); `PANDACORP_VITEST_SEED` reproduce orden (:419, :677, :941); `PANDACORP_CURATED_DATA_GLOBS` configura el guard de datos curados (:768). Rutas: `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh`. `PANDACORP_E2E_CERTIFICATION=1` habilita maxFailures de certificación, `PANDACORP_E2E_SERVER=prod` el servidor de producción y `PANDACORP_E2E_TIER=combined` la división por inventarios (:671, :989–994). No-bail no activa por sí solo report-all: los estáticos siguen abortando al primer fallo salvo --report-all (:743, :915); combinar ambos para diagnóstico amplio.
- Configuración Playwright común en los tres `<proyecto>/playwright.config.ts`: workers por defecto 1; tier parallel/combined usa `PANDACORP_E2E_WORKERS` o 3 (:103); combined diagnóstico 1; seriales desktop/mobile override 1 (:165, :186, :199). Retries 0, fullyParallel false y maxFailures 1 solo certificación sin diagnóstico, 0 en resto (:164–168). Browser Desktop Chrome en desktop y mobile por viewport, más desktop-parallel/mobile-parallel en combined (:145–157, :181–201). No se configura Firefox/WebKit. Servidor: GATE_PROD usa prod-server start, PROD_SMOKE build+start y resto next dev (:204–208); verify full construye primero prod-server si existe, --since queda dev (verify :987–996). Las tres fuentes y sus prod-server están transcritas abajo con líneas.
- Vitest: Mission Control Node + DOM según inventario revisado, sin pool ni cap explícito en config (:7–38); helper aislado y override `PANDACORP_VITEST_MAX_WORKERS` validado (`mission-control/.pandacorp/vitest-policy.ts:16–24`, :50–75). PersonalPage mantiene una sola raíz jsdom, con maxWorkers heredado del helper y sin cap/pool explícitos (`personal-page-v2/vitest.config.ts:39–58`). Funko usa Node revisado/annotation y resto jsdom, maxWorkers `min(5,max(1,availableParallelism()-2))`, override del helper; sin pool explícito (`funko-tracker/vitest.config.mts:9–23`, :50–55). Ausencia de pool/cap significa delegación al runner, no workers=1. Fuentes completas debajo.

| Proyecto (raíz /Users/Shared/Proyectos/) | Specs e2e, medida collect.py | tests e2e estimados por suma rg -c test\( | Archivos Vitest candidatos, medida collect.py |
|---|---:|---:|---:|
| panda-corp/mission-control | 72 | 295 | 540 |
| funko-tracker | 72 | 254 | 888 |
| personal-page-v2 | 18 | 59 | 180 |

Los inventarios y salidas de conteo están en §4. El conteo unitario excluye archivos de worktrees/runtime y caches; no ejecuta discovery del runner y puede incluir candidatos excluidos por config (por ejemplo docs de Funko). Por ello no es una cifra de tests ejecutados. Las cifras e2e cuentan líneas que contienen `test(`, incluidos helpers; no cuentan expansiones de loops, test.each ni nombres con otras sintaxis.

## 1. Ramas y aterrizajes

`feat/verify-affected-browser-gates` conserva tres commits no ancestros de main, pero su comportamiento ya existe en el verify actual: no selecciona specs individualmente por impacto; omite TODO Playwright únicamente para cambios probados de queries/worker. Si hay UI, dependencias o incertidumbre Git conserva navegador completo. Siempre partial, nunca certificación. Por ello no debe confundirse rama no mergeada topológicamente con funcionalidad pendiente. `fix/engine-tests-ci` está totalmente contenida en main y no tiene diff contra su merge-base; no es una rama en curso en sentido topológico. La existencia de commits/tests no demuestra que estén verdes hoy. Evidencia abajo y sección 2.

### feat/verify-affected-browser-gates

```text
$ git -C /Users/Shared/Proyectos/panda-corp log --date=iso main..feat/verify-affected-browser-gates
commit af3894a6a492379932410c4a2b7376310b6b1b05
Author: Toshio Minei <sminei10@gmail.com>
Date:   2026-11-03 21:38:20 -0500

    fix(verify): fail closed on gitlinks, fsmonitor and clean filters in --affected
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

commit 17b73a30f0b399113ce8f886d52e368e54c31fd7
Author: Toshio Minei <sminei10@gmail.com>
Date:   2026-11-03 21:27:38 -0500

    fix(verify): fail closed on symlinks and index flags in --affected; engine rejects partial gate reports
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

commit 0300aa7f6c851c72853f02d8bc03e42e6c633975
Author: Toshio Minei <sminei10@gmail.com>
Date:   2026-11-03 21:10:34 -0500

    feat(verify): add --affected mode that skips browser gates for data-only diffs
    
    Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp diff --stat main...feat/verify-affected-browser-gates
 .../BL-0302-diff-selected-browser-inner-check.md   |  53 ++++++
 factory/decision-log.md                            |   5 +
 factory/decisions/registry.yaml                    |   6 +
 factory/standards/quality.md                       |   8 +
 mission-control/docs/decision-log.md               |  14 ++
 mission-control/src/app/manual/manualPages.tsx     |  20 ++-
 plugin/.claude-plugin/plugin.json                  |   2 +-
 plugin/.codex-plugin/plugin.json                   |   2 +-
 plugin/docs/decision-log.md                        |  39 +++++
 plugin/runtime/engine/pandacorp-build.src.js       |  19 +-
 plugin/runtime/plugin-metadata.json                |   2 +-
 plugin/scripts/test-pandacorp-build.mjs            |  29 +++-
 plugin/scripts/test-verify-gate-report.sh          | 191 +++++++++++++++++++++
 plugin/skills/upgrade/SKILL.md                     |   2 +-
 plugin/templates/OVERLAY_VERSION                   |   2 +-
 plugin/templates/rules/quality-and-testing.md      |   1 +
 .../shared/.claude/engines/pandacorp-build.js      |  15 +-
 plugin/templates/stack-a-nextjs/STACK.md           |  44 +++++
 plugin/templates/stack-a-nextjs/verify.sh          | 137 ++++++++++++++-
 19 files changed, 569 insertions(+), 22 deletions(-)
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp log -1 --date=iso --format=%H %ad %s feat/verify-affected-browser-gates
af3894a6a492379932410c4a2b7376310b6b1b05 2026-11-03 21:38:20 -0500 fix(verify): fail closed on gitlinks, fsmonitor and clean filters in --affected
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp merge-base --is-ancestor feat/verify-affected-browser-gates main
(sin salida)
[exit 1]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp-wt-verify-affected status --porcelain
(sin salida)
[exit 0]
```

### fix/engine-tests-ci

```text
$ git -C /Users/Shared/Proyectos/panda-corp log --date=iso main..fix/engine-tests-ci
(sin salida)
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp diff --stat main...fix/engine-tests-ci
(sin salida)
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp log -1 --date=iso --format=%H %ad %s fix/engine-tests-ci
5c5cdd20183fd9df5b001eb95f23706cc226ac84 2026-11-03 09:26:48 -0500 Merge branch 'main' into fix/engine-tests-ci
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp merge-base --is-ancestor fix/engine-tests-ci main
(sin salida)
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp-wt-ci status --porcelain
(sin salida)
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp show --stat bedacffb
commit bedacffb6de3bb085ef901c428ab9a58c1abc002
Author: Toshio Minei <sminei10@gmail.com>
Date:   Sat Oct 31 23:08:47 2026 -0500

    fix(engine-tests): make the CI engine corpus pass on a clean runner
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

 .github/workflows/factory-engine-tests.yml         | 16 +++++++
 .../BL-0301-engine-tests-clean-ci-environment.md   | 34 ++++++++++++++
 mission-control/docs/decision-log.md               |  9 ++++
 .../docs/frds/frd-08-documentation/frd.md          |  2 +-
 mission-control/src/app/manual/manualPages.tsx     |  8 ++++
 plugin/.claude-plugin/plugin.json                  |  2 +-
 plugin/.codex-plugin/plugin.json                   |  2 +-
 plugin/docs/decision-log.md                        |  6 +++
 plugin/docs/engine-tests.md                        | 54 ++++++++++++++++++++++
 plugin/runtime/plugin-metadata.json                |  2 +-
 plugin/scripts/test-build-run-id.mjs               |  7 ++-
 plugin/scripts/test-codex-enforcement.mjs          | 20 ++++++--
 plugin/scripts/test-codex-unattended.mjs           |  3 +-
 plugin/scripts/test-r10-certification-permit.mjs   |  8 ++--
 plugin/scripts/test-verify-before-stop.sh          |  3 ++
 plugin/scripts/test-whole-frd-gate-contract.mjs    |  2 +-
 16 files changed, 164 insertions(+), 14 deletions(-)
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp show bedacffb -- .github/workflows
commit bedacffb6de3bb085ef901c428ab9a58c1abc002
Author: Toshio Minei <sminei10@gmail.com>
Date:   Sat Oct 31 23:08:47 2026 -0500

    fix(engine-tests): make the CI engine corpus pass on a clean runner
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

diff --git a/.github/workflows/factory-engine-tests.yml b/.github/workflows/factory-engine-tests.yml
index 6efcf50c8..96d5ca141 100644
--- a/.github/workflows/factory-engine-tests.yml
+++ b/.github/workflows/factory-engine-tests.yml
@@ -8,11 +8,15 @@ name: Factory engine tests
 # remembering (LESSON-0151). Chosen vehicle: GitHub Actions (this repo is public, so Actions
 # minutes are free -- see factory/decision-log.md for the recorded choice).
 
+permissions:
+  contents: read
+
 on:
   push:
     branches: [main]
     paths:
       - "plugin/**"
+      - "mission-control/src/app/manual/**"
   schedule:
     # Daily, so environment/date drift (e.g. a hardcoded timestamp fixture going stale) is
     # caught even on a week with no push touching plugin/**.
@@ -27,5 +31,17 @@ jobs:
       - uses: actions/setup-node@v4
         with:
           node-version: "24"
+      # Required tools: zsh, Codex config/execpolicy parser, Acorn AST oracle, Chromium CSP fixture.
+      # The suites that require each tool exercise it as configured below.
+      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
+        with:
+          version: "10.12.1"
+      - name: Install engine test dependencies
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y zsh
+          npm install --global @openai/codex@0.144.1
+          pnpm --dir mission-control install --frozen-lockfile
+          pnpm --dir mission-control exec playwright install --with-deps chromium
       - name: Run plugin/scripts/test-*.mjs corpus
         run: bash plugin/scripts/run-engine-tests.sh
[exit 0]
```

```text
$ git -C /Users/Shared/Proyectos/panda-corp log -5 --date=iso --format=%h %ad %s main -- plugin/templates/stack-a-nextjs/verify.sh
23579f00 2026-11-15 22:43:08 -0500 fix(templates): accept .spec.mts/.cts in e2e inventories and keep the test-DB residue check (plugin 10.13.4, overlay 9.4.2)
57504bc4 2026-11-13 07:53:04 -0500 feat(plugin): keep the gate fast over time (unclassified-spec and stage-budget warnings, shared Vitest policy) - plugin 10.2.0, overlay 9.2.0
14e5b10c 2026-11-12 22:51:56 -0500 feat(plugin): faster quality gate (fail-fast, single gate owner, prod-build browser gates, mobile allowlist, parallel-safe workers, affected iteration) - plugin 10.1.0, overlay 9.1.0
3f5f0906 2026-11-10 07:38:52 -0500 fix(templates): no size-dependent gate verdicts under pipefail (BL-0306)
6f7d6440 2026-11-10 02:09:09 -0500 feat(gate): light Stop gate, certified-tree queue skip, seeded vitest (DR-146)
[exit 0]
```

### Otras ramas no mergeadas: ventana inclusiva 2026-10-30–2026-11-20
Criterio: fecha de tip >= 2026-10-30; nombre relevante o diff main...rama toca los paths pedidos. Se inspeccionan nombres locales, no remotos.

```text
$ git -C /Users/Shared/Proyectos/panda-corp branch --no-merged main --sort=-committerdate
+ feat/verify-affected-browser-gates
  fin/lane-k
  fin/lane-p
  fin/lane-o
  fin/lane-n
  fin/lane-l
  fin/lane-m
  fin/lane-b
  fin/lane-e
  fin/lane-e-review-fixes
  fin/lane-g
  fin/lane-c
  fin/lane-a
  fin/lane-h
  fin/lane-d
  fin/lane-f
  fin/lane-i
  fin/lane-j
  orch/g2
  orch/f2
  orch/f1
  orch/s6b
  orch/s6a
  orch/s5b
  orch/s5c
  orch/s5a
  orch/s4a
  orch/s3b
  orch/s4b
  orch/s4c
  orch/s3c
  orch/s3a
  orch/s2a
  orch/s2b
  orch/s2c
  orch/s1b
  orch/s1a
  orch/s1c
  orch/frd-02
  orch/gate-w0
  orch/w0
  orch/frd-21
  orch/frd-14
  lane/c-wo-04-013
  lane/c-wo-02-019
  lane/c-wo-25-001
[exit 0]
```

Coincidencias adicionales (**medida** por algoritmo collect.py): 0

## 2. Modos ya instalados

Sin flags: estáticos completos + Vitest completo + navegador completo; scope full, sello solo verde y árbol limpio e inalterado. --light: todos los estáticos, sin navegador ni Vitest salvo --tests; partial. --since SHA en primera posición: estáticos globales, Vitest --changed SHA, Playwright smoke+shell; since. --only: solo subgates nombrados; partial. --files: Biome sobre paths y Vitest related; demás gates globales incluido navegador; partial. --tests: prioridad sobre --files/--since para Vitest run de archivos explícitos; partial, navegador conserva selección general. --affected: estáticos y Vitest completos, omisión binaria de navegador solo data-only; partial aun si mantiene todo. --no-bail: no reduce selección ni scope, acumula fallos, quita bail/maxFailures; puede certificar full. --report-all acumula estáticos, no equivale por sí solo a no-bail. --canary delega y no genera reporte propio. --light y --only son excluyentes. Los scopes parciales/since nunca escriben sello; cualquier rojo invalida. Las citas siguientes incluyen implementación y plantilla, no solo comentarios.


### /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1: #!/usr/bin/env bash

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:2: # Canonical MAXIMUM fail-closed gate (DR-059) for the Next.js stack.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:3: # Installed VERBATIM into projects by /pandacorp:architecture; re-synced + conformance-checked

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:4: # (drift => regenerate/fail) by /pandacorp:upgrade. Do NOT hand-edit per project — drift is RED.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:5: # Every gate is fail-closed: a missing harness (smoke/visual) is RED, never a skip (DR-019/055/056).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:6: # This script is ALWAYS strict — it never softens itself. The build engine drives it (`--since`

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:7: # per FRD, full at close-out). The PHASE-AWARENESS lives in the Stop hook (verify-before-stop.sh,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:8: # DR-063): that wrapper skips THIS gate while a build is active so it doesn't block every turn;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:9: # the engine keeps running this strictly. So: hook = phase-aware; verify.sh = always strict.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:10: #

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:11: # WP-05 additions — SCOPE and DATA only, nothing here ever softens what counts as red:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:12: #   `--report-all`: the 9 cheap sub-gates below (structure guard through madge) accumulate ALL

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:13: #   their failures before aborting, instead of stopping at the very first one. vitest and

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:14: #   Playwright fail fast by default; --no-bail (or PANDACORP_VERIFY_NO_BAIL=1) accumulates failures.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:15: #   Without the flag, the cheap gates keep today's exact fail-fast behavior.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:16: #   ALWAYS (every run, every mode, green or red, with or without `--report-all`) writes

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:17: #   `.pandacorp/run/gate-report.json` — a machine-readable verdict for Mission Control or any other

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:18: #   reader, so nobody has to scrape this script's human stdout. LESSON-0155: a stale report from a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:19: #   previous run must never be read as this run's verdict, so it is deleted before anything runs.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:20: #

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:21: # WP-08 additions — SCOPE only, nothing here ever softens what counts as red:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:22: #   `--only=<subgate>[,<subgate>...]`: run ONLY the named sub-gates (names exactly as they appear in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:23: #   the gate report: structure-guard data-layer api-error-contract doc-lint residual-ambiguity biome

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:24: #   tsc knip madge vitest playwright). An unknown name is FAIL-CLOSED — non-zero exit before any gate

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:25: #   runs, never a silent fallback to the full suite.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:26: #   `--files=<path>[,<path>...]`: narrow the two file-addressable gates — biome runs on exactly those

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:27: #   paths, and vitest switches to `vitest related <paths>` (the tests those files affect). tsc, knip

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:28: #   and madge stay WHOLE-PROJECT by design: they are whole-program analyses whose whole value is

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:29: #   catching what a scoped run cannot see, and they are the cheap ones anyway (~2.5s/1.6s/3.1s).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:30: #   EITHER flag stamps the report `"scope":"partial"`. That label is load-bearing: the build engine

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:31: #   REFUSES to promote a work order to VERIFIED or advance `last_green_sha` on a partial report, so a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:32: #   scoped run can never be mistaken for a full green by a later reader. A scoped run writes nothing

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:33: #   but the report (which, being partial, is self-describing), so it leaves no other artifact behind.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:34: #

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:35: # DR-146 additions — SCOPE, ORDER and PROVENANCE only, nothing here ever softens what counts as red:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:36: #   `--affected`: iteration only; omit browser ONLY for proven data-only diffs (queries/worker).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:37: #   UI, unknown paths or uncertain Git keep the browser. Always partial, never certification.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:38: #   `--light`: the Stop hook's per-turn gate — every cheap static sub-gate (structure guard through

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:39: #   madge, whole project), NEVER Playwright and NEVER the whole vitest suite. Exclusive with `--only`.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:40: #   `--tests=<test-file>[,...]`: vitest runs EXACTLY these test files (`vitest run <files>`), nothing

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:41: #   inferred. With `--light` it adds vitest to the light set. Both flags stamp `"scope":"partial"`.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:42: #   Vitest always runs in a shuffled order with an explicit seed, printed before the run and recorded

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:43: #   as `vitest_seed` in gate-report.json; `PANDACORP_VITEST_SEED=<n>` replays that exact order.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:44: #   Certified tree: a FULL run (no --since/--only/--files/--light/--tests) that exits 0 on a tree

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:45: #   that was clean when it started records that tree via `.pandacorp/green-stamp.sh`; every red exit

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:46: #   drops the stamp. merge-queue.sh and the Stop hook trust ONLY that stamp to skip a re-run.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:47: set -euo pipefail

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:48: shopt -s inherit_errexit 2>/dev/null || true  # bash 4.4+; no-op on macOS' bash 3.2 (avoids "invalid shell option")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:49: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:50: # DR-158: one verification owner per physical checkout, BEFORE touching reports/stamps/builds.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:51: # The kernel releases this advisory lock after the owner and its children exit, including crashes.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:52: # Keep the inode: unlinking a lock file would let a third owner lock a different inode.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:53: if [ "${PANDACORP_VERIFY_OWNER_PID:-}" != "$$" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:54:   exec python3 - "$0" "$@" <<'OWNERPY'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:55: import fcntl

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:56: import os

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:57: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:58: import sys

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:59: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:60: run = Path('.pandacorp/run')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:61: run.mkdir(parents=True, exist_ok=True)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:62: lock = os.open(run / 'verify.lock', os.O_RDWR | os.O_CREAT, 0o600)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:63: try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:64:     fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:65: except BlockingIOError:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:66:     owner = os.read(lock, 4096).decode(errors='replace').strip() or 'initializing'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:67:     print(f'verify: verification owner busy in {Path.cwd()}: {owner}; wait for it to exit, then retry (exit 75; no project verdict)', file=sys.stderr)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:68:     sys.exit(75)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:69: os.ftruncate(lock, 0)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:70: os.write(lock, f'pid={os.getpid()} checkout={Path.cwd()}'.encode())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:71: os.dup2(lock, 9, inheritable=True)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:72: if lock != 9:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:73:     os.close(lock)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:74: os.environ['PANDACORP_VERIFY_OWNER_PID'] = str(os.getpid())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:75: os.execvp('bash', ['bash', *sys.argv[1:]])

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:76: OWNERPY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:77: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:78: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:79: # --- Optional scope: `verify.sh --since <sha>` (the fast per-FRD gate) ----------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:80: # Runs only the vitest tests CHANGED since <sha>; biome/tsc/knip/madge stay global

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:81: # (fast enough, and they scale). ALSO scopes the browser layer (DR-106): in --since mode

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:82: # only smoke + shell run (correctness + gross structure — exactly what the DR-072 gate may

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:83: # block on); visual + responsive belong to the FULL unscoped suite at close-out + the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:84: # end-of-build Visual QA pass (fidelity is ADVISORY at the per-FRD gate, never a block).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:85: # Before DR-106 every FRD gate ran the WHOLE serialized e2e suite (workers:1) — the single

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:86: # biggest wall-clock cost of a build (11 gates x full Playwright in the personal-page-v2 run).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:87: AFFECTED=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:88: AFFECTED_BASE="origin/main"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:89: for _affected_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:90:   [ "$_affected_arg" != "--affected" ] || AFFECTED=1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:91: done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:92: SINCE=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:93: if [ "${1:-}" = "--since" ] && [ -n "${2:-}" ]; then SINCE="$2"; fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:94: # In affected mode --since is the diff base (any argument position); all OTHER gates stay full.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:95: # Without --affected, preserve the legacy positional --since behavior and command lines exactly.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:96: if [ "$AFFECTED" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:97:   _affected_expect=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:98:   for _affected_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:99:     if [ "$_affected_expect" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:100:       AFFECTED_BASE="$_affected_arg"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:101:       _affected_expect=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:102:     elif [ "$_affected_arg" = "--since" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:103:       AFFECTED_BASE=""  # Missing/invalid ref makes the classifier retain the full browser layer.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:104:       _affected_expect=1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:105:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:106:   done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:107:   SINCE=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:108: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:109: # D11: --since is ONLY recognised at position $1 (above) — anywhere else it silently no-ops

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:110: # (REV2-H characterised this; the engine's own contract already never emits it elsewhere). Warn so a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:111: # caller sees why the run went unscoped instead of just noticing scope isn't "since" later.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:112: if [ "$AFFECTED" -eq 0 ] && [ "${1:-}" != "--since" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:113:   for _wp11_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:114:     if [ "$_wp11_arg" = "--since" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:115:       echo "⚠ --since ignored: it must be the first argument"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:116:       echo "⚠ --since ignored: it must be the first argument"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:117:       break

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:118:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:119:   done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:120: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:121: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:122: # --- Gate-report scaffolding (WP-05) — the stale-report DELETE runs before ANY branch below,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:123: # including --canary (REV-C/LESSON-0155): a report left by a PREVIOUS verify run must never survive

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:124: # to be misread as a canary/current run's verdict. Only the mkdir/rm belong here — the rest of the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:125: # report machinery (timestamps, fragments dir, the trap) stays below, after the --canary early exit,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:126: # since --canary never generates a gate-report.json of its own (see that block's comment).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:127: REPORT_DIR=".pandacorp/run"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:128: REPORT_FILE="$REPORT_DIR/gate-report.json"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:129: mkdir -p "$REPORT_DIR"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:130: rm -f "$REPORT_FILE"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:131: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:132: # DR-159: inventory drift is advisory; selection remains serial + both platforms.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:133: # Opt in independently on each axis by keeping its project-owned inventory.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:134: python3 - <<'INVENTORYPY'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:135: import json

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:136: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:137: import re

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:138: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:139: root = Path('e2e')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:140: specs = sorted(p.relative_to(root).as_posix() for p in root.rglob('*')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:141:                if p.is_file() and re.search(r'\.(spec|test)\.[cm]?[jt]sx?$', p.name))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:142: def load(name):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:143:     return json.loads((root / name).read_text())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:144: def warn(message):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:145:     print('WARN DR-159: ' + message)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:146: if (root / 'parallel-safe.json').exists():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:147:     try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:148:         safe = load('parallel-safe.json')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:149:         serial = load('serial-specs.json') if (root / 'serial-specs.json').exists() else {}

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:150:         if (not isinstance(safe, list) or any(not isinstance(x, str) for x in safe)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:151:                 or not isinstance(serial, dict)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:152:                 or any(not isinstance(v, str) or not v.strip() for v in serial.values())):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:153:             raise ValueError('expected parallel array and serial {spec: reason} object')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:154:         missing = sorted(set(specs) - set(safe) - set(serial))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:155:         if missing:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:156:             warn('unclassified parallel/serial specs (kept serial):\n  ' + '\n  '.join(missing)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:157:                  + '\n  Review transitive writes; update parallel-safe.json or serial-specs.json with reasons.')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:158:         overlap = sorted(set(safe) & set(serial))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:159:         if overlap:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:160:             warn('conflicting parallel/serial classifications: ' + ', '.join(overlap))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:161:         stale = sorted((set(safe) | set(serial)) - set(specs))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:162:         if stale:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:163:             warn('stale parallel/serial entries: ' + ', '.join(stale))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:164:     except (OSError, ValueError, TypeError) as error:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:165:         warn('cannot audit parallel/serial inventory: ' + str(error))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:166: if (root / 'mobile-specs.json').exists():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:167:     try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:168:         mobile = load('mobile-specs.json')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:169:         included, excluded = mobile['include'], mobile['desktopOnly']

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:170:         if (not isinstance(included, list) or not isinstance(excluded, list)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:171:                 or any(not isinstance(x, str) for x in included + excluded)):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:172:             raise ValueError('expected include/desktopOnly string arrays')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:173:         missing = sorted(set(specs) - set(included) - set(excluded))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:174:         if missing:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:175:             warn('unclassified mobile specs (kept on both platforms):\n  ' + '\n  '.join(missing)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:176:                  + '\n  Update mobile-specs.json and its review document with viewport evidence.')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:177:     except (OSError, ValueError, TypeError, KeyError) as error:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:178:         warn('cannot audit mobile inventory: ' + str(error))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:179: INVENTORYPY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:180: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:181: # --- Canary mode (DR-079): prove each fail-closed gate STILL goes RED on a broken input ---------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:182: # `verify.sh --canary` runs the project's deliberately-broken fixtures through the gates and asserts

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:183: # each gate REJECTS its fixture — a gate that stays GREEN on a broken input has rotted (a renamed

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:184: # selector, a disabled rule, a swallowed exit code) and THAT is a RED. Invoked by /pandacorp:upgrade,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:185: # never on a normal build. Vacuous until the fixtures + runner are installed (like doc-lint, DR-077),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:186: # so it can never red-lock a normal run. UNTOUCHED by WP-05: canary.sh is its own standalone runner

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:187: # (it mirrors these checks directly against generated fixtures) — this script hands off to it before

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:188: # any of the report-all/gate-report GENERATION machinery below even runs, so `--canary` never produces

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:189: # a gate-report.json from THIS script (the "canary" value in the report's `scope` enum is reserved for

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:190: # canary.sh's own future use, not emitted here) — but the stale-report DELETE above already ran, so a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:191: # canary run never leaves a PRIOR run's report readable as if it were canary's own verdict.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:192: if [ "${1:-}" = "--canary" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:193:   if [ -f .pandacorp/canary.sh ]; then exec bash .pandacorp/canary.sh; fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:194:   echo "✓ canary: no .pandacorp/canary.sh installed yet (DR-079 — vacuous pass)"; exit 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:195: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:196: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:197: # --- Report-all mode (WP-05) ----------------------------------------------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:198: # Detected ANYWHERE in argv (order-independent), so it composes with `--since` in either order —

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:199: # `--since`'s own detection above is untouched, and this scan never changes what it resolves to.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:200: # WP-08 rides the SAME scan for `--only` / `--files` (both the `--only=x,y` and the `--only x,y`

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:201: # spelling, so a plausible invocation can never be silently ignored and degrade to a full run).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:202: NO_BAIL="${PANDACORP_VERIFY_NO_BAIL:-0}"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:203: REPORT_ALL=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:204: ONLY_GATES=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:205: SCOPE_FILES=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:206: LIGHT=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:207: SCOPE_TESTS=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:208: _wp08_expect=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:209: for _wp05_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:210:   if [ -n "$_wp08_expect" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:211:     case "$_wp08_expect" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:212:       only)  ONLY_GATES="$_wp05_arg" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:213:       files) SCOPE_FILES="$_wp05_arg" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:214:       tests) SCOPE_TESTS="$_wp05_arg" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:215:     esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:216:     _wp08_expect=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:217:     continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:218:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:219:   case "$_wp05_arg" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:220:     --report-all) REPORT_ALL=1 ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:221:     --no-bail) NO_BAIL=1 ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:222:     --affected) AFFECTED=1 ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:223:     --light)      LIGHT=1 ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:224:     --only=*)     ONLY_GATES="${_wp05_arg#--only=}" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:225:     --files=*)    SCOPE_FILES="${_wp05_arg#--files=}" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:226:     --tests=*)    SCOPE_TESTS="${_wp05_arg#--tests=}" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:227:     --only)       _wp08_expect="only" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:228:     --files)      _wp08_expect="files" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:229:     --tests)      _wp08_expect="tests" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:230:   esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:231: done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:232: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:233: # The `--files` list as a real argv array (bash 3.2 compatible). Kept EMPTY when the flag is absent,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:234: # which is what every "unscoped behaves exactly as before" branch below tests against.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:235: SCOPE_FILES_ARR=()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:236: if [ -n "$SCOPE_FILES" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:237:   _wp08_oldifs="$IFS"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:238:   IFS=','

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:239:   for _wp08_f in $SCOPE_FILES; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:240:     if [ -n "$_wp08_f" ]; then SCOPE_FILES_ARR+=("$_wp08_f"); fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:241:   done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:242:   IFS="$_wp08_oldifs"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:243: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:244: SCOPE_TESTS_ARR=()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:245: if [ -n "$SCOPE_TESTS" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:246:   _wp08_oldifs="$IFS"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:247:   IFS=','

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:248:   for _wp08_f in $SCOPE_TESTS; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:249:     if [ -n "$_wp08_f" ]; then SCOPE_TESTS_ARR+=("$_wp08_f"); fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:250:   done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:251:   IFS="$_wp08_oldifs"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:252: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:253: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:254: # The canonical sub-gate names — the SAME strings the gate report's `name` field carries, so the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:255: # engine can feed a report's failing sub-gate straight back in as `--only=<name>`.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:256: KNOWN_GATES="live-data-asserts structure-guard data-layer api-error-contract doc-lint residual-ambiguity biome tsc knip madge vitest playwright"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:257: # DR-146 `--light`: derived from KNOWN_GATES (one list, never a second hand-kept copy) — every cheap

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:258: # gate, vitest only for an explicit `--tests` list, never Playwright. `--only` would make the meaning

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:259: # of the run ambiguous, so the combination is refused below (fail-closed), never resolved silently.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:260: LIGHT_CONFLICT=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:261: if [ "$LIGHT" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:262:   if [ -n "$ONLY_GATES" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:263:     LIGHT_CONFLICT=1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:264:   else

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:265:     for _dr146_g in $KNOWN_GATES; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:266:       case "$_dr146_g" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:267:         playwright) ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:268:         vitest) [ "${#SCOPE_TESTS_ARR[@]}" -gt 0 ] && ONLY_GATES="$ONLY_GATES,vitest" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:269:         *) ONLY_GATES="$ONLY_GATES,$_dr146_g" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:270:       esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:271:     done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:272:     ONLY_GATES="${ONLY_GATES#,}"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:273:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:274: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:275: gate_selected() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:276:   if [ -z "$ONLY_GATES" ]; then return 0; fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:277:   case ",$ONLY_GATES," in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:278:     *",$1,"*) return 0 ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:279:   esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:280:   return 1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:281: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:282: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:283: # --- Gate-report scaffolding (WP-05) — ALWAYS-written `.pandacorp/run/gate-report.json` -------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:284: # `.pandacorp/run/` is the existing gitignored runtime-scratch convention (see .pandacorp/run/

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:285: # lessons.md) — never committed, never conformance-checked, purely machine state for this run.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:286: # REPORT_DIR/REPORT_FILE + the stale-report delete moved ABOVE the --canary branch (REV-C); only the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:287: # timestamp/scope/fragments-dir setup for actually WRITING a fresh report lives here.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:288: GATE_RUN_AT=$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:289: GATE_SCOPE="full"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:290: [ -n "$SINCE" ] && GATE_SCOPE="since"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:291: # WP-08: `partial` outranks `since`. It is the WEAKEST claim this script can make about a run, and the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:292: # engine's certification cage keys on exactly this value — so when both apply, report the weaker one.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:293: [ -n "$ONLY_GATES$SCOPE_FILES$SCOPE_TESTS" ] && GATE_SCOPE="partial"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:294: [ "$LIGHT" -eq 1 ] && GATE_SCOPE="partial"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:295: [ "$AFFECTED" -eq 1 ] && GATE_SCOPE="partial"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:296: # DR-158: the ONLY canonical path policy. fnmatchcase globs are repository-relative;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:297: # '*' includes '/'. UI patterns win; everything outside DATA_ONLY is unknown => browser runs.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:298: # A project may ADD UI globs in .pandacorp/verify-affected.json (never overwrite on upgrade).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:299: # Git failures, invalid config and unusual paths all retain the browser gate.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:300: # Nested projects normalize repo paths; a change outside the project is unknown, never ignored.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:301: AFFECTED_SKIP=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:302: if [ "$AFFECTED" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:303:   if python3 - "$AFFECTED_BASE" <<'PY'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:304: import fnmatch

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:305: import json

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:306: import os

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:307: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:308: import subprocess

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:309: import sys

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:310: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:311: UI = (

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:312:     'src/app/*', 'src/components/*', 'src/hooks/*', 'src/styles/*', 'src/tokens/*',

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:313:     'src/i18n/*', 'src/messages/*', 'messages/*', 'styles/*', 'tokens/*',

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:314:     'e2e/*', 'playwright.config.*', 'next.config.*', 'public/*',

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:315:     'package.json', '*lock*', 'docs/design/*', 'prisma/*',

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:316:     '*.tsx', '*.jsx', '*.css', '*.scss', '*.sass', '*.less', '*.svg',

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:317: )

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:318: DATA_ONLY = ('src/queries/*.ts', 'src/worker/*.ts')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:319: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:320: def git(*args, input=None):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:321:     return subprocess.check_output(['git', *args], input=input, stderr=subprocess.DEVNULL)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:322: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:323: def matches(path, patterns):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:324:     return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:325: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:326: try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:327:     prefix = os.fsdecode(git('rev-parse', '--show-prefix')).strip()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:328:     repo = os.fsdecode(git('rev-parse', '--show-toplevel')).strip()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:329:     # Presence is enough: fsmonitor and clean filters can hide physical UI edits.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:330:     # Exit 1 means absent; any other config error keeps the full suite.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:331:     for pattern in (r'^core\.fsmonitor$', r'^filter\..*\.clean$'):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:332:         result = subprocess.run(['git', 'config', '--get-regexp', pattern],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:333:                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:334:         if result.returncode != 1:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:335:             raise ValueError('configured monitor/filter or config query failure')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:336:     # Ask Git to resolve attributes (including nested .gitattributes and info/attributes)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:337:     # for every tracked/non-ignored untracked file, regardless of its apparent diff.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:338:     files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:339:     attrs = git('check-attr', '--all', '-z', '--stdin', input=files).split(b'\0')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:340:     if attrs[-1] != b'' or (len(attrs) - 1) % 3:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:341:         raise ValueError('invalid attribute response')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:342:     if b'filter' in attrs[1::3]:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:343:         raise ValueError('filter attribute makes working-tree changes uncertain')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:344:     # Diff/status honor these index flags and can silently hide local UI edits.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:345:     # -v lowercases assume-unchanged entries; S/s marks skip-worktree. Any such

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:346:     # entry invalidates path selection, even if its apparent path is data-only.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:347:     for entry in git('-C', repo, 'ls-files', '-v', '-z').split(b'\0'):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:348:         if entry and (entry[:1].islower() or entry[:1] == b'S'):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:349:             raise ValueError('index flags can hide working-tree changes')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:350:     ui = list(UI)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:351:     config = Path('.pandacorp/verify-affected.json')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:352:     if config.is_symlink():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:353:         raise ValueError('symlinked config')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:354:     if config.exists():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:355:         extra = json.loads(config.read_text())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:356:         if (not isinstance(extra, dict) or set(extra) != {'ui'}

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:357:                 or not isinstance(extra['ui'], list)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:358:                 or any(not isinstance(p, str) or not p or p.startswith(('/', '-'))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:359:                        or '..' in p.split('/') for p in extra['ui'])):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:360:             raise ValueError('expected {"ui": ["repo-relative glob", ...]}')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:361:         ui.extend(extra['ui'])

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:362:     base = git('rev-parse', '--verify', '--end-of-options', sys.argv[1] + '^{commit}').strip().decode('ascii')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:363:     anchor = git('merge-base', base, 'HEAD').strip().decode('ascii')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:364:     # A UI symlink can expose ANY data path (including newly added routes). Avoid

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:365:     # dependency/alias resolution entirely: any tracked symlink keeps the full suite.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:366:     # Inspect BOTH trees plus the index so deleted, staged and dangling links count.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:367:     # Gitlinks (submodules) can also hide arbitrary nested UI under a data-only path.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:368:     entries = git('ls-tree', '-r', '-z', '--full-tree', anchor)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:369:     entries += git('ls-tree', '-r', '-z', '--full-tree', 'HEAD')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:370:     entries = b'\0'.join(entry for entry in entries.split(b'\0')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:371:                          if b'\t' in entry and os.fsdecode(entry.split(b'\t', 1)[1]).startswith(prefix))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:372:     entries += b'\0' + git('ls-files', '--stage', '-z')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:373:     if any(entry.startswith((b'120000 ', b'160000 ')) for entry in entries.split(b'\0')):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:374:         raise ValueError('tracked symlink/gitlink makes UI reachability uncertain')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:375:     # --no-renames includes BOTH sides of renames. Union each Git layer separately:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:376:     # a staged UI change restored only in the working tree must not cancel out of the diff.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:377:     diff_options = ('--no-ext-diff', '--no-renames', '--ignore-submodules=none', '--name-only', '-z')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:378:     paths = git('diff', *diff_options, anchor, 'HEAD', '--')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:379:     paths += git('diff', *diff_options, '--cached', 'HEAD', '--')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:380:     paths += git('diff', *diff_options, '--')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:381:     paths += git('-C', repo, 'ls-files', '--others', '--exclude-standard', '-z')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:382:     for raw in paths.split(b'\0'):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:383:         if not raw:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:384:             continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:385:         path = os.fsdecode(raw)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:386:         if not path.startswith(prefix):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:387:             raise ValueError('changed path outside nested project')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:388:         path = path[len(prefix):]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:389:         if (any(p.is_symlink() for p in (Path(path), *Path(path).parents))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:390:                 or matches(path, ui) or not matches(path, DATA_ONLY)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:391:                 or any(part in ('.', '..') for part in path.split('/'))):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:392:             raise ValueError('UI or unknown path')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:393: except (OSError, ValueError, subprocess.SubprocessError):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:394:     sys.exit(1)  # No successful classification => run the original full browser layer.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:395: sys.exit(0)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:396: PY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:397:   then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:398:     AFFECTED_SKIP=1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:399:     GATE_SCOPE="partial"  # Reuse the engine's unconditional no-VERIFIED/no-last_green cage.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:400:     echo "↷ Playwright omitted by diff against $AFFECTED_BASE (scope: partial; not certification)"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:401:   else

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:402:     echo "→ --affected: UI/unknown path or classification unavailable; retaining full browser gate"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:403:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:404: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:405: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:406: # BL-0147: stamp the commit this run verified so a LATER reader (the build engine's close-out/

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:407: # notify-end) can prove a report was produced for the EXACT commit it is about to re-verify, instead

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:408: # of trusting scope+green alone (which say nothing about WHICH commit). Best-effort — a fixture/non-

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:409: # git checkout (or a detached/rebasing tree mid-op) leaves it empty, never fails the gate over it.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:410: GATE_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:411: # DR-146: the tree a FULL run is about to judge, captured BEFORE any gate and only when it is clean

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:412: # (green-stamp.sh owns what "clean" means). Empty = this run can never certify a tree.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:413: STAMP_START_TREE=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:414: if [ "$GATE_SCOPE" = "full" ] && [ -f .pandacorp/green-stamp.sh ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:415:   STAMP_START_TREE=$(bash .pandacorp/green-stamp.sh start 2>/dev/null || true)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:416: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:417: # DR-146: vitest order is always shuffled with an explicit seed so a red caused by test order can be

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:418: # replayed exactly. A malformed replay seed is an invocation error, never silently replaced.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:419: VITEST_SEED="${PANDACORP_VITEST_SEED:-}"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:420: VITEST_SEED_USED=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:421: if [ -z "$VITEST_SEED" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:422:   VITEST_SEED=$(( ((RANDOM << 15) | RANDOM) + 1 ))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:423: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:424: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:425: GATE_FRAGMENTS_DIR=$(mktemp -d)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:426: : > "$GATE_FRAGMENTS_DIR/fragments.jsonl"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:427: cleanup_gate_report() { rm -rf "$GATE_FRAGMENTS_DIR"; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:428: trap cleanup_gate_report EXIT

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:429: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:430: # Portable millisecond clock. GNU `date +%s%N` gives nanoseconds; BSD `date` on older macOS does

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:431: # NOT expand `%N` (it prints a literal "N"), so detect that and fall back to python3, then perl,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:432: # then whole-second precision as a last resort. (Verified: this machine's BSD `date` DOES expand

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:433: # %N — but the fleet includes older macOS where it doesn't, so the fallback chain stays.)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:434: now_ms() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:435:   local raw

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:436:   raw=$(date +%s%N 2>/dev/null || true)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:437:   case "$raw" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:438:     ''|*[!0-9]*) raw="" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:439:   esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:440:   if [ -n "$raw" ] && [ "${#raw}" -ge 19 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:441:     echo $(( raw / 1000000 ))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:442:     return

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:443:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:444:   if command -v python3 >/dev/null 2>&1; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:445:     python3 -c 'import time; print(int(time.time() * 1000))'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:446:     return

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:447:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:448:   if command -v perl >/dev/null 2>&1; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:449:     perl -MTime::HiRes=time -e 'printf("%d\n", time() * 1000)'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:450:     return

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:451:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:452:   echo $(( $(date +%s) * 1000 ))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:453: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:454: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:455: # Parses one gate's captured output into `failures[]` with a minimal, tolerant parser matched to

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:456: # the tool's own output shape; NEVER emits an empty array on a red exit (falls back to the last 20

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:457: # captured lines as a single {"msg": ...} entry). Reads the log FILE (not argv) so failure text

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:458: # with quotes/backticks/`$`/newlines can never break shell quoting.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:459: record_gate_result() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:460:   local name="$1" parser="$2" rc="$3" dur_ms="$4" log="$5"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:461:   python3 - "$name" "$parser" "$rc" "$dur_ms" "$log" <<'PY' >> "$GATE_FRAGMENTS_DIR/fragments.jsonl"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:462: import json

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:463: import re

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:464: import sys

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:465: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:466: name, parser, rc, dur_ms, log_path = sys.argv[1:6]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:467: rc = int(rc)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:468: dur_ms = int(dur_ms)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:469: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:470: try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:471:     with open(log_path, "r", errors="replace") as fh:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:472:         text = fh.read()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:473: except OSError:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:474:     text = ""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:475: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:476: lines = text.splitlines()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:477: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:478: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:479: def tail_fallback():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:480:     tail = lines[-20:] if lines else []

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:481:     msg = "\n".join(tail).strip() or "(no output captured)"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:482:     return [{"msg": msg}]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:483: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:484: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:485: failures = []

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:486: if rc != 0:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:487:     if parser == "tsc":

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:488:         # src/foo.ts(12,5): error TS2322: Type '"x"' is not assignable to type 'number'.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:489:         pat = re.compile(r"^(?P<file>[^\s(][^():]*)\((?P<line>\d+),\d+\): error (?P<code>TS\d+): (?P<msg>.*)$")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:490:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:491:             m = pat.match(ln.strip())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:492:             if m:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:493:                 failures.append({

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:494:                     "file": m.group("file"),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:495:                     "line": int(m.group("line")),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:496:                     "code": m.group("code"),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:497:                     "msg": m.group("msg"),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:498:                 })

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:499:     elif parser == "biome":

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:500:         # src/foo.ts:12:3 lint/suspicious/noExplicitAny  ────  Unexpected any. Specify a different type.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:501:         pat = re.compile(r"^(?P<file>[\w./-]+):(?P<line>\d+):(?P<col>\d+)\s+(?P<msg>.*)$")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:502:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:503:             m = pat.match(ln.strip())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:504:             if m:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:505:                 failures.append({"file": m.group("file"), "line": int(m.group("line")), "msg": m.group("msg")})

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:506:     elif parser == "vitest":

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:507:         # " FAIL  src/foo/_tests/bar.test.ts > suite > test name" (also matches the "✗"/"×" markers)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:508:         pat = re.compile(r"^\s*(?:FAIL|✗|×)\s+(?P<file>\S+\.test\.(?:ts|tsx|js|jsx))\b\s*(?P<msg>.*)$")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:509:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:510:             m = pat.match(ln)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:511:             if m:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:512:                 failures.append({"file": m.group("file"), "msg": (m.group("msg") or "").strip() or "failed"})

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:513:     elif parser == "pathlist":

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:514:         # knip/madge/the internal (structure/data-layer/API/doc-lint/residual-ambiguity) gates: each

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:515:         # relevant line carries a source/doc path, possibly alongside other text (e.g. madge's

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:516:         # "1) src/a.ts > src/b.ts > src/a.ts" cycle chains) — extract the first path per line.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:517:         path_re = re.compile(r"[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md)")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:518:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:519:             s = ln.strip()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:520:             if not s:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:521:                 continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:522:             m = path_re.search(s)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:523:             if m:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:524:                 failures.append({"file": m.group(0), "msg": s})

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:525:     # `playwright` (and anything that matched nothing above) falls through to the generic fallback.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:526:     if not failures:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:527:         failures = tail_fallback()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:528: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:529: entry = {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:530:     "name": name,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:531:     "exit": rc,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:532:     "duration_ms": dur_ms,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:533:     "failures": failures,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:534: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:535: print(json.dumps(entry))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:536: PY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:537: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:538: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:539: # Runs one gate: `run_gate <name> <parser> <command...>`. Times it, streams its output live (the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:540: # operator loses nothing) while also capturing it for parsing, and records one report fragment.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:541: # Captures the COMMAND's own exit code via PIPESTATUS[0] (LESSON-0078: `$?` after a pipe reads

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:542: # `tee`'s exit, not the command's) — `set +e` around the pipeline so `set -e` can't abort before

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:543: # that capture happens.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:544: run_gate() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:545:   local name="$1" parser="$2"; shift 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:546:   local log start_ms end_ms dur_ms rc

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:547:   log="$GATE_FRAGMENTS_DIR/log-$name.txt"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:548:   start_ms=$(now_ms)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:549:   set +e

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:550:   "$@" 2>&1 | tee "$log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:551:   rc="${PIPESTATUS[0]}"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:552:   set -e

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:553:   end_ms=$(now_ms)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:554:   dur_ms=$((end_ms - start_ms))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:555:   record_gate_result "$name" "$parser" "$rc" "$dur_ms" "$log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:556:   return "$rc"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:557: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:558: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:559: # Assembles the final report from every fragment recorded so far and writes it — called at EVERY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:560: # exit point (success or any abort) so the file always reflects this run, never a stale one.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:561: write_gate_report() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:562:   local green_exit="$1" green="false"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:563:   [ "$green_exit" -eq 0 ] && green="true"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:564:   # BL-0179: stamp the `--since` base sha (the anchor this scoped run certified FROM) as `since` —

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:565:   # provenance for a reader of the report. The engine's close-out reuse no longer accepts a since-scoped

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:566:   # report (canary E2 finding 7: last_green_sha is itself published from since-scoped runs, so a since

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:567:   # report never adds up to a full one). Empty (never written) on a `full`/`partial` run.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:568:   python3 - "$GATE_RUN_AT" "$GATE_SCOPE" "$green" "$GATE_SHA" "$SINCE" "$GATE_FRAGMENTS_DIR/fragments.jsonl" "$REPORT_FILE" "$VITEST_SEED_USED" "$AFFECTED_SKIP" "$AFFECTED_BASE" <<'PY'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:569: import json

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:570: import sys

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:571: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:572: at, scope, green_str, sha, since, frag_path, out_path, vitest_seed = sys.argv[1:9]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:573: subgates = []

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:574: with open(frag_path, "r") as fh:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:575:     for line in fh:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:576:         line = line.strip()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:577:         if line:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:578:             subgates.append(json.loads(line))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:579: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:580: report = {"at": at, "scope": scope, "green": green_str == "true", "sha": sha, "subgates": subgates}

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:581: if sys.argv[9] == "1":

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:582:     report["scope_reason"] = "affected-no-ui"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:583:     report["browser"] = {"status": "omitted-by-diff", "base": sys.argv[10]}

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:584: if since:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:585:     report["since"] = since

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:586: if vitest_seed:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:587:     report["vitest_seed"] = int(vitest_seed)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:588: # Recorded baseline is project-owned, reviewed and never auto-raised by a slow run.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:589: # Only full runs are comparable; a partial command can have a different workload.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:590: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:591: import math

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:592: budget_path = Path('.pandacorp/gate-budget.json')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:593: if scope == 'full' and budget_path.exists():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:594:     warnings = []

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:595:     try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:596:         budget = json.loads(budget_path.read_text())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:597:         margin = budget.get('margin', 0.25)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:598:         minimum = budget.get('min_delta_ms', 1000)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:599:         stages = budget['stages']

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:600:         def number(value):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:601:             return type(value) in (int, float) and math.isfinite(value)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:602:         if (not number(margin) or margin < 0 or not number(minimum) or minimum < 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:603:                 or not isinstance(stages, dict)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:604:                 or any(not number(v) or v <= 0 for v in stages.values())):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:605:             raise ValueError('expected positive stage milliseconds and non-negative margin/min_delta_ms')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:606:         for gate in subgates:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:607:             baseline = stages.get(gate['name'])

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:608:             actual = gate['duration_ms']

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:609:             if baseline and actual > baseline * (1 + margin) and actual - baseline >= minimum:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:610:                 warnings.append(f"{gate['name']}: {actual} ms > baseline {baseline} ms + {margin:.0%}")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:611:     except (OSError, ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:612:         warnings.append('invalid gate-budget.json: ' + str(error))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:613:     report['budget_warnings'] = warnings

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:614:     for warning in warnings:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:615:         print('WARN DR-159 gate budget: ' + warning)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:616: with open(out_path, "w") as fh:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:617:     json.dump(report, fh, indent=2)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:618:     fh.write("\n")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:619: PY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:620:   # DR-146 certified tree: only a FULL green that started on a clean tree may certify it (and

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:621:   # green-stamp.sh re-checks the tree is unchanged and still clean); ANY red drops the stamp so a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:622:   # tree that just failed can never be skipped on the strength of an older green. Best-effort: a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:623:   # stamp that cannot be written only means the next merge-queue runs the full gate.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:624:   if [ -f .pandacorp/green-stamp.sh ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:625:     if [ "$green_exit" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:626:       bash .pandacorp/green-stamp.sh invalidate || true

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:627:     elif [ "$GATE_SCOPE" = "full" ] && [ -n "$STAMP_START_TREE" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:628:       bash .pandacorp/green-stamp.sh record "$STAMP_START_TREE" || true

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:629:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:630:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:631: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:632: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:633: # --- WP-08 `--only` validation — FAIL-CLOSED, before a single gate runs ------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:634: # A typo'd sub-gate name must never degrade into "run everything" (which a reader would then see as a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:635: # full green) nor into "run nothing" (a vacuous green). It is a hard non-zero exit, and the report it

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:636: # leaves behind says green:false with the offending invocation recorded as its own sub-gate entry.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:637: if [ -n "$ONLY_GATES" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:638:   _wp08_bad=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:639:   _wp08_oldifs="$IFS"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:640:   IFS=','

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:641:   for _wp08_g in $ONLY_GATES; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:642:     if [ -n "$_wp08_g" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:643:       case " $KNOWN_GATES " in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:644:         *" $_wp08_g "*) ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:645:         *) _wp08_bad="$_wp08_bad $_wp08_g" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:646:       esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:647:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:648:   done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:649:   IFS="$_wp08_oldifs"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:650:   if [ -n "$_wp08_bad" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:651:     _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:652:     {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:653:       echo "✗ --only: unknown sub-gate name(s):$_wp08_bad"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:654:       echo "   known sub-gates: $KNOWN_GATES"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:655:     } | tee "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:656:     record_gate_result invocation playwright 2 0 "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:657:     write_gate_report 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:658:     exit 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:659:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:660: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:661: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:662: # --- DR-146 `--light` / seed validation — FAIL-CLOSED, before a single gate runs ----------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:663: dr146_invocation_error() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:664:   local log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:665:   echo "✗ $1" | tee "$log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:666:   record_gate_result invocation playwright 2 0 "$log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:667:   write_gate_report 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:668:   exit 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:669: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:670: case "$NO_BAIL" in 0|1) ;; *) dr146_invocation_error "PANDACORP_VERIFY_NO_BAIL must be 0 or 1" ;; esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:671: export PANDACORP_E2E_CERTIFICATION=1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:672: export PANDACORP_VERIFY_NO_BAIL="$NO_BAIL"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:673: if [ "$LIGHT_CONFLICT" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:674:   dr146_invocation_error "--light and --only are exclusive (--light already names its sub-gates)"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:675: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:676: case "$VITEST_SEED" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:677:   ''|*[!0-9]*) dr146_invocation_error "PANDACORP_VITEST_SEED must be a positive integer, got '$VITEST_SEED'" ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:678: esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:679: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:680: # --- D5 `--files` validation — FAIL-CLOSED, before a single gate runs --------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:681: # REV2-G: unlike --only, --files was forwarded VERBATIM into biome's/vitest's argv with no

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:682: # validation at all — a value shaped like a flag (`--files=--write`) turns a read-only biome CHECK

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:683: # into a project-wide `biome check --write` autofix. And a `..`-bearing path could escape the repo

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:684: # entirely. Reject BOTH before any gate runs, the same fail-closed shape as --only above.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:685: # DR-146: `--tests` paths reach vitest's argv the same way, so they get the same two checks.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:686: _dr146_paths=()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:687: [ ${#SCOPE_FILES_ARR[@]} -gt 0 ] && _dr146_paths+=("${SCOPE_FILES_ARR[@]}")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:688: [ ${#SCOPE_TESTS_ARR[@]} -gt 0 ] && _dr146_paths+=("${SCOPE_TESTS_ARR[@]}")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:689: if [ ${#_dr146_paths[@]} -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:690:   _wp08_root=$(pwd -P)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:691:   for _wp08_f in "${_dr146_paths[@]}"; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:692:     case "$_wp08_f" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:693:       -*)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:694:         _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:695:         echo "✗ --files: path may not start with '-'" | tee "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:696:         record_gate_result invocation playwright 2 0 "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:697:         write_gate_report 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:698:         exit 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:699:         ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:700:     esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:701:     case "$_wp08_f" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:702:       *..*)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:703:         # A `..` segment is only a problem if it actually resolves OUTSIDE the repo root — a path

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:704:         # can legitimately contain `..` and still stay inside (e.g. `src/../src/lib/x.ts`).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:705:         # Lexical resolution only (no filesystem I/O): the path need not exist yet.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:706:         _wp08_resolved=$(python3 - "$_wp08_f" "$_wp08_root" <<'PY' 2>/dev/null

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:707: import os, sys

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:708: p, root = sys.argv[1:3]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:709: ap = p if os.path.isabs(p) else os.path.join(root, p)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:710: print(os.path.normpath(ap))

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:711: PY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:712: ) || _wp08_resolved=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:713:         case "$_wp08_resolved" in

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:714:           "$_wp08_root"|"$_wp08_root"/*) ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:715:           *)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:716:             _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:717:             echo "✗ --files: path escapes the repo: $_wp08_f" | tee "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:718:             record_gate_result invocation playwright 2 0 "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:719:             write_gate_report 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:720:             exit 2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:721:             ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:722:         esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:723:         ;;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:724:     esac

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:725:   done

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:726: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:727: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:728: # Runs one of the 9 CHEAP sub-gates. Without `--report-all`: aborts immediately on the first

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:729: # failure (byte-identical to the pre-WP-05 fail-fast behavior, just now also writing the report).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:730: # With `--report-all`: keeps going so every cheap gate gets a chance to report its own failures;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:731: # the caller aborts once, after all 9 have run, if any of them failed.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:732: # WP-08: a gate `--only` did not name is skipped entirely — it contributes no fragment, so the report

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:733: # shows exactly what ran and nothing implies a gate passed when it never executed.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:734: CHEAP_GATES_FAILED=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:735: LAST_CHEAP_RC=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:736: run_cheap_gate() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:737:   if ! gate_selected "$1"; then return 0; fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:738:   local rc=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:739:   run_gate "$@" || rc=$?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:740:   if [ "$rc" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:741:     CHEAP_GATES_FAILED=1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:742:     LAST_CHEAP_RC="$rc"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:743:     if [ "$REPORT_ALL" -ne 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:744:       write_gate_report "$rc"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:745:       exit "$rc"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:746:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:747:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:748: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:749: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:750: # --- Structure guard (file placement isn't lintable; DR-059) -------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:751: # Fail if any unit/component test sits loose outside a _tests/ folder.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:752: gate_structure_guard() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:753:   local stray

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:754:   stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | grep -v '/_tests/' || true)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:755:   if [ -n "$stray" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:756:     echo "✗ tests must live in a _tests/ folder, not beside source:"; echo "$stray"; return 1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:757:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:758:   return 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:759: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:760: run_cheap_gate structure-guard pathlist gate_structure_guard

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:761: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:762: # --- Behavior-test hygiene (DR-144): heuristic warning, semantic review blocks ---

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:763: gate_live_data_asserts() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:764:   # Keep failures local to this advisory scanner; other gates remain fail-closed.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:765:   if ! python3 - <<'PY'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:766: import fnmatch, os, re

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:767: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:768: patterns = os.environ.get('PANDACORP_CURATED_DATA_GLOBS', 'docs/**/*.json,content/**,prisma/seed*,**/*frozen*.json,**/*snapshot*.json').split(',')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:769: excluded = {'node_modules', '.git', '.next', 'dist', 'coverage', '.pandacorp', '.claude'}

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:770: def incomplete(error):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:771:     print(f'WARNING live-data-asserts: analysis incomplete: {error}')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:772: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:773: for root, dirs, files in os.walk('.', onerror=incomplete):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:774:     dirs[:] = [d for d in dirs if d not in excluded]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:775:     for name in files:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:776:         if not re.search(r'\.(test|spec)\.[cm]?[jt]sx?$', name):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:777:             continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:778:         path = Path(root) / name

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:779:         if 'src/test/' in path.as_posix():

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:780:             continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:781:         try:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:782:             text = path.read_text(encoding='utf-8')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:783:         except (OSError, UnicodeError) as error:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:784:             incomplete(f'{path}: {error}')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:785:             continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:786:         # Direct imports, require and readFile literals only; no claim of data-flow analysis.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:787:         reads = re.findall(r'''(?:\bfrom\s*|\bimport\s*|\b(?:require|readFileSync|readFile)\s*\(\s*)['"]([^'"\n]+)['"]''', text)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:788:         def curated(value):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:789:             value = re.sub(r'^(?:\.\.?/)+', '', value)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:790:             if value.startswith('src/test/'):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:791:                 return False

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:792:             return any(fnmatch.fnmatch(value, p.strip()) or fnmatch.fnmatch(value, p.strip().replace('**/', '')) for p in patterns if p.strip())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:793:         if not any(curated(value) for value in reads):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:794:             continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:795:         for assertion in re.finditer(r'\bexpect\s*\([\s\S]*?;', text):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:796:             tail = text[assertion.end():].split('\n', 1)[0]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:797:             lines = assertion.group().splitlines()

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:798:             if any(re.search(r'//\s*live-data-ok:\s*\S', line) for line in [*lines, tail]):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:799:                 continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:800:             # Ignore quoted strings/comments; numeric strings are not volume literals.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:801:             code = re.sub(r'''(['"`])(?:\\.|(?!\1)[\s\S])*?\1|//[^\n]*|/\*[\s\S]*?\*/''', '', assertion.group())

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:802:             if any(int(n.replace('_', '')) >= 10 for n in re.findall(r'(?<![\w.])\d[\d_]*(?![\w.])', code)):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:803:                 line = text.count('\n', 0, assertion.start()) + 1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:804:                 print(f'{path}:{line}: WARNING live-data-asserts (DR-144): curated read + numeric assertion; use fixture/structural contracts or same-line // live-data-ok: <reason>')

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:805: PY

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:806:   then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:807:     echo 'WARNING live-data-asserts: analysis incomplete: internal scanner failure; semantic review required'

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:808:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:809:   return 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:810: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:811: run_cheap_gate live-data-asserts pathlist gate_live_data_asserts

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:812: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:813: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:814: # --- Data-layer isolation (structure.md STRUCT-2) — DB access only in src/queries/ -------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:815: # The ORM client is created once (src/lib/prisma.ts) and consumed ONLY by the data layer.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:816: # Type-only imports of @prisma/client are fine anywhere. Vacuous without Prisma.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:817: gate_data_layer() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:818:   if [ -d src ] && grep -q '"@prisma/client"' package.json 2>/dev/null; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:819:     local leak leak2

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:820:     leak=$(grep -rEl "new PrismaClient\(|from ['\"]@/lib/prisma['\"]" src --include='*.ts' --include='*.tsx' 2>/dev/null \

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:821:       | grep -v '^src/queries/' | grep -v '^src/lib/prisma\.ts$' || true)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:822:     # value-imports of @prisma/client (not `import type`) outside the sanctioned locations

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:823:     leak2=$(grep -rE "^import \{[^}]*\} from ['\"]@prisma/client['\"]" src --include='*.ts' --include='*.tsx' -l 2>/dev/null \

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:824:       | grep -v '^src/queries/' | grep -v '^src/lib/prisma\.ts$' || true)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:825:     if [ -n "$leak$leak2" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:826:       echo "✗ Data-layer isolation (STRUCT-2): DB access outside src/queries/ (components/actions call queries/, never the ORM):"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:827:       printf '%s\n%s\n' "$leak" "$leak2" | sort -u | sed '/^$/d'; return 1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:828:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:829:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:830:   return 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:831: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:832: run_cheap_gate data-layer pathlist gate_data_layer

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:833: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:834: # --- API error contract (api-design.md API-1, RFC 9457) ----------------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:835: # A route handler that returns 4xx/5xx must use the shared problem() helper

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:836: # (application/problem+json), never an ad-hoc error body. Vacuous without API routes.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:837: gate_api_error_contract() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:838:   if [ -d src/app/api ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:839:     local bad=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:840:     while IFS= read -r f; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:841:       [ -n "$f" ] || continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:842:       if grep -Eq 'status: *(4|5)[0-9][0-9]' "$f" && ! grep -q 'problem' "$f"; then bad="$bad  $f"$'\n'; fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:843:     done < <(find src/app/api -name 'route.ts' 2>/dev/null)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:844:     if [ -n "$bad" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:845:       echo "✗ API error contract (RFC 9457): route handlers return 4xx/5xx without the shared problem() helper (see STACK.md — API error contract):"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:846:       printf '%s' "$bad"; return 1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:847:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:848:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:849:   return 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:850: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:851: run_cheap_gate api-error-contract pathlist gate_api_error_contract

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:852: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:853: # --- Doc-structure lint (DR-077, greenfield fail-closed subset BL-0009) — frontmatter + stable-ID

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:854: # spine; vacuous if no docs ----

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:855: # Validates generated docs (FRD/PRD/work-orders) carry required frontmatter and that REQ->WO IDs

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:856: # resolve. ADVISORY on brownfield/adopted (created_via: adopt, or no provenance recorded) — reports

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:857: # drift and NEVER fails the gate, so it can't red-lock an adopted/partial-spine project. FAIL-CLOSED

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:858: # on greenfield (created_via: scaffold, set by /pandacorp:scaffold) for the structural subset only

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:859: # (missing frontmatter keys, a PRD without `type`) — a project born via scaffold is expected to carry

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:860: # a complete spine, so doc-lint.sh itself now exits non-zero and this call legitimately fails the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:861: # gate. A project with no docs/ passes. The harness is new, so a missing script is a no-op (older

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:862: # overlays); /pandacorp:upgrade installs it. Drift is surfaced here, NOT tracked by a per-doc

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:863: # version stamp (DR-077).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:864: gate_doc_lint() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:865:   if [ -f .pandacorp/doc-lint.sh ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:866:     bash .pandacorp/doc-lint.sh

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:867:     return $?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:868:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:869:   return 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:870: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:871: run_cheap_gate doc-lint pathlist gate_doc_lint

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:872: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:873: # --- Residual-ambiguity gate (DR-100) — a [NEEDS CLARIFICATION] marker must never reach an ACTIVE doc ---

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:874: # Spec/blueprint authors mark an unresolved, build-changing question inline with `[NEEDS CLARIFICATION: …]`

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:875: # (distinct from a resolved `[ASSUMPTION: …]`). The readiness gate forbids it surviving into a live doc:

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:876: # if any file under docs/ carries the marker AND its frontmatter is `status: ACTIVE`, a question shipped

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:877: # into the build → RED. A DRAFT doc may still carry it (spec is still resolving it); no docs/ ⇒ vacuous pass.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:878: gate_residual_ambiguity() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:879:   if [ -d docs ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:880:     local flagged=""

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:881:     while IFS= read -r f; do

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:882:       [ -n "$f" ] || continue

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:883:       if grep -Eq '^status:[[:space:]]*ACTIVE' <<<"$(head -n 25 "$f")"; then flagged="$flagged  $f"$'\n'; fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:884:     done < <(grep -rIl 'NEEDS CLARIFICATION' docs 2>/dev/null || true)

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:885:     if [ -n "$flagged" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:886:       echo "✗ DR-100 readiness: unresolved [NEEDS CLARIFICATION] in ACTIVE docs (resolve → AC / business rule / [ASSUMPTION], or escalate):"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:887:       printf '%s' "$flagged"; return 1

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:888:     fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:889:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:890:   return 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:891: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:892: run_cheap_gate residual-ambiguity pathlist gate_residual_ambiguity

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:893: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:894: # --- Lint + format (every warn is a hard gate; --error-on-warnings) ------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:895: # WP-08: `--files` narrows biome to exactly those paths (it is path-addressable and is the gate a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:896: # mechanical repair agent re-runs most). Unscoped, the command line is byte-for-byte the old one.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:897: if [ "${#SCOPE_FILES_ARR[@]}" -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:898:   run_cheap_gate biome biome pnpm biome check "${SCOPE_FILES_ARR[@]}" --error-on-warnings

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:899: else

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:900:   run_cheap_gate biome biome pnpm biome check . --error-on-warnings

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:901: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:902: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:903: # --- Typing -------------------------------------------------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:904: run_cheap_gate tsc tsc pnpm tsc --noEmit

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:905: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:906: # --- Dead code (fail-closed) --------------------------------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:907: run_cheap_gate knip pathlist pnpm knip

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:908: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:909: # --- Circular dependencies (fail-closed) --------------------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:910: run_cheap_gate madge pathlist pnpm madge --circular --extensions ts,tsx src

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:911: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:912: # `--report-all`: all 9 cheap gates above have now run and reported independently — abort ONCE,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:913: # here, with the aggregate verdict, instead of at the first one (vitest/Playwright never run on a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:914: # cheap-gate red; there is nothing more the expensive layers would add to an already-red verdict).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:915: if [ "$REPORT_ALL" -eq 1 ] && [ "$CHEAP_GATES_FAILED" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:916:   write_gate_report "$LAST_CHEAP_RC"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:917:   exit "$LAST_CHEAP_RC"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:918: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:919: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:920: # --- Behavior -----------------------------------------------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:921: # shellcheck disable=SC2086

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:922: # `|| VITEST_RC=$?` (not a bare call + `$?` on the next line): under `set -e` a plain non-zero

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:923: # command exits the script IMMEDIATELY, before a following `VITEST_RC=$?` would ever run — that

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:924: # would skip write_gate_report entirely on a vitest failure. The `||` keeps this on the safe side

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:925: # of errexit (same reasoning as run_gate's own PIPESTATUS capture just above).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:926: #

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:927: # WP-08 `--files`: switch to `vitest related <paths>` — the tests those source files actually affect.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:928: # VERIFIED against mission-control's installed vitest 4.1.9: `vitest run --related <files>` is NOT a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:929: # valid option there (CACError: Unknown option `--related`); the supported spelling is the `related`

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:930: # SUBCOMMAND, which narrowed 435 discovered test files to the 4 that import src/lib/slug.ts.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:931: # `--passWithNoTests` is deliberate: a file with no related test must not red a SCOPED run (it is not

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:932: # a failure signal, and the scoped run's `partial` report can never certify anything on its own — the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:933: # whole-project re-gate remains the only oracle that certifies).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:934: #

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:935: # DR-146 `--tests`: exactly the named test files (`vitest run <files>`), never a module-graph guess

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:936: # (`related` transforms the whole graph and widens to every spec when a config/package.json is

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:937: # named). The shuffled order + explicit seed apply to every vitest mode.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:938: if gate_selected vitest; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:939: VITEST_RC=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:940: VITEST_SEED_USED="$VITEST_SEED"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:941: VITEST_ORDER=("--bail=$((1 - NO_BAIL))" --sequence.shuffle "--sequence.seed=$VITEST_SEED")

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:942: echo "vitest order: shuffled with seed $VITEST_SEED — replay this exact order: PANDACORP_VITEST_SEED=$VITEST_SEED bash .pandacorp/verify.sh $* (vitest alone: PANDACORP_VITEST_SEED=$VITEST_SEED bash .pandacorp/verify.sh --only=vitest)"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:943: if [ "${#SCOPE_TESTS_ARR[@]}" -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:944:   run_gate vitest vitest pnpm vitest run "${SCOPE_TESTS_ARR[@]}" --reporter=dot --passWithNoTests "${VITEST_ORDER[@]}" || VITEST_RC=$?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:945: elif [ "${#SCOPE_FILES_ARR[@]}" -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:946:   run_gate vitest vitest pnpm vitest related "${SCOPE_FILES_ARR[@]}" --run --reporter=dot --passWithNoTests "${VITEST_ORDER[@]}" || VITEST_RC=$?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:947: else

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:948:   run_gate vitest vitest pnpm vitest run --reporter=dot ${SINCE:+--changed "$SINCE"} "${VITEST_ORDER[@]}" || VITEST_RC=$?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:949: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:950: if [ "$VITEST_RC" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:951:   write_gate_report "$VITEST_RC"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:952:   exit "$VITEST_RC"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:953: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:954: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:955: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:956: # --- Browser gates (DR-055/056/074/075) — FAIL-CLOSED: a missing harness is RED ---

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:957: # ONE playwright invocation = ONE webServer boot for the whole e2e layer (smoke + visual + responsive

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:958: # + shell). The old four-`pnpm test:X` split bought nothing and quadrupled server boots. Each spec is

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:959: # self-contained (its own page.route abort for the live transport, DR-071), so determinism is

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:960: # unchanged; `workers:1` + `fullyParallel:false` (playwright.config) already serialize everything.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:961: # Fail-closed gates on the SPEC FILE + config the combined run actually discovers (testDir:"./e2e"),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:962: # NOT the npm scripts — a run finds specs by filesystem, so a deleted spec must RED here (a present

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:963: # script with an absent spec would otherwise pass as "no matching tests"). The `test:*` npm scripts

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:964: # stay for manual/blessing use, but they are no longer the gate's contract.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:965: # NOTE: this does NOT fix the `.next`/process-contention ERR_CONNECTION_REFUSED a co-located dev /

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:966: # always-on server causes (it dies mid-invocation; DR-075 lessons) — that fix is worktree isolation,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:967: # tracked separately. This only removes the inter-invocation churn (DR-076).

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:968: gate_playwright() {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:969:   [ -f playwright.config.ts ] || { echo "✗ Browser gates missing: no playwright.config.ts (DR-055)."; return 1; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:970:   [ -f e2e/smoke.spec.ts ]      || { echo "✗ Preview Smoke Gate missing (DR-055): add e2e/smoke.spec.ts — every route must render clean in a browser."; return 1; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:971:   [ -f e2e/visual.spec.ts ]     || { echo "✗ Visual-Fidelity Gate missing (DR-056): add e2e/visual.spec.ts — diff each route against its blessed baseline."; return 1; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:972:   [ -f e2e/responsive.spec.ts ] || { echo "✗ Responsive Gate missing (DR-074): add e2e/responsive.spec.ts + e2e/_responsive-helper.ts + e2e/_target.ts."; return 1; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:973:   [ -f e2e/shell.spec.ts ]      || { echo "✗ Shell-Presence Gate missing (DR-075): add e2e/shell.spec.ts + e2e/shell.ts — assert the app shell / global nav vs the prototype."; return 1; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:974:   [ -f e2e/headers.spec.ts ]    || { echo "✗ Header-Scan Gate missing (web-security.md): add e2e/headers.spec.ts — security headers, tiered by deploy_target."; return 1; }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:975:   # ADVISORY token-fidelity check (F4): e2e/tokens.spec.ts is auto-discovered by the FULL run below

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:976:   # (NOT by the --since gate). It flags hardcoded colors that never came from a design token and reds

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:977:   # ONLY on a GROSS violation (>20 distinct hardcoded colors on a route) — a punch-list, not a fidelity

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:978:   # block. It is deliberately NOT in the fail-closed presence list above: a missing tokens.spec.ts is a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:979:   # skipped advisory, never a RED (unlike the gates that CAN block). It runs at close-out, not per-FRD.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:980:   # DR-106 scope: the per-FRD gate (--since) runs smoke + shell only — the browser layer of the

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:981:   # DR-072 BLOCKING lenses (routes render clean + the app shell is present). Visual + responsive

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:982:   # stay in the FULL run (close-out / Visual QA): fine fidelity is advisory at the gate and may

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:983:   # never block, so paying the whole serialized suite per FRD bought nothing but wall-clock.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:984:   # DR-143: a project's e2e/parallel-safe.json splits one FULL invocation into ordered projects (one server boot):

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:985:   # the listed specs on several workers, then desktop and mobile serially. No file, same single run.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:986:   # A project's e2e/prod-server.mjs serves the FULL run from one production build instead of next dev.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:987:   if [ -z "$SINCE" ] && [ -f e2e/prod-server.mjs ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:988:     node e2e/prod-server.mjs build || return $?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:989:     export PANDACORP_E2E_SERVER=prod

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:990:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:991:   if [ -n "$SINCE" ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:992:     pnpm exec playwright test e2e/smoke.spec.ts e2e/shell.spec.ts

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:993:   elif [ -f e2e/parallel-safe.json ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:994:     PANDACORP_E2E_TIER=combined pnpm exec playwright test e2e/

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:995:   else

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:996:     pnpm exec playwright test e2e/

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:997:   fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:998: }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:999: # Same `set -e` hazard as vitest above: `|| PLAYWRIGHT_RC=$?`, not a bare call.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1000: # WP-08: the browser layer is NOT file-scopable (`--files` does not touch it) — it is only ever

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1001: # skipped wholesale by an `--only` that does not name it.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1002: if gate_selected playwright && [ "$AFFECTED_SKIP" -eq 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1003: PLAYWRIGHT_RC=0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1004: run_gate playwright playwright gate_playwright || PLAYWRIGHT_RC=$?

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1005: if [ "$PLAYWRIGHT_RC" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1006:   write_gate_report "$PLAYWRIGHT_RC"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1007:   exit "$PLAYWRIGHT_RC"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1008: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1009: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1010: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1011: # --- Bless-provenance advisory (DR-080) — non-blocking -------------------------

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1012: # A blessed visual baseline with no recorded ORACLE (the prototype path/shard + sign-off + a

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1013: # `prototype_blessed_at` SHA in the FRD's fdd.md) is a self-reference — the trap that let a menu-less

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1014: # baseline ship green (E6). ADVISORY: it warns, never fails (so it can't red-lock baselines blessed

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1015: # before this rule). The deterministic block is the reviewer's bless step (DR-080) + the gate canary.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1016: if ls e2e/visual.spec.ts-snapshots/*.png >/dev/null 2>&1 && ! grep -rqs "prototype_blessed_at" docs/frds 2>/dev/null; then

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1017:   echo "⚠ DR-080: blessed visual baselines exist but no fdd.md records a 'prototype_blessed_at' provenance line — the baseline's independent oracle is unrecorded (advisory)."

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1018: fi

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1019: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1020: write_gate_report 0

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh:1021: exit 0


### /Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1: #!/usr/bin/env bash

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:2: # Canonical MAXIMUM fail-closed gate (DR-059) for the Next.js stack.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:3: # Installed VERBATIM into projects by /pandacorp:architecture; re-synced + conformance-checked

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:4: # (drift => regenerate/fail) by /pandacorp:upgrade. Do NOT hand-edit per project — drift is RED.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:5: # Every gate is fail-closed: a missing harness (smoke/visual) is RED, never a skip (DR-019/055/056).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:6: # This script is ALWAYS strict — it never softens itself. The build engine drives it (`--since`

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:7: # per FRD, full at close-out). The PHASE-AWARENESS lives in the Stop hook (verify-before-stop.sh,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:8: # DR-063): that wrapper skips THIS gate while a build is active so it doesn't block every turn;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:9: # the engine keeps running this strictly. So: hook = phase-aware; verify.sh = always strict.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:10: #

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:11: # WP-05 additions — SCOPE and DATA only, nothing here ever softens what counts as red:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:12: #   `--report-all`: the 9 cheap sub-gates below (structure guard through madge) accumulate ALL

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:13: #   their failures before aborting, instead of stopping at the very first one. vitest and

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:14: #   Playwright fail fast by default; --no-bail (or PANDACORP_VERIFY_NO_BAIL=1) accumulates failures.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:15: #   Without the flag, the cheap gates keep today's exact fail-fast behavior.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:16: #   ALWAYS (every run, every mode, green or red, with or without `--report-all`) writes

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:17: #   `.pandacorp/run/gate-report.json` — a machine-readable verdict for Mission Control or any other

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:18: #   reader, so nobody has to scrape this script's human stdout. LESSON-0155: a stale report from a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:19: #   previous run must never be read as this run's verdict, so it is deleted before anything runs.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:20: #

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:21: # WP-08 additions — SCOPE only, nothing here ever softens what counts as red:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:22: #   `--only=<subgate>[,<subgate>...]`: run ONLY the named sub-gates (names exactly as they appear in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:23: #   the gate report: structure-guard data-layer api-error-contract doc-lint residual-ambiguity biome

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:24: #   tsc knip madge vitest playwright). An unknown name is FAIL-CLOSED — non-zero exit before any gate

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:25: #   runs, never a silent fallback to the full suite.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:26: #   `--files=<path>[,<path>...]`: narrow the two file-addressable gates — biome runs on exactly those

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:27: #   paths, and vitest switches to `vitest related <paths>` (the tests those files affect). tsc, knip

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:28: #   and madge stay WHOLE-PROJECT by design: they are whole-program analyses whose whole value is

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:29: #   catching what a scoped run cannot see, and they are the cheap ones anyway (~2.5s/1.6s/3.1s).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:30: #   EITHER flag stamps the report `"scope":"partial"`. That label is load-bearing: the build engine

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:31: #   REFUSES to promote a work order to VERIFIED or advance `last_green_sha` on a partial report, so a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:32: #   scoped run can never be mistaken for a full green by a later reader. A scoped run writes nothing

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:33: #   but the report (which, being partial, is self-describing), so it leaves no other artifact behind.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:34: #

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:35: # DR-146 additions — SCOPE, ORDER and PROVENANCE only, nothing here ever softens what counts as red:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:36: #   `--affected`: iteration only; omit browser ONLY for proven data-only diffs (queries/worker).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:37: #   UI, unknown paths or uncertain Git keep the browser. Always partial, never certification.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:38: #   `--light`: the Stop hook's per-turn gate — every cheap static sub-gate (structure guard through

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:39: #   madge, whole project), NEVER Playwright and NEVER the whole vitest suite. Exclusive with `--only`.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:40: #   `--tests=<test-file>[,...]`: vitest runs EXACTLY these test files (`vitest run <files>`), nothing

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:41: #   inferred. With `--light` it adds vitest to the light set. Both flags stamp `"scope":"partial"`.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:42: #   Vitest always runs in a shuffled order with an explicit seed, printed before the run and recorded

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:43: #   as `vitest_seed` in gate-report.json; `PANDACORP_VITEST_SEED=<n>` replays that exact order.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:44: #   Certified tree: a FULL run (no --since/--only/--files/--light/--tests) that exits 0 on a tree

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:45: #   that was clean when it started records that tree via `.pandacorp/green-stamp.sh`; every red exit

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:46: #   drops the stamp. merge-queue.sh and the Stop hook trust ONLY that stamp to skip a re-run.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:47: set -euo pipefail

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:48: shopt -s inherit_errexit 2>/dev/null || true  # bash 4.4+; no-op on macOS' bash 3.2 (avoids "invalid shell option")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:49: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:50: # DR-158: one verification owner per physical checkout, BEFORE touching reports/stamps/builds.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:51: # The kernel releases this advisory lock after the owner and its children exit, including crashes.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:52: # Keep the inode: unlinking a lock file would let a third owner lock a different inode.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:53: if [ "${PANDACORP_VERIFY_OWNER_PID:-}" != "$$" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:54:   exec python3 - "$0" "$@" <<'OWNERPY'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:55: import fcntl

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:56: import os

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:57: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:58: import sys

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:59: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:60: run = Path('.pandacorp/run')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:61: run.mkdir(parents=True, exist_ok=True)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:62: lock = os.open(run / 'verify.lock', os.O_RDWR | os.O_CREAT, 0o600)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:63: try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:64:     fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:65: except BlockingIOError:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:66:     owner = os.read(lock, 4096).decode(errors='replace').strip() or 'initializing'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:67:     print(f'verify: verification owner busy in {Path.cwd()}: {owner}; wait for it to exit, then retry (exit 75; no project verdict)', file=sys.stderr)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:68:     sys.exit(75)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:69: os.ftruncate(lock, 0)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:70: os.write(lock, f'pid={os.getpid()} checkout={Path.cwd()}'.encode())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:71: os.dup2(lock, 9, inheritable=True)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:72: if lock != 9:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:73:     os.close(lock)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:74: os.environ['PANDACORP_VERIFY_OWNER_PID'] = str(os.getpid())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:75: os.execvp('bash', ['bash', *sys.argv[1:]])

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:76: OWNERPY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:77: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:78: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:79: # --- Optional scope: `verify.sh --since <sha>` (the fast per-FRD gate) ----------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:80: # Runs only the vitest tests CHANGED since <sha>; biome/tsc/knip/madge stay global

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:81: # (fast enough, and they scale). ALSO scopes the browser layer (DR-106): in --since mode

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:82: # only smoke + shell run (correctness + gross structure — exactly what the DR-072 gate may

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:83: # block on); visual + responsive belong to the FULL unscoped suite at close-out + the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:84: # end-of-build Visual QA pass (fidelity is ADVISORY at the per-FRD gate, never a block).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:85: # Before DR-106 every FRD gate ran the WHOLE serialized e2e suite (workers:1) — the single

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:86: # biggest wall-clock cost of a build (11 gates x full Playwright in the personal-page-v2 run).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:87: AFFECTED=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:88: AFFECTED_BASE="origin/main"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:89: for _affected_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:90:   [ "$_affected_arg" != "--affected" ] || AFFECTED=1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:91: done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:92: SINCE=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:93: if [ "${1:-}" = "--since" ] && [ -n "${2:-}" ]; then SINCE="$2"; fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:94: # In affected mode --since is the diff base (any argument position); all OTHER gates stay full.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:95: # Without --affected, preserve the legacy positional --since behavior and command lines exactly.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:96: if [ "$AFFECTED" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:97:   _affected_expect=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:98:   for _affected_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:99:     if [ "$_affected_expect" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:100:       AFFECTED_BASE="$_affected_arg"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:101:       _affected_expect=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:102:     elif [ "$_affected_arg" = "--since" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:103:       AFFECTED_BASE=""  # Missing/invalid ref makes the classifier retain the full browser layer.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:104:       _affected_expect=1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:105:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:106:   done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:107:   SINCE=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:108: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:109: # D11: --since is ONLY recognised at position $1 (above) — anywhere else it silently no-ops

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:110: # (REV2-H characterised this; the engine's own contract already never emits it elsewhere). Warn so a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:111: # caller sees why the run went unscoped instead of just noticing scope isn't "since" later.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:112: if [ "$AFFECTED" -eq 0 ] && [ "${1:-}" != "--since" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:113:   for _wp11_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:114:     if [ "$_wp11_arg" = "--since" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:115:       echo "⚠ --since ignored: it must be the first argument"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:116:       echo "⚠ --since ignored: it must be the first argument"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:117:       break

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:118:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:119:   done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:120: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:121: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:122: # --- Gate-report scaffolding (WP-05) — the stale-report DELETE runs before ANY branch below,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:123: # including --canary (REV-C/LESSON-0155): a report left by a PREVIOUS verify run must never survive

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:124: # to be misread as a canary/current run's verdict. Only the mkdir/rm belong here — the rest of the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:125: # report machinery (timestamps, fragments dir, the trap) stays below, after the --canary early exit,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:126: # since --canary never generates a gate-report.json of its own (see that block's comment).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:127: REPORT_DIR=".pandacorp/run"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:128: REPORT_FILE="$REPORT_DIR/gate-report.json"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:129: mkdir -p "$REPORT_DIR"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:130: rm -f "$REPORT_FILE"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:131: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:132: # DR-159: inventory drift is advisory; selection remains serial + both platforms.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:133: # Opt in independently on each axis by keeping its project-owned inventory.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:134: python3 - <<'INVENTORYPY'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:135: import json

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:136: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:137: import re

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:138: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:139: root = Path('e2e')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:140: specs = sorted(p.relative_to(root).as_posix() for p in root.rglob('*')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:141:                if p.is_file() and re.search(r'\.(spec|test)\.[cm]?[jt]sx?$', p.name))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:142: def load(name):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:143:     return json.loads((root / name).read_text())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:144: def warn(message):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:145:     print('WARN DR-159: ' + message)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:146: if (root / 'parallel-safe.json').exists():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:147:     try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:148:         safe = load('parallel-safe.json')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:149:         serial = load('serial-specs.json') if (root / 'serial-specs.json').exists() else {}

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:150:         if (not isinstance(safe, list) or any(not isinstance(x, str) for x in safe)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:151:                 or not isinstance(serial, dict)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:152:                 or any(not isinstance(v, str) or not v.strip() for v in serial.values())):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:153:             raise ValueError('expected parallel array and serial {spec: reason} object')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:154:         missing = sorted(set(specs) - set(safe) - set(serial))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:155:         if missing:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:156:             warn('unclassified parallel/serial specs (kept serial):\n  ' + '\n  '.join(missing)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:157:                  + '\n  Review transitive writes; update parallel-safe.json or serial-specs.json with reasons.')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:158:         overlap = sorted(set(safe) & set(serial))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:159:         if overlap:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:160:             warn('conflicting parallel/serial classifications: ' + ', '.join(overlap))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:161:         stale = sorted((set(safe) | set(serial)) - set(specs))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:162:         if stale:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:163:             warn('stale parallel/serial entries: ' + ', '.join(stale))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:164:     except (OSError, ValueError, TypeError) as error:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:165:         warn('cannot audit parallel/serial inventory: ' + str(error))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:166: if (root / 'mobile-specs.json').exists():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:167:     try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:168:         mobile = load('mobile-specs.json')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:169:         included, excluded = mobile['include'], mobile['desktopOnly']

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:170:         if (not isinstance(included, list) or not isinstance(excluded, list)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:171:                 or any(not isinstance(x, str) for x in included + excluded)):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:172:             raise ValueError('expected include/desktopOnly string arrays')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:173:         missing = sorted(set(specs) - set(included) - set(excluded))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:174:         if missing:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:175:             warn('unclassified mobile specs (kept on both platforms):\n  ' + '\n  '.join(missing)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:176:                  + '\n  Update mobile-specs.json and its review document with viewport evidence.')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:177:     except (OSError, ValueError, TypeError, KeyError) as error:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:178:         warn('cannot audit mobile inventory: ' + str(error))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:179: INVENTORYPY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:180: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:181: # --- Canary mode (DR-079): prove each fail-closed gate STILL goes RED on a broken input ---------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:182: # `verify.sh --canary` runs the project's deliberately-broken fixtures through the gates and asserts

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:183: # each gate REJECTS its fixture — a gate that stays GREEN on a broken input has rotted (a renamed

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:184: # selector, a disabled rule, a swallowed exit code) and THAT is a RED. Invoked by /pandacorp:upgrade,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:185: # never on a normal build. Vacuous until the fixtures + runner are installed (like doc-lint, DR-077),

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:186: # so it can never red-lock a normal run. UNTOUCHED by WP-05: canary.sh is its own standalone runner

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:187: # (it mirrors these checks directly against generated fixtures) — this script hands off to it before

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:188: # any of the report-all/gate-report GENERATION machinery below even runs, so `--canary` never produces

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:189: # a gate-report.json from THIS script (the "canary" value in the report's `scope` enum is reserved for

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:190: # canary.sh's own future use, not emitted here) — but the stale-report DELETE above already ran, so a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:191: # canary run never leaves a PRIOR run's report readable as if it were canary's own verdict.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:192: if [ "${1:-}" = "--canary" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:193:   if [ -f .pandacorp/canary.sh ]; then exec bash .pandacorp/canary.sh; fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:194:   echo "✓ canary: no .pandacorp/canary.sh installed yet (DR-079 — vacuous pass)"; exit 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:195: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:196: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:197: # --- Report-all mode (WP-05) ----------------------------------------------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:198: # Detected ANYWHERE in argv (order-independent), so it composes with `--since` in either order —

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:199: # `--since`'s own detection above is untouched, and this scan never changes what it resolves to.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:200: # WP-08 rides the SAME scan for `--only` / `--files` (both the `--only=x,y` and the `--only x,y`

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:201: # spelling, so a plausible invocation can never be silently ignored and degrade to a full run).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:202: NO_BAIL="${PANDACORP_VERIFY_NO_BAIL:-0}"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:203: REPORT_ALL=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:204: ONLY_GATES=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:205: SCOPE_FILES=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:206: LIGHT=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:207: SCOPE_TESTS=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:208: _wp08_expect=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:209: for _wp05_arg in "$@"; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:210:   if [ -n "$_wp08_expect" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:211:     case "$_wp08_expect" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:212:       only)  ONLY_GATES="$_wp05_arg" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:213:       files) SCOPE_FILES="$_wp05_arg" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:214:       tests) SCOPE_TESTS="$_wp05_arg" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:215:     esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:216:     _wp08_expect=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:217:     continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:218:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:219:   case "$_wp05_arg" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:220:     --report-all) REPORT_ALL=1 ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:221:     --no-bail) NO_BAIL=1 ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:222:     --affected) AFFECTED=1 ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:223:     --light)      LIGHT=1 ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:224:     --only=*)     ONLY_GATES="${_wp05_arg#--only=}" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:225:     --files=*)    SCOPE_FILES="${_wp05_arg#--files=}" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:226:     --tests=*)    SCOPE_TESTS="${_wp05_arg#--tests=}" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:227:     --only)       _wp08_expect="only" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:228:     --files)      _wp08_expect="files" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:229:     --tests)      _wp08_expect="tests" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:230:   esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:231: done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:232: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:233: # The `--files` list as a real argv array (bash 3.2 compatible). Kept EMPTY when the flag is absent,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:234: # which is what every "unscoped behaves exactly as before" branch below tests against.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:235: SCOPE_FILES_ARR=()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:236: if [ -n "$SCOPE_FILES" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:237:   _wp08_oldifs="$IFS"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:238:   IFS=','

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:239:   for _wp08_f in $SCOPE_FILES; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:240:     if [ -n "$_wp08_f" ]; then SCOPE_FILES_ARR+=("$_wp08_f"); fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:241:   done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:242:   IFS="$_wp08_oldifs"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:243: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:244: SCOPE_TESTS_ARR=()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:245: if [ -n "$SCOPE_TESTS" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:246:   _wp08_oldifs="$IFS"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:247:   IFS=','

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:248:   for _wp08_f in $SCOPE_TESTS; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:249:     if [ -n "$_wp08_f" ]; then SCOPE_TESTS_ARR+=("$_wp08_f"); fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:250:   done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:251:   IFS="$_wp08_oldifs"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:252: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:253: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:254: # The canonical sub-gate names — the SAME strings the gate report's `name` field carries, so the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:255: # engine can feed a report's failing sub-gate straight back in as `--only=<name>`.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:256: KNOWN_GATES="live-data-asserts structure-guard data-layer api-error-contract doc-lint residual-ambiguity biome tsc knip madge vitest playwright"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:257: # DR-146 `--light`: derived from KNOWN_GATES (one list, never a second hand-kept copy) — every cheap

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:258: # gate, vitest only for an explicit `--tests` list, never Playwright. `--only` would make the meaning

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:259: # of the run ambiguous, so the combination is refused below (fail-closed), never resolved silently.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:260: LIGHT_CONFLICT=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:261: if [ "$LIGHT" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:262:   if [ -n "$ONLY_GATES" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:263:     LIGHT_CONFLICT=1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:264:   else

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:265:     for _dr146_g in $KNOWN_GATES; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:266:       case "$_dr146_g" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:267:         playwright) ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:268:         vitest) [ "${#SCOPE_TESTS_ARR[@]}" -gt 0 ] && ONLY_GATES="$ONLY_GATES,vitest" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:269:         *) ONLY_GATES="$ONLY_GATES,$_dr146_g" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:270:       esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:271:     done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:272:     ONLY_GATES="${ONLY_GATES#,}"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:273:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:274: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:275: gate_selected() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:276:   if [ -z "$ONLY_GATES" ]; then return 0; fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:277:   case ",$ONLY_GATES," in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:278:     *",$1,"*) return 0 ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:279:   esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:280:   return 1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:281: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:282: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:283: # --- Gate-report scaffolding (WP-05) — ALWAYS-written `.pandacorp/run/gate-report.json` -------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:284: # `.pandacorp/run/` is the existing gitignored runtime-scratch convention (see .pandacorp/run/

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:285: # lessons.md) — never committed, never conformance-checked, purely machine state for this run.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:286: # REPORT_DIR/REPORT_FILE + the stale-report delete moved ABOVE the --canary branch (REV-C); only the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:287: # timestamp/scope/fragments-dir setup for actually WRITING a fresh report lives here.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:288: GATE_RUN_AT=$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:289: GATE_SCOPE="full"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:290: [ -n "$SINCE" ] && GATE_SCOPE="since"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:291: # WP-08: `partial` outranks `since`. It is the WEAKEST claim this script can make about a run, and the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:292: # engine's certification cage keys on exactly this value — so when both apply, report the weaker one.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:293: [ -n "$ONLY_GATES$SCOPE_FILES$SCOPE_TESTS" ] && GATE_SCOPE="partial"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:294: [ "$LIGHT" -eq 1 ] && GATE_SCOPE="partial"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:295: [ "$AFFECTED" -eq 1 ] && GATE_SCOPE="partial"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:296: # DR-158: the ONLY canonical path policy. fnmatchcase globs are repository-relative;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:297: # '*' includes '/'. UI patterns win; everything outside DATA_ONLY is unknown => browser runs.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:298: # A project may ADD UI globs in .pandacorp/verify-affected.json (never overwrite on upgrade).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:299: # Git failures, invalid config and unusual paths all retain the browser gate.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:300: # Nested projects normalize repo paths; a change outside the project is unknown, never ignored.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:301: AFFECTED_SKIP=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:302: if [ "$AFFECTED" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:303:   if python3 - "$AFFECTED_BASE" <<'PY'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:304: import fnmatch

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:305: import json

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:306: import os

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:307: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:308: import subprocess

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:309: import sys

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:310: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:311: UI = (

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:312:     'src/app/*', 'src/components/*', 'src/hooks/*', 'src/styles/*', 'src/tokens/*',

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:313:     'src/i18n/*', 'src/messages/*', 'messages/*', 'styles/*', 'tokens/*',

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:314:     'e2e/*', 'playwright.config.*', 'next.config.*', 'public/*',

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:315:     'package.json', '*lock*', 'docs/design/*', 'prisma/*',

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:316:     '*.tsx', '*.jsx', '*.css', '*.scss', '*.sass', '*.less', '*.svg',

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:317: )

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:318: DATA_ONLY = ('src/queries/*.ts', 'src/worker/*.ts')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:319: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:320: def git(*args, input=None):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:321:     return subprocess.check_output(['git', *args], input=input, stderr=subprocess.DEVNULL)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:322: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:323: def matches(path, patterns):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:324:     return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:325: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:326: try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:327:     prefix = os.fsdecode(git('rev-parse', '--show-prefix')).strip()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:328:     repo = os.fsdecode(git('rev-parse', '--show-toplevel')).strip()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:329:     # Presence is enough: fsmonitor and clean filters can hide physical UI edits.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:330:     # Exit 1 means absent; any other config error keeps the full suite.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:331:     for pattern in (r'^core\.fsmonitor$', r'^filter\..*\.clean$'):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:332:         result = subprocess.run(['git', 'config', '--get-regexp', pattern],

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:333:                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:334:         if result.returncode != 1:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:335:             raise ValueError('configured monitor/filter or config query failure')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:336:     # Ask Git to resolve attributes (including nested .gitattributes and info/attributes)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:337:     # for every tracked/non-ignored untracked file, regardless of its apparent diff.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:338:     files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:339:     attrs = git('check-attr', '--all', '-z', '--stdin', input=files).split(b'\0')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:340:     if attrs[-1] != b'' or (len(attrs) - 1) % 3:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:341:         raise ValueError('invalid attribute response')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:342:     if b'filter' in attrs[1::3]:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:343:         raise ValueError('filter attribute makes working-tree changes uncertain')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:344:     # Diff/status honor these index flags and can silently hide local UI edits.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:345:     # -v lowercases assume-unchanged entries; S/s marks skip-worktree. Any such

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:346:     # entry invalidates path selection, even if its apparent path is data-only.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:347:     for entry in git('-C', repo, 'ls-files', '-v', '-z').split(b'\0'):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:348:         if entry and (entry[:1].islower() or entry[:1] == b'S'):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:349:             raise ValueError('index flags can hide working-tree changes')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:350:     ui = list(UI)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:351:     config = Path('.pandacorp/verify-affected.json')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:352:     if config.is_symlink():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:353:         raise ValueError('symlinked config')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:354:     if config.exists():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:355:         extra = json.loads(config.read_text())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:356:         if (not isinstance(extra, dict) or set(extra) != {'ui'}

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:357:                 or not isinstance(extra['ui'], list)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:358:                 or any(not isinstance(p, str) or not p or p.startswith(('/', '-'))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:359:                        or '..' in p.split('/') for p in extra['ui'])):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:360:             raise ValueError('expected {"ui": ["repo-relative glob", ...]}')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:361:         ui.extend(extra['ui'])

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:362:     base = git('rev-parse', '--verify', '--end-of-options', sys.argv[1] + '^{commit}').strip().decode('ascii')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:363:     anchor = git('merge-base', base, 'HEAD').strip().decode('ascii')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:364:     # A UI symlink can expose ANY data path (including newly added routes). Avoid

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:365:     # dependency/alias resolution entirely: any tracked symlink keeps the full suite.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:366:     # Inspect BOTH trees plus the index so deleted, staged and dangling links count.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:367:     # Gitlinks (submodules) can also hide arbitrary nested UI under a data-only path.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:368:     entries = git('ls-tree', '-r', '-z', '--full-tree', anchor)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:369:     entries += git('ls-tree', '-r', '-z', '--full-tree', 'HEAD')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:370:     entries = b'\0'.join(entry for entry in entries.split(b'\0')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:371:                          if b'\t' in entry and os.fsdecode(entry.split(b'\t', 1)[1]).startswith(prefix))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:372:     entries += b'\0' + git('ls-files', '--stage', '-z')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:373:     if any(entry.startswith((b'120000 ', b'160000 ')) for entry in entries.split(b'\0')):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:374:         raise ValueError('tracked symlink/gitlink makes UI reachability uncertain')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:375:     # --no-renames includes BOTH sides of renames. Union each Git layer separately:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:376:     # a staged UI change restored only in the working tree must not cancel out of the diff.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:377:     diff_options = ('--no-ext-diff', '--no-renames', '--ignore-submodules=none', '--name-only', '-z')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:378:     paths = git('diff', *diff_options, anchor, 'HEAD', '--')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:379:     paths += git('diff', *diff_options, '--cached', 'HEAD', '--')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:380:     paths += git('diff', *diff_options, '--')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:381:     paths += git('-C', repo, 'ls-files', '--others', '--exclude-standard', '-z')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:382:     for raw in paths.split(b'\0'):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:383:         if not raw:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:384:             continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:385:         path = os.fsdecode(raw)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:386:         if not path.startswith(prefix):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:387:             raise ValueError('changed path outside nested project')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:388:         path = path[len(prefix):]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:389:         if (any(p.is_symlink() for p in (Path(path), *Path(path).parents))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:390:                 or matches(path, ui) or not matches(path, DATA_ONLY)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:391:                 or any(part in ('.', '..') for part in path.split('/'))):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:392:             raise ValueError('UI or unknown path')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:393: except (OSError, ValueError, subprocess.SubprocessError):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:394:     sys.exit(1)  # No successful classification => run the original full browser layer.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:395: sys.exit(0)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:396: PY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:397:   then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:398:     AFFECTED_SKIP=1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:399:     GATE_SCOPE="partial"  # Reuse the engine's unconditional no-VERIFIED/no-last_green cage.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:400:     echo "↷ Playwright omitted by diff against $AFFECTED_BASE (scope: partial; not certification)"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:401:   else

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:402:     echo "→ --affected: UI/unknown path or classification unavailable; retaining full browser gate"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:403:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:404: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:405: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:406: # BL-0147: stamp the commit this run verified so a LATER reader (the build engine's close-out/

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:407: # notify-end) can prove a report was produced for the EXACT commit it is about to re-verify, instead

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:408: # of trusting scope+green alone (which say nothing about WHICH commit). Best-effort — a fixture/non-

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:409: # git checkout (or a detached/rebasing tree mid-op) leaves it empty, never fails the gate over it.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:410: GATE_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:411: # DR-146: the tree a FULL run is about to judge, captured BEFORE any gate and only when it is clean

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:412: # (green-stamp.sh owns what "clean" means). Empty = this run can never certify a tree.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:413: STAMP_START_TREE=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:414: if [ "$GATE_SCOPE" = "full" ] && [ -f .pandacorp/green-stamp.sh ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:415:   STAMP_START_TREE=$(bash .pandacorp/green-stamp.sh start 2>/dev/null || true)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:416: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:417: # DR-146: vitest order is always shuffled with an explicit seed so a red caused by test order can be

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:418: # replayed exactly. A malformed replay seed is an invocation error, never silently replaced.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:419: VITEST_SEED="${PANDACORP_VITEST_SEED:-}"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:420: VITEST_SEED_USED=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:421: if [ -z "$VITEST_SEED" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:422:   VITEST_SEED=$(( ((RANDOM << 15) | RANDOM) + 1 ))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:423: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:424: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:425: GATE_FRAGMENTS_DIR=$(mktemp -d)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:426: : > "$GATE_FRAGMENTS_DIR/fragments.jsonl"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:427: cleanup_gate_report() { rm -rf "$GATE_FRAGMENTS_DIR"; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:428: trap cleanup_gate_report EXIT

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:429: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:430: # Portable millisecond clock. GNU `date +%s%N` gives nanoseconds; BSD `date` on older macOS does

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:431: # NOT expand `%N` (it prints a literal "N"), so detect that and fall back to python3, then perl,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:432: # then whole-second precision as a last resort. (Verified: this machine's BSD `date` DOES expand

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:433: # %N — but the fleet includes older macOS where it doesn't, so the fallback chain stays.)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:434: now_ms() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:435:   local raw

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:436:   raw=$(date +%s%N 2>/dev/null || true)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:437:   case "$raw" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:438:     ''|*[!0-9]*) raw="" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:439:   esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:440:   if [ -n "$raw" ] && [ "${#raw}" -ge 19 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:441:     echo $(( raw / 1000000 ))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:442:     return

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:443:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:444:   if command -v python3 >/dev/null 2>&1; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:445:     python3 -c 'import time; print(int(time.time() * 1000))'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:446:     return

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:447:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:448:   if command -v perl >/dev/null 2>&1; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:449:     perl -MTime::HiRes=time -e 'printf("%d\n", time() * 1000)'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:450:     return

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:451:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:452:   echo $(( $(date +%s) * 1000 ))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:453: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:454: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:455: # Parses one gate's captured output into `failures[]` with a minimal, tolerant parser matched to

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:456: # the tool's own output shape; NEVER emits an empty array on a red exit (falls back to the last 20

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:457: # captured lines as a single {"msg": ...} entry). Reads the log FILE (not argv) so failure text

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:458: # with quotes/backticks/`$`/newlines can never break shell quoting.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:459: record_gate_result() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:460:   local name="$1" parser="$2" rc="$3" dur_ms="$4" log="$5"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:461:   python3 - "$name" "$parser" "$rc" "$dur_ms" "$log" <<'PY' >> "$GATE_FRAGMENTS_DIR/fragments.jsonl"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:462: import json

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:463: import re

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:464: import sys

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:465: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:466: name, parser, rc, dur_ms, log_path = sys.argv[1:6]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:467: rc = int(rc)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:468: dur_ms = int(dur_ms)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:469: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:470: try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:471:     with open(log_path, "r", errors="replace") as fh:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:472:         text = fh.read()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:473: except OSError:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:474:     text = ""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:475: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:476: lines = text.splitlines()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:477: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:478: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:479: def tail_fallback():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:480:     tail = lines[-20:] if lines else []

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:481:     msg = "\n".join(tail).strip() or "(no output captured)"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:482:     return [{"msg": msg}]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:483: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:484: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:485: failures = []

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:486: if rc != 0:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:487:     if parser == "tsc":

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:488:         # src/foo.ts(12,5): error TS2322: Type '"x"' is not assignable to type 'number'.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:489:         pat = re.compile(r"^(?P<file>[^\s(][^():]*)\((?P<line>\d+),\d+\): error (?P<code>TS\d+): (?P<msg>.*)$")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:490:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:491:             m = pat.match(ln.strip())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:492:             if m:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:493:                 failures.append({

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:494:                     "file": m.group("file"),

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:495:                     "line": int(m.group("line")),

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:496:                     "code": m.group("code"),

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:497:                     "msg": m.group("msg"),

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:498:                 })

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:499:     elif parser == "biome":

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:500:         # src/foo.ts:12:3 lint/suspicious/noExplicitAny  ────  Unexpected any. Specify a different type.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:501:         pat = re.compile(r"^(?P<file>[\w./-]+):(?P<line>\d+):(?P<col>\d+)\s+(?P<msg>.*)$")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:502:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:503:             m = pat.match(ln.strip())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:504:             if m:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:505:                 failures.append({"file": m.group("file"), "line": int(m.group("line")), "msg": m.group("msg")})

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:506:     elif parser == "vitest":

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:507:         # " FAIL  src/foo/_tests/bar.test.ts > suite > test name" (also matches the "✗"/"×" markers)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:508:         pat = re.compile(r"^\s*(?:FAIL|✗|×)\s+(?P<file>\S+\.test\.(?:ts|tsx|js|jsx))\b\s*(?P<msg>.*)$")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:509:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:510:             m = pat.match(ln)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:511:             if m:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:512:                 failures.append({"file": m.group("file"), "msg": (m.group("msg") or "").strip() or "failed"})

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:513:     elif parser == "pathlist":

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:514:         # knip/madge/the internal (structure/data-layer/API/doc-lint/residual-ambiguity) gates: each

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:515:         # relevant line carries a source/doc path, possibly alongside other text (e.g. madge's

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:516:         # "1) src/a.ts > src/b.ts > src/a.ts" cycle chains) — extract the first path per line.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:517:         path_re = re.compile(r"[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md)")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:518:         for ln in lines:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:519:             s = ln.strip()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:520:             if not s:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:521:                 continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:522:             m = path_re.search(s)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:523:             if m:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:524:                 failures.append({"file": m.group(0), "msg": s})

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:525:     # `playwright` (and anything that matched nothing above) falls through to the generic fallback.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:526:     if not failures:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:527:         failures = tail_fallback()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:528: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:529: entry = {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:530:     "name": name,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:531:     "exit": rc,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:532:     "duration_ms": dur_ms,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:533:     "failures": failures,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:534: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:535: print(json.dumps(entry))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:536: PY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:537: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:538: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:539: # Runs one gate: `run_gate <name> <parser> <command...>`. Times it, streams its output live (the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:540: # operator loses nothing) while also capturing it for parsing, and records one report fragment.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:541: # Captures the COMMAND's own exit code via PIPESTATUS[0] (LESSON-0078: `$?` after a pipe reads

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:542: # `tee`'s exit, not the command's) — `set +e` around the pipeline so `set -e` can't abort before

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:543: # that capture happens.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:544: run_gate() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:545:   local name="$1" parser="$2"; shift 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:546:   local log start_ms end_ms dur_ms rc

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:547:   log="$GATE_FRAGMENTS_DIR/log-$name.txt"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:548:   start_ms=$(now_ms)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:549:   set +e

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:550:   "$@" 2>&1 | tee "$log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:551:   rc="${PIPESTATUS[0]}"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:552:   set -e

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:553:   end_ms=$(now_ms)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:554:   dur_ms=$((end_ms - start_ms))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:555:   record_gate_result "$name" "$parser" "$rc" "$dur_ms" "$log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:556:   return "$rc"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:557: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:558: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:559: # Assembles the final report from every fragment recorded so far and writes it — called at EVERY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:560: # exit point (success or any abort) so the file always reflects this run, never a stale one.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:561: write_gate_report() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:562:   local green_exit="$1" green="false"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:563:   [ "$green_exit" -eq 0 ] && green="true"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:564:   # BL-0179: stamp the `--since` base sha (the anchor this scoped run certified FROM) as `since` —

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:565:   # provenance for a reader of the report. The engine's close-out reuse no longer accepts a since-scoped

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:566:   # report (canary E2 finding 7: last_green_sha is itself published from since-scoped runs, so a since

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:567:   # report never adds up to a full one). Empty (never written) on a `full`/`partial` run.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:568:   python3 - "$GATE_RUN_AT" "$GATE_SCOPE" "$green" "$GATE_SHA" "$SINCE" "$GATE_FRAGMENTS_DIR/fragments.jsonl" "$REPORT_FILE" "$VITEST_SEED_USED" "$AFFECTED_SKIP" "$AFFECTED_BASE" <<'PY'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:569: import json

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:570: import sys

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:571: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:572: at, scope, green_str, sha, since, frag_path, out_path, vitest_seed = sys.argv[1:9]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:573: subgates = []

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:574: with open(frag_path, "r") as fh:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:575:     for line in fh:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:576:         line = line.strip()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:577:         if line:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:578:             subgates.append(json.loads(line))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:579: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:580: report = {"at": at, "scope": scope, "green": green_str == "true", "sha": sha, "subgates": subgates}

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:581: if sys.argv[9] == "1":

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:582:     report["scope_reason"] = "affected-no-ui"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:583:     report["browser"] = {"status": "omitted-by-diff", "base": sys.argv[10]}

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:584: if since:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:585:     report["since"] = since

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:586: if vitest_seed:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:587:     report["vitest_seed"] = int(vitest_seed)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:588: # Recorded baseline is project-owned, reviewed and never auto-raised by a slow run.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:589: # Only full runs are comparable; a partial command can have a different workload.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:590: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:591: import math

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:592: budget_path = Path('.pandacorp/gate-budget.json')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:593: if scope == 'full' and budget_path.exists():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:594:     warnings = []

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:595:     try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:596:         budget = json.loads(budget_path.read_text())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:597:         margin = budget.get('margin', 0.25)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:598:         minimum = budget.get('min_delta_ms', 1000)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:599:         stages = budget['stages']

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:600:         def number(value):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:601:             return type(value) in (int, float) and math.isfinite(value)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:602:         if (not number(margin) or margin < 0 or not number(minimum) or minimum < 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:603:                 or not isinstance(stages, dict)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:604:                 or any(not number(v) or v <= 0 for v in stages.values())):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:605:             raise ValueError('expected positive stage milliseconds and non-negative margin/min_delta_ms')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:606:         for gate in subgates:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:607:             baseline = stages.get(gate['name'])

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:608:             actual = gate['duration_ms']

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:609:             if baseline and actual > baseline * (1 + margin) and actual - baseline >= minimum:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:610:                 warnings.append(f"{gate['name']}: {actual} ms > baseline {baseline} ms + {margin:.0%}")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:611:     except (OSError, ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:612:         warnings.append('invalid gate-budget.json: ' + str(error))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:613:     report['budget_warnings'] = warnings

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:614:     for warning in warnings:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:615:         print('WARN DR-159 gate budget: ' + warning)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:616: with open(out_path, "w") as fh:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:617:     json.dump(report, fh, indent=2)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:618:     fh.write("\n")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:619: PY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:620:   # DR-146 certified tree: only a FULL green that started on a clean tree may certify it (and

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:621:   # green-stamp.sh re-checks the tree is unchanged and still clean); ANY red drops the stamp so a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:622:   # tree that just failed can never be skipped on the strength of an older green. Best-effort: a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:623:   # stamp that cannot be written only means the next merge-queue runs the full gate.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:624:   if [ -f .pandacorp/green-stamp.sh ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:625:     if [ "$green_exit" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:626:       bash .pandacorp/green-stamp.sh invalidate || true

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:627:     elif [ "$GATE_SCOPE" = "full" ] && [ -n "$STAMP_START_TREE" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:628:       bash .pandacorp/green-stamp.sh record "$STAMP_START_TREE" || true

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:629:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:630:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:631: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:632: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:633: # --- WP-08 `--only` validation — FAIL-CLOSED, before a single gate runs ------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:634: # A typo'd sub-gate name must never degrade into "run everything" (which a reader would then see as a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:635: # full green) nor into "run nothing" (a vacuous green). It is a hard non-zero exit, and the report it

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:636: # leaves behind says green:false with the offending invocation recorded as its own sub-gate entry.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:637: if [ -n "$ONLY_GATES" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:638:   _wp08_bad=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:639:   _wp08_oldifs="$IFS"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:640:   IFS=','

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:641:   for _wp08_g in $ONLY_GATES; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:642:     if [ -n "$_wp08_g" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:643:       case " $KNOWN_GATES " in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:644:         *" $_wp08_g "*) ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:645:         *) _wp08_bad="$_wp08_bad $_wp08_g" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:646:       esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:647:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:648:   done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:649:   IFS="$_wp08_oldifs"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:650:   if [ -n "$_wp08_bad" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:651:     _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:652:     {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:653:       echo "✗ --only: unknown sub-gate name(s):$_wp08_bad"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:654:       echo "   known sub-gates: $KNOWN_GATES"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:655:     } | tee "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:656:     record_gate_result invocation playwright 2 0 "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:657:     write_gate_report 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:658:     exit 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:659:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:660: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:661: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:662: # --- DR-146 `--light` / seed validation — FAIL-CLOSED, before a single gate runs ----------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:663: dr146_invocation_error() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:664:   local log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:665:   echo "✗ $1" | tee "$log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:666:   record_gate_result invocation playwright 2 0 "$log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:667:   write_gate_report 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:668:   exit 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:669: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:670: case "$NO_BAIL" in 0|1) ;; *) dr146_invocation_error "PANDACORP_VERIFY_NO_BAIL must be 0 or 1" ;; esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:671: export PANDACORP_E2E_CERTIFICATION=1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:672: export PANDACORP_VERIFY_NO_BAIL="$NO_BAIL"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:673: if [ "$LIGHT_CONFLICT" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:674:   dr146_invocation_error "--light and --only are exclusive (--light already names its sub-gates)"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:675: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:676: case "$VITEST_SEED" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:677:   ''|*[!0-9]*) dr146_invocation_error "PANDACORP_VITEST_SEED must be a positive integer, got '$VITEST_SEED'" ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:678: esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:679: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:680: # --- D5 `--files` validation — FAIL-CLOSED, before a single gate runs --------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:681: # REV2-G: unlike --only, --files was forwarded VERBATIM into biome's/vitest's argv with no

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:682: # validation at all — a value shaped like a flag (`--files=--write`) turns a read-only biome CHECK

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:683: # into a project-wide `biome check --write` autofix. And a `..`-bearing path could escape the repo

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:684: # entirely. Reject BOTH before any gate runs, the same fail-closed shape as --only above.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:685: # DR-146: `--tests` paths reach vitest's argv the same way, so they get the same two checks.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:686: _dr146_paths=()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:687: [ ${#SCOPE_FILES_ARR[@]} -gt 0 ] && _dr146_paths+=("${SCOPE_FILES_ARR[@]}")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:688: [ ${#SCOPE_TESTS_ARR[@]} -gt 0 ] && _dr146_paths+=("${SCOPE_TESTS_ARR[@]}")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:689: if [ ${#_dr146_paths[@]} -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:690:   _wp08_root=$(pwd -P)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:691:   for _wp08_f in "${_dr146_paths[@]}"; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:692:     case "$_wp08_f" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:693:       -*)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:694:         _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:695:         echo "✗ --files: path may not start with '-'" | tee "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:696:         record_gate_result invocation playwright 2 0 "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:697:         write_gate_report 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:698:         exit 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:699:         ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:700:     esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:701:     case "$_wp08_f" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:702:       *..*)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:703:         # A `..` segment is only a problem if it actually resolves OUTSIDE the repo root — a path

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:704:         # can legitimately contain `..` and still stay inside (e.g. `src/../src/lib/x.ts`).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:705:         # Lexical resolution only (no filesystem I/O): the path need not exist yet.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:706:         _wp08_resolved=$(python3 - "$_wp08_f" "$_wp08_root" <<'PY' 2>/dev/null

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:707: import os, sys

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:708: p, root = sys.argv[1:3]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:709: ap = p if os.path.isabs(p) else os.path.join(root, p)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:710: print(os.path.normpath(ap))

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:711: PY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:712: ) || _wp08_resolved=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:713:         case "$_wp08_resolved" in

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:714:           "$_wp08_root"|"$_wp08_root"/*) ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:715:           *)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:716:             _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:717:             echo "✗ --files: path escapes the repo: $_wp08_f" | tee "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:718:             record_gate_result invocation playwright 2 0 "$_wp08_log"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:719:             write_gate_report 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:720:             exit 2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:721:             ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:722:         esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:723:         ;;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:724:     esac

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:725:   done

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:726: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:727: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:728: # Runs one of the 9 CHEAP sub-gates. Without `--report-all`: aborts immediately on the first

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:729: # failure (byte-identical to the pre-WP-05 fail-fast behavior, just now also writing the report).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:730: # With `--report-all`: keeps going so every cheap gate gets a chance to report its own failures;

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:731: # the caller aborts once, after all 9 have run, if any of them failed.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:732: # WP-08: a gate `--only` did not name is skipped entirely — it contributes no fragment, so the report

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:733: # shows exactly what ran and nothing implies a gate passed when it never executed.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:734: CHEAP_GATES_FAILED=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:735: LAST_CHEAP_RC=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:736: run_cheap_gate() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:737:   if ! gate_selected "$1"; then return 0; fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:738:   local rc=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:739:   run_gate "$@" || rc=$?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:740:   if [ "$rc" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:741:     CHEAP_GATES_FAILED=1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:742:     LAST_CHEAP_RC="$rc"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:743:     if [ "$REPORT_ALL" -ne 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:744:       write_gate_report "$rc"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:745:       exit "$rc"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:746:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:747:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:748: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:749: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:750: # --- Structure guard (file placement isn't lintable; DR-059) -------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:751: # Fail if any unit/component test sits loose outside a _tests/ folder.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:752: gate_structure_guard() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:753:   local stray

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:754:   stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | grep -v '/_tests/' || true)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:755:   if [ -n "$stray" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:756:     echo "✗ tests must live in a _tests/ folder, not beside source:"; echo "$stray"; return 1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:757:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:758:   return 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:759: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:760: run_cheap_gate structure-guard pathlist gate_structure_guard

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:761: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:762: # --- Behavior-test hygiene (DR-144): heuristic warning, semantic review blocks ---

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:763: gate_live_data_asserts() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:764:   # Keep failures local to this advisory scanner; other gates remain fail-closed.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:765:   if ! python3 - <<'PY'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:766: import fnmatch, os, re

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:767: from pathlib import Path

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:768: patterns = os.environ.get('PANDACORP_CURATED_DATA_GLOBS', 'docs/**/*.json,content/**,prisma/seed*,**/*frozen*.json,**/*snapshot*.json').split(',')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:769: excluded = {'node_modules', '.git', '.next', 'dist', 'coverage', '.pandacorp', '.claude'}

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:770: def incomplete(error):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:771:     print(f'WARNING live-data-asserts: analysis incomplete: {error}')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:772: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:773: for root, dirs, files in os.walk('.', onerror=incomplete):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:774:     dirs[:] = [d for d in dirs if d not in excluded]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:775:     for name in files:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:776:         if not re.search(r'\.(test|spec)\.[cm]?[jt]sx?$', name):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:777:             continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:778:         path = Path(root) / name

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:779:         if 'src/test/' in path.as_posix():

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:780:             continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:781:         try:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:782:             text = path.read_text(encoding='utf-8')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:783:         except (OSError, UnicodeError) as error:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:784:             incomplete(f'{path}: {error}')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:785:             continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:786:         # Direct imports, require and readFile literals only; no claim of data-flow analysis.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:787:         reads = re.findall(r'''(?:\bfrom\s*|\bimport\s*|\b(?:require|readFileSync|readFile)\s*\(\s*)['"]([^'"\n]+)['"]''', text)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:788:         def curated(value):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:789:             value = re.sub(r'^(?:\.\.?/)+', '', value)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:790:             if value.startswith('src/test/'):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:791:                 return False

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:792:             return any(fnmatch.fnmatch(value, p.strip()) or fnmatch.fnmatch(value, p.strip().replace('**/', '')) for p in patterns if p.strip())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:793:         if not any(curated(value) for value in reads):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:794:             continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:795:         for assertion in re.finditer(r'\bexpect\s*\([\s\S]*?;', text):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:796:             tail = text[assertion.end():].split('\n', 1)[0]

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:797:             lines = assertion.group().splitlines()

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:798:             if any(re.search(r'//\s*live-data-ok:\s*\S', line) for line in [*lines, tail]):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:799:                 continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:800:             # Ignore quoted strings/comments; numeric strings are not volume literals.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:801:             code = re.sub(r'''(['"`])(?:\\.|(?!\1)[\s\S])*?\1|//[^\n]*|/\*[\s\S]*?\*/''', '', assertion.group())

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:802:             if any(int(n.replace('_', '')) >= 10 for n in re.findall(r'(?<![\w.])\d[\d_]*(?![\w.])', code)):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:803:                 line = text.count('\n', 0, assertion.start()) + 1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:804:                 print(f'{path}:{line}: WARNING live-data-asserts (DR-144): curated read + numeric assertion; use fixture/structural contracts or same-line // live-data-ok: <reason>')

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:805: PY

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:806:   then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:807:     echo 'WARNING live-data-asserts: analysis incomplete: internal scanner failure; semantic review required'

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:808:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:809:   return 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:810: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:811: run_cheap_gate live-data-asserts pathlist gate_live_data_asserts

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:812: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:813: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:814: # --- Data-layer isolation (structure.md STRUCT-2) — DB access only in src/queries/ -------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:815: # The ORM client is created once (src/lib/prisma.ts) and consumed ONLY by the data layer.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:816: # Type-only imports of @prisma/client are fine anywhere. Vacuous without Prisma.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:817: gate_data_layer() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:818:   if [ -d src ] && grep -q '"@prisma/client"' package.json 2>/dev/null; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:819:     local leak leak2

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:820:     leak=$(grep -rEl "new PrismaClient\(|from ['\"]@/lib/prisma['\"]" src --include='*.ts' --include='*.tsx' 2>/dev/null \

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:821:       | grep -v '^src/queries/' | grep -v '^src/lib/prisma\.ts$' || true)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:822:     # value-imports of @prisma/client (not `import type`) outside the sanctioned locations

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:823:     leak2=$(grep -rE "^import \{[^}]*\} from ['\"]@prisma/client['\"]" src --include='*.ts' --include='*.tsx' -l 2>/dev/null \

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:824:       | grep -v '^src/queries/' | grep -v '^src/lib/prisma\.ts$' || true)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:825:     if [ -n "$leak$leak2" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:826:       echo "✗ Data-layer isolation (STRUCT-2): DB access outside src/queries/ (components/actions call queries/, never the ORM):"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:827:       printf '%s\n%s\n' "$leak" "$leak2" | sort -u | sed '/^$/d'; return 1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:828:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:829:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:830:   return 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:831: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:832: run_cheap_gate data-layer pathlist gate_data_layer

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:833: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:834: # --- API error contract (api-design.md API-1, RFC 9457) ----------------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:835: # A route handler that returns 4xx/5xx must use the shared problem() helper

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:836: # (application/problem+json), never an ad-hoc error body. Vacuous without API routes.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:837: gate_api_error_contract() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:838:   if [ -d src/app/api ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:839:     local bad=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:840:     while IFS= read -r f; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:841:       [ -n "$f" ] || continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:842:       if grep -Eq 'status: *(4|5)[0-9][0-9]' "$f" && ! grep -q 'problem' "$f"; then bad="$bad  $f"$'\n'; fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:843:     done < <(find src/app/api -name 'route.ts' 2>/dev/null)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:844:     if [ -n "$bad" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:845:       echo "✗ API error contract (RFC 9457): route handlers return 4xx/5xx without the shared problem() helper (see STACK.md — API error contract):"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:846:       printf '%s' "$bad"; return 1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:847:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:848:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:849:   return 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:850: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:851: run_cheap_gate api-error-contract pathlist gate_api_error_contract

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:852: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:853: # --- Doc-structure lint (DR-077, greenfield fail-closed subset BL-0009) — frontmatter + stable-ID

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:854: # spine; vacuous if no docs ----

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:855: # Validates generated docs (FRD/PRD/work-orders) carry required frontmatter and that REQ->WO IDs

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:856: # resolve. ADVISORY on brownfield/adopted (created_via: adopt, or no provenance recorded) — reports

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:857: # drift and NEVER fails the gate, so it can't red-lock an adopted/partial-spine project. FAIL-CLOSED

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:858: # on greenfield (created_via: scaffold, set by /pandacorp:scaffold) for the structural subset only

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:859: # (missing frontmatter keys, a PRD without `type`) — a project born via scaffold is expected to carry

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:860: # a complete spine, so doc-lint.sh itself now exits non-zero and this call legitimately fails the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:861: # gate. A project with no docs/ passes. The harness is new, so a missing script is a no-op (older

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:862: # overlays); /pandacorp:upgrade installs it. Drift is surfaced here, NOT tracked by a per-doc

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:863: # version stamp (DR-077).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:864: gate_doc_lint() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:865:   if [ -f .pandacorp/doc-lint.sh ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:866:     bash .pandacorp/doc-lint.sh

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:867:     return $?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:868:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:869:   return 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:870: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:871: run_cheap_gate doc-lint pathlist gate_doc_lint

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:872: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:873: # --- Residual-ambiguity gate (DR-100) — a [NEEDS CLARIFICATION] marker must never reach an ACTIVE doc ---

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:874: # Spec/blueprint authors mark an unresolved, build-changing question inline with `[NEEDS CLARIFICATION: …]`

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:875: # (distinct from a resolved `[ASSUMPTION: …]`). The readiness gate forbids it surviving into a live doc:

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:876: # if any file under docs/ carries the marker AND its frontmatter is `status: ACTIVE`, a question shipped

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:877: # into the build → RED. A DRAFT doc may still carry it (spec is still resolving it); no docs/ ⇒ vacuous pass.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:878: gate_residual_ambiguity() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:879:   if [ -d docs ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:880:     local flagged=""

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:881:     while IFS= read -r f; do

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:882:       [ -n "$f" ] || continue

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:883:       if grep -Eq '^status:[[:space:]]*ACTIVE' <<<"$(head -n 25 "$f")"; then flagged="$flagged  $f"$'\n'; fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:884:     done < <(grep -rIl 'NEEDS CLARIFICATION' docs 2>/dev/null || true)

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:885:     if [ -n "$flagged" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:886:       echo "✗ DR-100 readiness: unresolved [NEEDS CLARIFICATION] in ACTIVE docs (resolve → AC / business rule / [ASSUMPTION], or escalate):"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:887:       printf '%s' "$flagged"; return 1

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:888:     fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:889:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:890:   return 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:891: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:892: run_cheap_gate residual-ambiguity pathlist gate_residual_ambiguity

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:893: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:894: # --- Lint + format (every warn is a hard gate; --error-on-warnings) ------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:895: # WP-08: `--files` narrows biome to exactly those paths (it is path-addressable and is the gate a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:896: # mechanical repair agent re-runs most). Unscoped, the command line is byte-for-byte the old one.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:897: if [ "${#SCOPE_FILES_ARR[@]}" -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:898:   run_cheap_gate biome biome pnpm biome check "${SCOPE_FILES_ARR[@]}" --error-on-warnings

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:899: else

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:900:   run_cheap_gate biome biome pnpm biome check . --error-on-warnings

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:901: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:902: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:903: # --- Typing -------------------------------------------------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:904: run_cheap_gate tsc tsc pnpm tsc --noEmit

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:905: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:906: # --- Dead code (fail-closed) --------------------------------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:907: run_cheap_gate knip pathlist pnpm knip

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:908: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:909: # --- Circular dependencies (fail-closed) --------------------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:910: run_cheap_gate madge pathlist pnpm madge --circular --extensions ts,tsx src

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:911: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:912: # `--report-all`: all 9 cheap gates above have now run and reported independently — abort ONCE,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:913: # here, with the aggregate verdict, instead of at the first one (vitest/Playwright never run on a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:914: # cheap-gate red; there is nothing more the expensive layers would add to an already-red verdict).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:915: if [ "$REPORT_ALL" -eq 1 ] && [ "$CHEAP_GATES_FAILED" -eq 1 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:916:   write_gate_report "$LAST_CHEAP_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:917:   exit "$LAST_CHEAP_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:918: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:919: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:920: # --- Behavior -----------------------------------------------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:921: # shellcheck disable=SC2086

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:922: # `|| VITEST_RC=$?` (not a bare call + `$?` on the next line): under `set -e` a plain non-zero

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:923: # command exits the script IMMEDIATELY, before a following `VITEST_RC=$?` would ever run — that

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:924: # would skip write_gate_report entirely on a vitest failure. The `||` keeps this on the safe side

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:925: # of errexit (same reasoning as run_gate's own PIPESTATUS capture just above).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:926: #

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:927: # WP-08 `--files`: switch to `vitest related <paths>` — the tests those source files actually affect.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:928: # VERIFIED against mission-control's installed vitest 4.1.9: `vitest run --related <files>` is NOT a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:929: # valid option there (CACError: Unknown option `--related`); the supported spelling is the `related`

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:930: # SUBCOMMAND, which narrowed 435 discovered test files to the 4 that import src/lib/slug.ts.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:931: # `--passWithNoTests` is deliberate: a file with no related test must not red a SCOPED run (it is not

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:932: # a failure signal, and the scoped run's `partial` report can never certify anything on its own — the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:933: # whole-project re-gate remains the only oracle that certifies).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:934: #

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:935: # DR-146 `--tests`: exactly the named test files (`vitest run <files>`), never a module-graph guess

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:936: # (`related` transforms the whole graph and widens to every spec when a config/package.json is

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:937: # named). The shuffled order + explicit seed apply to every vitest mode.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:938: if gate_selected vitest; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:939: VITEST_RC=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:940: VITEST_SEED_USED="$VITEST_SEED"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:941: VITEST_ORDER=("--bail=$((1 - NO_BAIL))" --sequence.shuffle "--sequence.seed=$VITEST_SEED")

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:942: echo "vitest order: shuffled with seed $VITEST_SEED — replay this exact order: PANDACORP_VITEST_SEED=$VITEST_SEED bash .pandacorp/verify.sh $* (vitest alone: PANDACORP_VITEST_SEED=$VITEST_SEED bash .pandacorp/verify.sh --only=vitest)"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:943: if [ "${#SCOPE_TESTS_ARR[@]}" -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:944:   run_gate vitest vitest pnpm vitest run "${SCOPE_TESTS_ARR[@]}" --reporter=dot --passWithNoTests "${VITEST_ORDER[@]}" || VITEST_RC=$?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:945: elif [ "${#SCOPE_FILES_ARR[@]}" -gt 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:946:   run_gate vitest vitest pnpm vitest related "${SCOPE_FILES_ARR[@]}" --run --reporter=dot --passWithNoTests "${VITEST_ORDER[@]}" || VITEST_RC=$?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:947: else

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:948:   run_gate vitest vitest pnpm vitest run --reporter=dot ${SINCE:+--changed "$SINCE"} "${VITEST_ORDER[@]}" || VITEST_RC=$?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:949: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:950: if [ "$VITEST_RC" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:951:   write_gate_report "$VITEST_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:952:   exit "$VITEST_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:953: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:954: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:955: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:956: # --- Browser gates (DR-055/056/074/075) — FAIL-CLOSED: a missing harness is RED ---

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:957: # ONE playwright invocation = ONE webServer boot for the whole e2e layer (smoke + visual + responsive

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:958: # + shell). The old four-`pnpm test:X` split bought nothing and quadrupled server boots. Each spec is

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:959: # self-contained (its own page.route abort for the live transport, DR-071), so determinism is

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:960: # unchanged; `workers:1` + `fullyParallel:false` (playwright.config) already serialize everything.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:961: # Fail-closed gates on the SPEC FILE + config the combined run actually discovers (testDir:"./e2e"),

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:962: # NOT the npm scripts — a run finds specs by filesystem, so a deleted spec must RED here (a present

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:963: # script with an absent spec would otherwise pass as "no matching tests"). The `test:*` npm scripts

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:964: # stay for manual/blessing use, but they are no longer the gate's contract.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:965: # NOTE: this does NOT fix the `.next`/process-contention ERR_CONNECTION_REFUSED a co-located dev /

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:966: # always-on server causes (it dies mid-invocation; DR-075 lessons) — that fix is worktree isolation,

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:967: # tracked separately. This only removes the inter-invocation churn (DR-076).

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:968: gate_playwright() {

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:969:   [ -f playwright.config.ts ] || { echo "✗ Browser gates missing: no playwright.config.ts (DR-055)."; return 1; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:970:   [ -f e2e/smoke.spec.ts ]      || { echo "✗ Preview Smoke Gate missing (DR-055): add e2e/smoke.spec.ts — every route must render clean in a browser."; return 1; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:971:   [ -f e2e/visual.spec.ts ]     || { echo "✗ Visual-Fidelity Gate missing (DR-056): add e2e/visual.spec.ts — diff each route against its blessed baseline."; return 1; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:972:   [ -f e2e/responsive.spec.ts ] || { echo "✗ Responsive Gate missing (DR-074): add e2e/responsive.spec.ts + e2e/_responsive-helper.ts + e2e/_target.ts."; return 1; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:973:   [ -f e2e/shell.spec.ts ]      || { echo "✗ Shell-Presence Gate missing (DR-075): add e2e/shell.spec.ts + e2e/shell.ts — assert the app shell / global nav vs the prototype."; return 1; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:974:   [ -f e2e/headers.spec.ts ]    || { echo "✗ Header-Scan Gate missing (web-security.md): add e2e/headers.spec.ts — security headers, tiered by deploy_target."; return 1; }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:975:   # ADVISORY token-fidelity check (F4): e2e/tokens.spec.ts is auto-discovered by the FULL run below

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:976:   # (NOT by the --since gate). It flags hardcoded colors that never came from a design token and reds

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:977:   # ONLY on a GROSS violation (>20 distinct hardcoded colors on a route) — a punch-list, not a fidelity

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:978:   # block. It is deliberately NOT in the fail-closed presence list above: a missing tokens.spec.ts is a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:979:   # skipped advisory, never a RED (unlike the gates that CAN block). It runs at close-out, not per-FRD.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:980:   # DR-106 scope: the per-FRD gate (--since) runs smoke + shell only — the browser layer of the

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:981:   # DR-072 BLOCKING lenses (routes render clean + the app shell is present). Visual + responsive

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:982:   # stay in the FULL run (close-out / Visual QA): fine fidelity is advisory at the gate and may

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:983:   # never block, so paying the whole serialized suite per FRD bought nothing but wall-clock.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:984:   # DR-143: a project's e2e/parallel-safe.json splits one FULL invocation into ordered projects (one server boot):

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:985:   # the listed specs on several workers, then desktop and mobile serially. No file, same single run.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:986:   # A project's e2e/prod-server.mjs serves the FULL run from one production build instead of next dev.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:987:   if [ -z "$SINCE" ] && [ -f e2e/prod-server.mjs ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:988:     node e2e/prod-server.mjs build || return $?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:989:     export PANDACORP_E2E_SERVER=prod

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:990:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:991:   if [ -n "$SINCE" ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:992:     pnpm exec playwright test e2e/smoke.spec.ts e2e/shell.spec.ts

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:993:   elif [ -f e2e/parallel-safe.json ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:994:     PANDACORP_E2E_TIER=combined pnpm exec playwright test e2e/

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:995:   else

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:996:     pnpm exec playwright test e2e/

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:997:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:998: }

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:999: # Same `set -e` hazard as vitest above: `|| PLAYWRIGHT_RC=$?`, not a bare call.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1000: # WP-08: the browser layer is NOT file-scopable (`--files` does not touch it) — it is only ever

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1001: # skipped wholesale by an `--only` that does not name it.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1002: if gate_selected playwright && [ "$AFFECTED_SKIP" -eq 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1003: PLAYWRIGHT_RC=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1004: run_gate playwright playwright gate_playwright || PLAYWRIGHT_RC=$?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1005: if [ "$PLAYWRIGHT_RC" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1006:   write_gate_report "$PLAYWRIGHT_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1007:   exit "$PLAYWRIGHT_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1008: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1009: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1010: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1011: # --- Bless-provenance advisory (DR-080) — non-blocking -------------------------

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1012: # A blessed visual baseline with no recorded ORACLE (the prototype path/shard + sign-off + a

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1013: # `prototype_blessed_at` SHA in the FRD's fdd.md) is a self-reference — the trap that let a menu-less

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1014: # baseline ship green (E6). ADVISORY: it warns, never fails (so it can't red-lock baselines blessed

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1015: # before this rule). The deterministic block is the reviewer's bless step (DR-080) + the gate canary.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1016: if ls e2e/visual.spec.ts-snapshots/*.png >/dev/null 2>&1 && ! grep -rqs "prototype_blessed_at" docs/frds 2>/dev/null; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1017:   echo "⚠ DR-080: blessed visual baselines exist but no fdd.md records a 'prototype_blessed_at' provenance line — the baseline's independent oracle is unrecorded (advisory)."

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1018: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1019: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1020: # DR-140: opt-in DB postcondition after selected test suites; DB-free projects need no script.

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1021: if { gate_selected vitest || gate_selected playwright; } &&

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1022:    node -e 'const script = require("./package.json").scripts?.["db:test:check-clean"]; process.exit(typeof script === "string" && script.trim() ? 0 : 1)'; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1023:   DB_CLEAN_RC=0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1024:   run_gate database-clean plain pnpm db:test:check-clean || DB_CLEAN_RC=$?

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1025:   if [ "$DB_CLEAN_RC" -ne 0 ]; then

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1026:     write_gate_report "$DB_CLEAN_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1027:     exit "$DB_CLEAN_RC"

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1028:   fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1029: fi

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1030: 

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1031: write_gate_report 0

/Users/Shared/Proyectos/panda-corp/plugin/templates/stack-a-nextjs/verify.sh:1032: exit 0

## 3. DR-158 / DR-159 y backlog

DR-158 conserva G3 completo; fail-fast, dueño único del checkout, sello v2 con entorno/dependencias/fixtures, servidor prod compartido, inventarios móviles y paralelismo revisado, --affected solo iteración. Cifras **citadas por registro, no medidas aquí**: bail/maxFailures=1; contención exit 75; tier seguro 3 workers y diagnóstico 1 worker. No certifica partial; no hashea ediciones arbitrarias internas de node_modules; timings requieren medidas browser sin restricciones. DR-159 hace durable el coste: warnings por specs no clasificadas, conserva serial/ambas plataformas ante ausencia; helper Vitest Node/DOM con override validado y sin sobrescribir config del proyecto; presupuestos avisan sin fallar ni omitir ni autocambiar baseline. Reuso de fixtures queda solo documentado. Versiones **citadas**, no benchmark: plugin 10.2.0/overlay 9.2.0.

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:934:   - id: DR-158

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:935:     patron: "Verify speed: fail-fast, single gate owner, prod-build browser gates, mobile allowlist, parallel-safe workers, affected iteration"

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:936:     default: "Keep full G3 certification before main. Certification uses Vitest bail=1 and Playwright maxFailures=1; --no-bail or PANDACORP_VERIFY_NO_BAIL=1 accumulates failures without changing DR-146 shuffled seeds. One kernel lock per checkout owns reports, stamps and browser resources; contention exits 75 before mutation, never reuses a foreign server. Green-stamp v2 binds tree, gate, dependency lock/installed graph metadata, Node, all ambient environment inputs except declared invocation/shell controls, lane.env and physical e2e fixtures at start and end; any doubt runs full. Browser gates share one production build and one owned server, legacy mobile coverage unless a reviewed inventory explicitly excludes named duplicates (unknown specs stay mobile), and reviewed parallel-safe projects before serial complements; visual and shared-state writers remain serial. Combined --no-bail diagnostics use one global worker and no success dependencies, so red projects cannot suppress later projects; certification retains the ordered 3-worker safe tier and fail-fast dependencies. --affected is iteration only, always partial and never certification: omit browser only for proven query/worker data-only changes, retaining global static/unit gates and the browser on unknown UI/dependencies/Git signals."

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:937:     requiere_humano: false

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:938:     nota: "Owner chose option B of verify-research.md. Extends DR-143/146, preserves DR-055/056/059/074/075 and closes BL-0300's checkout contention mechanism. Template-first, Mission Control first adopter. Verification: test-verify-gate-report.sh, test-verify-before-stop.sh, test-e2e-tiers.mjs, test-e2e-diagnostic-phases.mjs (real scheduler, no browser/server) and test-merge-queue-*.sh. Installed graph metadata does not hash arbitrary edits inside node_modules; externally changed fixture roots and environment inputs outside the declared inputs require invalidation. Timing claims require unrestricted browser measurements."

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:939: 

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:940:   - id: DR-159

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:941:     patron: "keeping DR-158 verification speed as project test suites grow"

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:942:     default: "DURABLE GATE COST: Stack A warns on unclassified e2e specs when the project opts into inventories. Missing classifications retain serial and both-platform coverage. Every added/changed spec updates the parallel/serial and mobile inventories with reviewed reasons. The managed vitest-policy.ts helper supplies isolated Node-default/explicit-DOM projects, DOM-only setup and a validated PANDACORP_VITEST_MAX_WORKERS override; absent override preserves runner/project worker behavior and DR-146 order/seed. Upgrade never overwrites project Vitest config. Full gate reports compare stage durations to a reviewed project-owned gate-budget.json baseline and margin; warnings never fail, certify, omit tests or auto-raise the baseline."

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:943:     requiere_humano: false

/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml:944:     nota: "Owner DUR request, 2026-11-13. Plugin 10.2.0, overlay 9.2.0. Canonical quality.md and build-orchestration.md; machinery tests test-verify-gate-report.sh and test-vitest-policy.mjs. Fixture-template reuse is documentation only, keyed by migration/toolchain fingerprint with fresh isolated clones and zero-residue checks."

### Ítems abiertos relacionados (búsqueda amplia en texto completo; incluye operación adyacente)


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0025-implement-backlog-plugin-version-allocator.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0025-implement-backlog-plugin-version-allocator.md:2: id: BL-0025

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0025-implement-backlog-plugin-version-allocator.md:5: title: "Parallel agents (implement-backlog whole-queue, parallel librarian harvests) need a single owner for shared monotonic values (plugin.json version, LESSON-id/INDEX.md)"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0025-implement-backlog-plugin-version-allocator.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0025-implement-backlog-plugin-version-allocator.md:83:   the final number. Add a script assertion (in `plugin/scripts/` or an existing merge-queue script) that


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0026-vitest-exclude-not-globstar-aware-worktree-contamination.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0026-vitest-exclude-not-globstar-aware-worktree-contamination.md:2: id: BL-0026

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0026-vitest-exclude-not-globstar-aware-worktree-contamination.md:5: title: "vitest.config.ts template's exclude glob is not globstar-aware, so a left-over worktree's own node_modules test files leak into the main checkout's gate"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0026-vitest-exclude-not-globstar-aware-worktree-contamination.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0026-vitest-exclude-not-globstar-aware-worktree-contamination.md:45: or runs the fixture file. A `verify.sh --canary`-style assertion or a documented manual repro (if


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:2: id: BL-0028

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:5: title: "worktree-bootstrap.sh assumes .claude/launch.json is gitignored when it is git-tracked, so its autoPort rewrite creates an accidental diff"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:32: writes to instead; or (b) have `worktree-bootstrap.sh` (or the merge-queue landing step) automatically

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:56: dirty, and `merge-queue.sh`'s clean-tree preflight rejected the landing until an agent ran

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:62: (name suffix + autoPort) again, and `merge-queue.sh` refused to land with the precise `exit 20`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0028-worktree-bootstrap-launch-json-gitignore-assumption-wrong.md:64: this occurrence adds: the concrete `merge-queue.sh` exit code (20) that this failure mode presents as, useful


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:2: id: BL-0030

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:5: title: "Port the enforcement hooks (dangerous-command gate, verify-before-stop) to Codex hooks"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:23: 2. `verify-before-stop.sh` keys its build-active bypass on `.pandacorp/run/build.lock` freshness (DR-063), while the portable attended loop (PORT-5) only maintains `running` + `supervisor_heartbeat` in `status.yaml` — under Codex the Stop gate would run strict when it should stand aside, or vice versa.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:26: 1. Add a Codex hooks registration (`.codex/hooks.json` or `[hooks]` tables) mapping our existing scripts: `block-dangerous.sh` → PreToolUse on shell tool; write-gate reminders → PreToolUse on `apply_patch` (payload field mapping needed — the scripts read Claude's `tool_input` shape); `verify-before-stop.sh` + `capture-lessons-reminder.sh` → Stop.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:28: 3. Reconcile the build-active signal: either the attended loop (PORT-5 playbook step 2) also touches `.pandacorp/run/build.lock`, or `verify-before-stop.sh` learns to read `status.yaml` heartbeat as an alternative freshness source. Pick one and document in agent-portability.md.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:29: 4. Verify hook trust flow (`--dangerously-bypass-hook-trust` NOT used; persist trust properly).

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md:33: - A Codex session ending with a red `verify.sh` and no fresh build signal → Stop gate output shown.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0031-codex-rules-and-project-config.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0031-codex-rules-and-project-config.md:2: id: BL-0031

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0031-codex-rules-and-project-config.md:5: title: "Add .codex project config: destructive-command rules + profiles mirroring build modes"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0031-codex-rules-and-project-config.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0031-codex-rules-and-project-config.md:27: 2. Add the destructive-command rules surface (`.codex/rules/pandacorp.rules` or the config-native equivalent — verify the current official mechanism first; the verification session cited it, confirm against https://developers.openai.com/codex/config-reference).


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md:2: id: BL-0032

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md:5: title: "Add agents/openai.yaml sidecars gating internal/dangerous skills under Codex"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md:19: > **Kept LIVE under DR-120 (Codex freeze, 2026-09-02).** This is a guardrail, not a capability: it stops Codex auto-invoking internal engine skills (`bug`, `iterate`, `scaffold`, `work-orders`, `new-version`) that mutate a project. Under a read/review-only Codex that matters MORE, not less. Note also that `plugin/scripts/check-skill-capabilities.mjs` already fails closed if an internal skill lacks its `agents/openai.yaml` sidecar with `allow_implicit_invocation: false` — verify current state before assuming the gap is still open.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md:24: 1. For each internal skill, add `plugin/skills/<slug>/agents/openai.yaml` with `allow_implicit_invocation: false` (verify current schema against the official docs before writing).

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0032-openai-yaml-skill-sidecars.md:26: 3. Confirm Claude Code ignores the extra dir (plugin validate + a smoke session) — it should, but verify, don't assume.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:2: id: BL-0036

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:5: title: "stack-a-nextjs projects lack a next-env.d.ts gitignore entry, so it dirties main on every build"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:10: source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — next-env.d.ts flipped modified on every build, blocked merge-queue.sh twice in one session (worked around via `git checkout -- next-env.d.ts`)"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:18: `git status` after essentially any local run, even with zero real source changes. `merge-queue.sh`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:19: preflights on `git status --porcelain` being clean in the main checkout (`plugin/templates/shared/.pandacorp/merge-queue.sh:44`)

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:35:    gitignore line (verify it does not require a manual `git rm --cached next-env.d.ts` step to fully take

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:45: - **Merge-queue regression guard:** with a fixture where `next-env.d.ts` has been touched (simulating a

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0036-nextjs-template-gitignore-missing-next-env-d-ts.md:46:   post-build state) but no other file changed, assert `merge-queue.sh`'s preflight (`git status


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:2: id: BL-0037

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:5: title: "stack-a-nextjs verify.sh Playwright webServer on a fixed port fails the Stop gate with a stale-server error, not a code error"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:19: tool, not from Playwright itself, or from an earlier aborted verify run), the webServer step can fail

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:21: `verify.sh`/the Stop gate, it reads exactly like a real code failure — the agent (or the enforcement

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:33: 1. In `verify.sh` (`plugin/templates/stack-a-nextjs/verify.sh`), before invoking Playwright, add a

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:34:    preflight check on the project's reserved e2e port: if something is listening, verify it responds like

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:36:    actionable message ("port <N> is occupied by an unrelated process; free it before running verify"),

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:41: Files: `plugin/templates/stack-a-nextjs/verify.sh`, possibly the Stop-gate hook's failure-classification

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:46:   e2e port, then run `verify.sh` — it must fail FAST with a message naming the port-collision cause,

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:50:   port, `verify.sh` must still pass by reusing it (no regression to the intended `reuseExistingServer`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0037-verify-sh-playwright-webserver-stale-port-blocks-stop-gate.md:54: `verify.sh` distinguishes a foreign/stale port occupant from a legitimate reusable dev server before


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0046-building-change-state-surfaces-and-d1-residual.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0046-building-change-state-surfaces-and-d1-residual.md:2: id: BL-0046

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0046-building-change-state-surfaces-and-d1-residual.md:5: title: "Teach Mission Control + docs the engine-managed transient change status 'building', and close the D1 archive-strand residual"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0046-building-change-state-surfaces-and-d1-residual.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0046-building-change-state-surfaces-and-d1-residual.md:46: The verify-then-archive sweep runs at close-out only when the run built ≥1 FRD. If the run that verifies a


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:2: id: BL-0049

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:5: title: "Baseline self-heal does not detect an orphaned next dev process blocking verify.sh's Playwright webServer"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:10: source: "mission-control/.pandacorp/run/lessons.md 2026-07-06 (FRD-17 build, agent-inferred) — verify.sh's own webServer step failed with 'Another next dev server is already running'"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:16: During the FRD-17 build on Mission Control, `verify.sh`'s Playwright `webServer` step failed with

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:20: session (e.g. a Preview dev-server session, or an aborted prior verify run) blocks a completely fresh

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:21: `verify.sh` run regardless of which port it targets. The existing baseline self-heal step in the build

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:28: A further live reproduction, on a different project: `/pandacorp:upgrade` and the verify-before-stop gate

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:39: `/pandacorp:upgrade`'s pre-canary step checks for or clears this lock before invoking `verify.sh`.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:43:    in `verify.sh` itself before the Playwright `webServer` step runs) that detects an orphaned `next dev`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:49:    `verify.sh` and could hit the same stale-lock condition after a Preview session.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:56:   an orphan from a prior session), then run `verify.sh` — it must detect and clear/report the stale lock

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:59: - **Clean run unaffected:** with no prior `next dev` process running, `verify.sh` passes normally (no

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:63: `verify.sh` (or the build engine's baseline self-heal) detects and clears/reports an orphaned `next dev`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:73: symptom surface: (1) `.pandacorp/verify.sh` cannot run at all from the main checkout while the owner has a

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:78: per-directory dev lock, so the NEXT `verify.sh` run REDed the same way — confirming `preview_stop`'s own

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:89: `verify-before-stop.sh`'s own hook-triggered `verify.sh` invocation produced 25 spurious Playwright

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0049-orphaned-dev-server-blocks-verify-webserver-lock.md:94: cover the Stop-hook's own invocation path too, not just manual/upgrade-triggered `verify.sh` runs, and


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0052-wire-universal-stats-regen-trigger.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0052-wire-universal-stats-regen-trigger.md:2: id: BL-0052

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0052-wire-universal-stats-regen-trigger.md:5: title: "Wire the universal per-commit read-model regen trigger (FRD-23) — documented but never installed; factory store + sibling-project resolution unhandled"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0052-wire-universal-stats-regen-trigger.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0052-wire-universal-stats-regen-trigger.md:26:   dangerous-command gate (PreToolUse), verify-before-stop + lesson-capture (Stop) and telemetry

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0052-wire-universal-stats-regen-trigger.md:87:   **GREEN** after the hook is installed. A `verify.sh --canary`-style fixture or a scripted CLI


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:2: id: BL-0053

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:5: title: "FRD-23 read-model writer tests (statsWriter/factoryStoreWriter/backfill/regen) write AND delete the REAL .pandacorp/stats*.json on every gate run"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:6: status: doing

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:20: isolated fixture root. Every `verify.sh`/CI run therefore writes throwaway test data into the live

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:43: When that branch lands: verify the diff matches this shape, run the full suite, confirm no test path

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:59: - A gate run (`verify.sh`) no longer mutates the repo's real stats cache files.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0053-read-model-writer-tests-destroy-real-stats-cache.md:60: - LESSON-0110 back-linked; branch merged to `main` (factory repo has no merge queue — direct commit,


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0059-design-stage1-review-must-check-declared-but-unwired-variants.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0059-design-stage1-review-must-check-declared-but-unwired-variants.md:2: id: BL-0059

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0059-design-stage1-review-must-check-declared-but-unwired-variants.md:5: title: "Design skill's Stage-1 pull-and-review (§1c) must check for declared-but-unwired variants within the design system itself, not only at the cross-screen closing sweep"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0059-design-stage1-review-must-check-declared-but-unwired-variants.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0059-design-stage1-review-must-check-declared-but-unwired-variants.md:36:    style), verify its declared trigger condition is actually READ and BRANCHED ON by the component/its


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0061-memory-review-paso0-overcounts-drained-comment-blocks.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0061-memory-review-paso0-overcounts-drained-comment-blocks.md:2: id: BL-0061

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0061-memory-review-paso0-overcounts-drained-comment-blocks.md:5: title: "pandacorp-memory-review PASO 0 note-count must strip <!-- Drained ... --> blocks before counting"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0061-memory-review-paso0-overcounts-drained-comment-blocks.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0061-memory-review-paso0-overcounts-drained-comment-blocks.md:125: Caveat to verify before relying on it as the sole fix: confirm no `<!-- Drained ... -->` block's own prose


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0087-review-launch-must-verify-live-production-not-trust-phase-release.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0087-review-launch-must-verify-live-production-not-trust-phase-release.md:2: id: BL-0087

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0087-review-launch-must-verify-live-production-not-trust-phase-release.md:5: title: "review-launch must verify the live production artifact directly instead of trusting status.yaml's phase:release"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0087-review-launch-must-verify-live-production-not-trust-phase-release.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0087-review-launch-must-verify-live-production-not-trust-phase-release.md:60: verifying the live production artifact; the RED fixture above passes GREEN; plugin version bumped per DR-034


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0110-recalibrate-wo-granularity-and-escalation-thresholds.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0110-recalibrate-wo-granularity-and-escalation-thresholds.md:2: id: BL-0110

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0110-recalibrate-wo-granularity-and-escalation-thresholds.md:5: title: "Recalibrate DR-100's work-order granularity and DR-073/DR-107's escalation thresholds with Claude-5-era data"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0110-recalibrate-wo-granularity-and-escalation-thresholds.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0110-recalibrate-wo-granularity-and-escalation-thresholds.md:22: fixed ~9-min gate cost better `[expected, not demonstrated]` — and blind loosening reproduces the 7k-LOC


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0125-portfolio-phase-desync-vs-status-yaml.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0125-portfolio-phase-desync-vs-status-yaml.md:2: id: BL-0125

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0125-portfolio-phase-desync-vs-status-yaml.md:5: title: "sync-portfolio can leave factory/portfolio.md's phase stale against the project's own status.yaml, with no re-verification until the next manual run"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0125-portfolio-phase-desync-vs-status-yaml.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0125-portfolio-phase-desync-vs-status-yaml.md:67: different fix (wire/verify the recurring task) than either (a) or (b). No new fix-design information


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:2: id: BL-0126

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:5: title: "verify.sh's whole-project gate never runs a production build (next build), so dev/prod divergence (e.g. missing CSP unsafe-eval) ships undetected"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:16: `.pandacorp/verify.sh` (the shared build-orchestration gate template) runs biome, tsc, vitest, Playwright

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:20: same code run without error. A fully green `verify.sh` is therefore not evidence that the deployable

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:24: The gate's browser layer (Playwright) boots its `webServer` against `next dev` for speed/HMR

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:25: convenience, and no separate step in `verify.sh` ever invokes `next build` (or the stack's equivalent

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:31: 1. Add a production-build step to `verify.sh` (`next build`, generalized per the project's stack) — at

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:41: current `verify.sh` reports fully green. GREEN = updated `verify.sh` runs the production build step and

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0126-verify-sh-never-runs-production-build.md:45: `verify.sh`'s full (non-`--since`) run includes a production-build step that the RED→GREEN fixture proves


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0130-dr065-auto-repair-reset-needs-dirty-tree-signal.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0130-dr065-auto-repair-reset-needs-dirty-tree-signal.md:2: id: BL-0130

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0130-dr065-auto-repair-reset-needs-dirty-tree-signal.md:5: title: "DR-065 auto-repair's hard-reset-to-last_green_sha checks only ancestry, not whether there is actually WIP to discard"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0130-dr065-auto-repair-reset-needs-dirty-tree-signal.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0130-dr065-auto-repair-reset-needs-dirty-tree-signal.md:10: source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred, translated from Spanish) — DR-065's foundation self-repair recipe resets HARD to last_green_sha after verifying only that it is an ANCESTOR of HEAD. Ancestry alone is not enough: on personal-page-v2 that SHA was from 2026-09-08 with ~30 verified commits on top of it and a fully clean tree (zero half-built surfaces) — the recipe would have discarded verified work, not WIP. The real trigger for a reset should be 'does half-built surface actually exist?' (a dirty git status / files belonging to the failed surface), not just ancestry."


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0131-schedulewakeup-heartbeat-can-silently-lapse.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0131-schedulewakeup-heartbeat-can-silently-lapse.md:2: id: BL-0131

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0131-schedulewakeup-heartbeat-can-silently-lapse.md:5: title: "implement's supervisor lease-renewal heartbeat chained via ScheduleWakeup can silently stop re-firing -- fold renewal into the Monitor loop instead"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0131-schedulewakeup-heartbeat-can-silently-lapse.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0131-schedulewakeup-heartbeat-can-silently-lapse.md:58: ## Corroborating occurrence (2026-09-22, mission-control speed-sprint canary A, run wf_4cef213a-463)


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0132-processchange-never-stamps-honest-gate-status.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0132-processchange-never-stamps-honest-gate-status.md:2: id: BL-0132

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0132-processchange-never-stamps-honest-gate-status.md:5: title: "DR-069's processChange creates FRD/WOs that stay DRAFT forever, bricking every future preflight if the gate later blocks"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0132-processchange-never-stamps-honest-gate-status.md:6: status: open


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:2: id: BL-0133

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:5: title: "merge-queue.sh calls verify.sh with no PORT override, so a stale dev server on the shared reserved port produces a misleading wide failure spray"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:10: source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred) — merge-queue.sh calls `bash .pandacorp/verify.sh` with no PORT override, so when the shared MAIN checkout already has a dev server bound to the reserved port (very likely with many parallel worktree sessions active), Playwright's reuseExistingServer:true silently reuses THAT server instead of building the worktree's own branch, producing a wide, misleading spray of unrelated e2e/visual failures across routes the change never touched. Exporting PORT=<free-port> before calling merge-queue.sh collapsed the SAME merge attempt from 27 failures to exactly the 2 routes actually affected."

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:16: `plugin/templates/shared/.pandacorp/merge-queue.sh` invokes `bash .pandacorp/verify.sh` without

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:23: routes genuinely affected once `PORT=<free-port>` was exported manually before calling `merge-queue.sh`.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:25: collision looks like a regression), newly located inside the shared `merge-queue.sh` template itself.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:28: `merge-queue.sh` has no logic to detect an already-bound dev server on the project's reserved port, nor

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:29: does it pick/export a free `PORT` before delegating to `verify.sh` — it silently inherits whatever port

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:30: `verify.sh`'s Playwright config defaults to, which collides with any other dev server already running on

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:34: In `plugin/templates/shared/.pandacorp/merge-queue.sh`, before calling `verify.sh`: check whether the

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:36: so, pick a free port and `export PORT=<free-port>` for the `verify.sh` invocation, so the gate always

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:40: Fixture: bind a dummy listener on the project's reserved port, then run `merge-queue.sh` against a branch

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:41: with an unrelated real content change. RED (current script): `verify.sh` reuses the dummy/foreign server

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:43: `merge-queue.sh` detects the collision, exports a free `PORT`, and `verify.sh` correctly builds/serves the

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:47: `merge-queue.sh` always exports a free `PORT` when the reserved port is already bound; the new test

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0133-merge-queue-sh-missing-port-override.md:52: Any other `merge-queue.sh` false-positive class already tracked separately (e.g. the untracked-file exit-12


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:2: id: BL-0136

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:5: title: "run-engine-tests.sh's EXPLICIT_SH_SUITES allowlist is missing 9 of the hooks' own test-*.sh suites"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:10: source: "docs/proposals/37-fast-change-path-and-implement-cost.md speed sprint; LESSON-0151, LESSON-0184"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:19: `integration-speed-sprint-a` branch: `plugin/scripts/run-engine-tests.sh` comment "the narrower sibling

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:22: `integration-speed-sprint-a`):

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:23: `EXPLICIT_SH_SUITES=(test-verify-gate-report.sh test-verify-before-stop.sh test-classify-change.sh)`.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:25: integration-speed-sprint-a:plugin/scripts/<name>` on each) to also exist but be ABSENT from the array:

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0136-run-engine-tests-explicit-sh-suites-missing-nine-hook-tests.md:37: mechanism (WP-05's `test-verify-gate-report.sh`, E3's `test-verify-before-stop.sh`, F1's


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0137-mc-fragua-timeline-missing-speed-sprint-observability-fields.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0137-mc-fragua-timeline-missing-speed-sprint-observability-fields.md:2: id: BL-0137

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0137-mc-fragua-timeline-missing-speed-sprint-observability-fields.md:5: title: "La Fragua timeline doesn't render UiPassSkipped/GateEvidenceFallback or surface per-agent/phase cost, concurrency_max, or change-queue age"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0137-mc-fragua-timeline-missing-speed-sprint-observability-fields.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0137-mc-fragua-timeline-missing-speed-sprint-observability-fields.md:16: The 2026-09 implement-speed sprint adds new observability the build engine emits (`UiPassSkipped` and


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:2: id: BL-0139

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:5: title: "_responsive-helper.ts's document.fonts.ready await has no timeout, producing a ~30s flake in long verify.sh suites"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:10: source: "observed live 2026-09-21 in mission-control, /proposals route, verify.sh run; isolated re-run passed 4/4"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:18: 2026-09-21 in `mission-control` on the `/proposals` route during a full `verify.sh` run: the step

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:21: dependent flake — the failure mode this project's own `quality-and-testing.md` rule ("No hard waits...

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:30: BOUNDS this specific await. Under a long `verify.sh` suite's resource contention, font loading can

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:33: fonts — costing debugging time on top of the flake itself.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:53: times) to confirm the flake clears; note in the commit if it could not be reproduced deterministically

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0139-responsive-helper-fonts-ready-unbounded-wait-flakes-long-suites.md:54: (timing-dependent flakes sometimes can't be forced) and rely on the fixture tests as the primary proof.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0224-stack-a-template-e2e-files-fail-template-own-biome.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0224-stack-a-template-e2e-files-fail-template-own-biome.md:2: id: BL-0224

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0224-stack-a-template-e2e-files-fail-template-own-biome.md:5: title: "stack-a-nextjs template ships e2e/tokens.spec.ts and e2e/screenshot-prototype.mjs that fail the template's own biome.json"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0224-stack-a-template-e2e-files-fail-template-own-biome.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0224-stack-a-template-e2e-files-fail-template-own-biome.md:17: SAME template's `biome.json` under `--error-on-warnings` (the flag the canonical `verify.sh` uses). A project

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0224-stack-a-template-e2e-files-fail-template-own-biome.md:52: fresh `/pandacorp:upgrade` on a project installs both e2e files and `verify.sh` stays green.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:2: id: BL-0227

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:5: title: "Fast-lane builder's self-verify pipes verify.sh through tail, masking a red gate as EXIT=0"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:16: The fast-lane builder (9.121.0 candidate, proposal 41 F-6) ran its own self-verify step as

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:17: `verify.sh ... | tail -15; echo EXIT=$?`. Without `pipefail`, `echo EXIT=$?` captures the exit status of the

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:18: immediately preceding command in the pipeline — `tail`, not `verify.sh` — so `EXIT=0` was reported even

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:26: Neither the builder agent's prompt nor the engine's generated self-verify instruction enforces

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:29: fast-lane builder's own generated self-verify block in `pandacorp-build.src.js`).

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:32: 1. Locate the fast-lane builder's self-verify instruction in `plugin/runtime/engine/pandacorp-build.src.js`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:33:    (or wherever the builder agent prompt embeds the "run verify.sh and report EXIT=" directive) and rewrite

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:43: `verify.sh` that exits 1 but prints >15 lines of readable passing-looking output on stdout before the failure

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:44: line — assert the generated self-verify instruction, when executed literally, reports the real non-zero

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0227-builder-piped-verify-masks-exit-code.md:52: Changing verify.sh's own output format.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0228-stop-hook-should-catch-uncommitted-memory-backlog-output.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0228-stop-hook-should-catch-uncommitted-memory-backlog-output.md:2: id: BL-0228

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0228-stop-hook-should-catch-uncommitted-memory-backlog-output.md:5: title: "No Stop-hook backstop catches a harvest/review pass that wrote to factory/memory or factory/backlog but never committed (BL-0089 pattern, execution-skip variant)"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0228-stop-hook-should-catch-uncommitted-memory-backlog-output.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0228-stop-hook-should-catch-uncommitted-memory-backlog-output.md:29: `verify-before-stop.sh` (which checks build-state claims) or `capture-lessons-reminder.sh` (which checks the


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0230-reverify-design-surfaces-after-claude-design-sunset.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0230-reverify-design-surfaces-after-claude-design-sunset.md:2: id: BL-0230

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0230-reverify-design-surfaces-after-claude-design-sunset.md:5: title: "After 2026-12-14, re-verify DesignSync, /design-sync and /design against the post-sunset reality and retire or re-point the LEGACY canvas procedure"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0230-reverify-design-surfaces-after-claude-design-sunset.md:6: status: open


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0233-design-verification-harness-missing-above-the-fold-imagery-check.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0233-design-verification-harness-missing-above-the-fold-imagery-check.md:2: id: BL-0233

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0233-design-verification-harness-missing-above-the-fold-imagery-check.md:5: title: "Design verification harness has no above-the-fold primary-content-imagery check for catalog/browse-type screens"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0233-design-verification-harness-missing-above-the-fold-imagery-check.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0233-design-verification-harness-missing-above-the-fold-imagery-check.md:31: The verification harness's existing checks all verify STRUCTURAL correctness (does the DOM render


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0236-design-skill-publish-flow-missing-not-yet-published-announcement.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0236-design-skill-publish-flow-missing-not-yet-published-announcement.md:2: id: BL-0236

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0236-design-skill-publish-flow-missing-not-yet-published-announcement.md:5: title: "Design skill's publish flow never announces a 'not yet published, pending verification' state"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0236-design-skill-publish-flow-missing-not-yet-published-announcement.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0236-design-skill-publish-flow-missing-not-yet-published-announcement.md:35:    ("finished, not yet published — verifying") before the gate resolves, rather than leaving the


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:2: id: BL-0241

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:5: title: "devops agent's brief should forbid wiring CI steps to binaries not yet installed at architecture time"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:10: source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): \"devops' first ci.yml called prisma/stryker binaries not yet installed, so knip turned verify.sh RED; the devops brief/template should say CI may only call scripts/binaries present in package.json at architecture time\""

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:20: `verify.sh` runs) report RED — not because the CI logic was wrong in intent, but because it referenced

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:40: 2. Cross-check this against `knip`'s role in `verify.sh` so the constraint is traceable to the gate it

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0241-devops-brief-must-pin-ci-to-installed-binaries.md:49:   `knip`/`verify.sh` stays GREEN on the resulting CI workflow.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0243-preflight-round-playwright-available-rejects-dir-module.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0243-preflight-round-playwright-available-rejects-dir-module.md:2: id: BL-0243

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0243-preflight-round-playwright-available-rejects-dir-module.md:5: title: "design skill's preflight-round.mjs reports 'browser unavailable' when PLAYWRIGHT_MODULE points at a package directory"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0243-preflight-round-playwright-available-rejects-dir-module.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0243-preflight-round-playwright-available-rejects-dir-module.md:42: 2. Verify the fix against BOTH forms of `PLAYWRIGHT_MODULE` (an explicit entry file, and a bare package


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:2: id: BL-0248

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:5: title: "merge-queue.sh treats untracked harness paths as a busy main; navigation-identity.json has no tracked-or-ignored decision"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:10: source: "funko-tracker architecture phase 2026-10-17: merge-queue.sh handed back with exit 12; docs/proposals/architecture-skill-v2.md"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:17: `plugin/templates/shared/.pandacorp/merge-queue.sh` refuses to land (exit 12, "the main checkout is busy") whenever

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:34: 1. `merge-queue.sh`: compute busy from TRACKED changes only (`git status --porcelain --untracked-files=no`), and

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:42: 4. Plugin PATCH bump (+ `OVERLAY_VERSION` PATCH since `merge-queue.sh` ships in the overlay) + decision-log.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:46: Extend `plugin/scripts/test-worktree-bootstrap.sh` (or a new `test-merge-queue.sh` opted into

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0248-merge-queue-busy-check-ignores-harness-paths.md:48: `.claude/worktrees/x/` and an untracked `.pandacorp/navigation-identity.json` → `merge-queue.sh` lands (RED today:


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0254-carry-over-beyond-published-pin-escalates-to-judge.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0254-carry-over-beyond-published-pin-escalates-to-judge.md:2: id: BL-0254

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0254-carry-over-beyond-published-pin-escalates-to-judge.md:5: title: "A relaunch with IN_REVIEW carry-over committed beyond a published last_green_sha still escalates to the judge baseline"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0254-carry-over-beyond-published-pin-escalates-to-judge.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0254-carry-over-beyond-published-pin-escalates-to-judge.md:20: full `verify.sh` can be red by construction for the same reason (knip: primitives whose consumers are later WOs), and


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:2: id: BL-0256

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:5: title: "merge-queue.sh never installs dependencies in main, so the first worktree landing that introduces/changes the stack leaves main's node_modules missing"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:10: source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 (agent-inferred) — after landing a worktree that installed the project's stack, the main checkout had no node_modules, and the Stop hook's verify.sh failed with \"biome not found\""

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:19: `plugin/templates/shared/.pandacorp/merge-queue.sh`, the main checkout itself is left with no

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:20: `node_modules` — because `merge-queue.sh` only fast-forwards/merges git refs, it never installs anything.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:21: The very next action against main (the Stop hook's `verify.sh`) then fails with a misleading error like

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:27: `grep -n "pnpm install" plugin/templates/shared/.pandacorp/merge-queue.sh` returns zero matches — the

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:35: 1. In `merge-queue.sh`, after a successful land into main, detect whether the landed diff touched

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:39: 2. As a cheaper defense-in-depth, consider having the Stop hook's `verify.sh` detect a missing

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:47: Extend the merge-queue test coverage (a new or existing `test-merge-queue.sh`, mirroring BL-0248's planned

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:49: dependency to `pnpm-lock.yaml` — after `merge-queue.sh` runs, `node_modules/.bin/<new-bin>` exists in

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0256-merge-queue-no-install-step-after-first-stack-land.md:60: Re-syncing every existing project's already-landed `merge-queue.sh` by hand (that is `/pandacorp:upgrade`'s


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0258-preflight-cwd-check-passes-for-lane-subpath.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0258-preflight-cwd-check-passes-for-lane-subpath.md:2: id: BL-0258

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0258-preflight-cwd-check-passes-for-lane-subpath.md:5: title: "preflight's session-cwd check PASSes for a lane-worktree subpath; engine does not verify a landed WO receipt's sha is an ancestor of main"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0258-preflight-cwd-check-passes-for-lane-subpath.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0258-preflight-cwd-check-passes-for-lane-subpath.md:44:    landed) must verify the receipt's reported sha is actually an ancestor of `main` (`git merge-base


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0262-architecture-consistency-gate-misses-under-declared-upstream-seams.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0262-architecture-consistency-gate-misses-under-declared-upstream-seams.md:2: id: BL-0262

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0262-architecture-consistency-gate-misses-under-declared-upstream-seams.md:5: title: "architecture plan's consistency gate should check that a WO consuming another FRD's engine declares every upstream file it must extend"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0262-architecture-consistency-gate-misses-under-declared-upstream-seams.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0262-architecture-consistency-gate-misses-under-declared-upstream-seams.md:42:    surface a WARN prompting the architecture agent to re-verify cross-FRD artifact declarations before


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:2: id: BL-0263

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:5: title: "verify.sh --since's vitest related-test selection is blind to a test that reads a changed file via fs, not import"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:10: source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred): a Codex-authored fidelity fix edited src/styles/*.css (a verbatim, byte-for-byte prototype port governed by ADR-0002); src/styles/_tests/styles.test.ts reads that CSS file from disk and compares it byte-for-byte rather than importing it, so verify.sh --since's import-graph-based related-test selection never ran it — the edit passed its own --since gate and the orchestrator's review, and only the full, unscoped Stop-gate verify.sh caught it. See LESSON-0437 for the generalized gotcha and LESSON-0442 for the incident this surfaced in."

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:17: `verify.sh --since <sha>`'s vitest scoping relies on vitest's own changed-file/related-test heuristic,

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:33: 1. In the stack-a template's `verify.sh` (and any other stack template with the same `--since` contract),

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0263-verify-since-blind-to-non-import-file-read-tests.md:45:   that source file and running `verify.sh --since <sha>` runs the comparison test. RED today (not


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:2: id: BL-0266

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:5: title: "verify-before-stop.sh produces a false red in a nested product-project worktree by resolving the wrong root"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:16: `plugin/scripts/verify-before-stop.sh`, run in a session whose cwd is a worktree of a nested product

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:17: project (`mission-control/.claude/worktrees/<name>`), ran `.pandacorp/verify.sh` against the FACTORY root

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:21: nested app correctly; `verify-before-stop.sh` does not follow the same resolution when it later fires as

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:25: `verify-before-stop.sh` locates the project's verify script via `verify="$cwd/.pandacorp/verify.sh"`,

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:27: to a `.pandacorp/verify.sh` that is the FACTORY's own (if `cwd` reported by the host is stale/wrong and

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:29: `verify.sh` logic does not account for running from inside a worktree of the NESTED project rather than

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:31: the gate ends up invoking pnpm/verify logic scoped to the factory root instead of

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:35: Make `verify-before-stop.sh` resolve the project root the same way `worktree-bootstrap.sh` does for a

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:37: `.pandacorp/verify.sh` and that project's own `package.json`/workspace marker, rather than trusting a

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:38: single-level `$cwd/.pandacorp/verify.sh` guess) before invoking the gate. Reuse the existing resolution

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:42: A test that invokes `verify-before-stop.sh` with a fixture `cwd` set to a nested-project worktree path

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:44: `.pandacorp/verify.sh`/package manifest, not the factory root's. RED = current script errors with

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:46: project's own verify script.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:49: `verify-before-stop.sh` resolves the correct nested-project root from a worktree cwd, the new test passes,

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0266-verify-before-stop-false-red-in-nested-project-worktree.md:54: same resolution logic into `verify-before-stop.sh`.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0275-process-change-agent-commits-before-gate.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0275-process-change-agent-commits-before-gate.md:2: id: BL-0275

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0275-process-change-agent-commits-before-gate.md:5: title: "A targeted run's process-change agent implemented and committed a fix itself before the readiness gate ran"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0275-process-change-agent-commits-before-gate.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0275-process-change-agent-commits-before-gate.md:39:    artifacts) — mirroring the "YOU VERIFY — YOU DO NOT STAMP" pattern already used elsewhere in the


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0278-shared-gitignore-missing-playwright-mcp-capture-dir.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0278-shared-gitignore-missing-playwright-mcp-capture-dir.md:2: id: BL-0278

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0278-shared-gitignore-missing-playwright-mcp-capture-dir.md:5: title: "The shared .gitignore template has no entry for .playwright-mcp/, so Biome lints the Playwright MCP tool's own untracked capture output and false-reds verify.sh"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0278-shared-gitignore-missing-playwright-mcp-capture-dir.md:6: status: open


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:2: id: BL-0281

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:5: title: "stack-a-nextjs verify.sh template has zero native-test-DB/INFRA-9/10 wiring (no db:test:up, no TEST_DATABASE_URL injection, no db:test:check-clean call)"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:10: source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred): 'la regla DR-140 pide db:test:check-clean en verify.sh pero la plantilla de verify.sh de la fábrica no lo llama'; confirmed live: `grep -n 'db:test\\|DATABASE_URL\\|TEST_DATABASE_URL' plugin/templates/stack-a-nextjs/verify.sh` returns zero matches"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:17: that every project's `verify.sh` gate: (a) stands up/tears down a native local Postgres via

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:21: tables. The canonical `verify.sh` template for stack A

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:22: (`plugin/templates/stack-a-nextjs/verify.sh`) has NONE of this — a repo-wide grep for

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:31: `plugin/templates/stack-a-nextjs/verify.sh` itself — the MUST-level gate behavior the standard describes

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:35: 1. Add to `plugin/templates/stack-a-nextjs/verify.sh`: before the DB-backed suites, ensure the native test

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:44:    `environment-delivery.md`/`stack-install.md`) — if so, just call them from `verify.sh`; if the

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:51: - A template-conformance/doc-lint style check (or a new one) that asserts `plugin/templates/stack-a-nextjs/verify.sh`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0281-stack-a-verify-sh-template-missing-native-test-db-and-check-clean.md:58: - [ ] `plugin/templates/stack-a-nextjs/verify.sh` stands up the native test DB, injects


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0282-block-dangerous-pkill-vitest-word-boundary-gap.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0282-block-dangerous-pkill-vitest-word-boundary-gap.md:2: id: BL-0282

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0282-block-dangerous-pkill-vitest-word-boundary-gap.md:5: title: "block-dangerous.sh SERVER_KILL_TARGETS regex does not catch `vitest` (word-boundary fails because `vite` is a literal prefix of `vitest`), allowing a host-wide `pkill -f vitest`"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0282-block-dangerous-pkill-vitest-word-boundary-gap.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0282-block-dangerous-pkill-vitest-word-boundary-gap.md:21: stack (every `verify.sh` DB-backed suite run) — is NOT matched: the regex's word-boundary requires a


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0284-new-version-budget-legacy-wo-normalization-stage.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0284-new-version-budget-legacy-wo-normalization-stage.md:2: id: BL-0284

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0284-new-version-budget-legacy-wo-normalization-stage.md:5: title: "new-version must budget a project-wide legacy work-order normalization stage before any v2 FRD can flip active on a brownfield project"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0284-new-version-budget-legacy-wo-normalization-stage.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0284-new-version-budget-legacy-wo-normalization-stage.md:37:    direct gate run) rather than always running it — a project already gate-clean should not pay this cost.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:2: id: BL-0289

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:5: title: "block-dangerous.sh's SERVER_KILL_TARGETS covers dev-server binaries but not named gate/orchestration scripts (verify.sh), so pkill -f verify.sh is still host-wide-kill allowed"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:19: factory's or a project's own named gate/orchestration SCRIPTS — `verify.sh`, `merge-queue.sh`, a

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:20: project's own build script, etc. An agent running `pkill -f verify.sh` to stop a hung local gate is

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:22: possibly running its own `verify.sh`) this kills every session's gate by command-line substring match,

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:28: or orchestration script invoked as `bash verify.sh` (or `./verify.sh`) has a command line containing

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:35:    orchestration script basenames (`verify.sh`, `merge-queue.sh`, `worktree-bootstrap.sh`, and any

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:46: - `plugin/scripts/test-block-dangerous.sh`: `pkill -f verify.sh` and `pkill -f merge-queue.sh` are

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0289-block-dangerous-pkill-named-gate-scripts-gap.md:47:   refused (RED today: allowed); `kill $PID` and `pkill -P $PID` against a verify.sh PID stay allowed.


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0292-upgrade-knip-overwrite-no-project-extension-escape.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0292-upgrade-knip-overwrite-no-project-extension-escape.md:2: id: BL-0292

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0292-upgrade-knip-overwrite-no-project-extension-escape.md:5: title: "/pandacorp:upgrade's unconditional knip.json conformance overwrite has no escape for a project's own entry/ignore globs, red-locking the gate"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0292-upgrade-knip-overwrite-no-project-extension-escape.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0292-upgrade-knip-overwrite-no-project-extension-escape.md:50:    — verify against the installed knip version's docs before committing to this path), matching the "separate


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:2: id: BL-0300

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:5: title: "Isolate Stop verification from merge-queue port ownership"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:19: `merge-queue: integration gate RED`. The owner reports verify-before-stop overlapping merge-queue on

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:20: that port. `plugin/scripts/verify-before-stop.sh:238` invokes the project verify script, while

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:33: 2. Inspect `plugin/scripts/verify-before-stop.sh`, the merge-queue gate launcher and bootstrap port configuration; coordinate verification ownership or allocate isolated gate ports and build outputs.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0300-isolate-stop-gate-from-merge-queue-port.md:39: Extend `plugin/scripts/test-verify-before-stop.sh` and the queue launcher tests. Start concurrent


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0305-nudge-explicit-lesson-citation-in-build-prompts.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0305-nudge-explicit-lesson-citation-in-build-prompts.md:2: id: BL-0305

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0305-nudge-explicit-lesson-citation-in-build-prompts.md:5: title: "Nudge implementer/reviewer prompts to cite LESSON-NNNN explicitly so the citation counter is trustworthy"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0305-nudge-explicit-lesson-citation-in-build-prompts.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0305-nudge-explicit-lesson-citation-in-build-prompts.md:44: citation nudge; manually verify on the next real `/pandacorp:implement` run that at least one produced


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:2: id: BL-0309

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:5: title: "Confirm whether worktree-bootstrap.sh's skip-worktree bits block green-stamp.sh's certified-tree fast path for lane gates"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:10: source: "funko-tracker .pandacorp/run/lessons.md 2026-11-10 (agent-inferred, UNVERIFIED in this harvest session): 'worktree-bootstrap.sh sets skip-worktree on launch.json/e2e/server-env.json so green-stamp never certifies a worktree tree -> merge-queue always re-runs the full gate.'"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:18: convenience, `.pandacorp/green-stamp.sh`'s "certified tree" check (which explicitly requires "no

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:19: skip-worktree/assume-unchanged entries," per `plugin/templates/shared/.pandacorp/green-stamp.sh` line 14)

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:22: worktree-based build lane, forcing `merge-queue.sh` to always run the full integration gate on landing.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:24: **This is NOT yet confirmed.** A partial read of `plugin/templates/shared/.pandacorp/merge-queue.sh`

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:28: WORKER'S OWN in-lane gate run (e.g. a Stop-hook-triggered `verify.sh` inside the worktree, before landing)

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:29: can ever produce a valid green-stamp while `worktree-bootstrap.sh`'s skip-worktree bits are still set for

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:35: unconditionally for local-dev PORT overrides; `green-stamp.sh`'s certification check treats ANY

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:41:    `verify.sh` inside a freshly-bootstrapped lane worktree, let it go green, then run

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:42:    `.pandacorp/green-stamp.sh check` in that same worktree and record whether it certifies or refuses

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:45:    (a) have `green-stamp.sh` explicitly exempt the two bootstrap-owned paths it recognizes as

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:49:    OWN pre-land Stop-hook check (distinct from the already-handled merge-queue landing path).

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:50: 3. If NOT confirmed as a gap (i.e., the existing per-path skip-worktree clearing merge-queue.sh already

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:55: - A `test-worktree-bootstrap.sh`/`test-merge-queue-certified-tree.sh` fixture that bootstraps a lane

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:57:   whichever fix direction is chosen) that `green-stamp.sh check` certifies that tree.

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:63: - [ ] If refuted: item closed noting why (e.g. the gap only existed at landing time and merge-queue.sh

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0309-worktree-skip-worktree-vs-green-stamp-certified-tree.md:68: part is working as intended, per BL-0288); changing the merge-queue's own landing-time skip-worktree


### /Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0330-block-dangerous-false-positive-on-quoted-analysis-text.md

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0330-block-dangerous-false-positive-on-quoted-analysis-text.md:2: id: BL-0330

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0330-block-dangerous-false-positive-on-quoted-analysis-text.md:5: title: "block-dangerous.sh's recursive-delete detector false-positives on pure read-only text analysis"

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0330-block-dangerous-false-positive-on-quoted-analysis-text.md:6: status: open

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0330-block-dangerous-false-positive-on-quoted-analysis-text.md:26: Both were BLOCKED with "recursive delete in a form this gate does not verify (find -delete, xargs,

/Users/Shared/Proyectos/panda-corp/factory/backlog/BL-0330-block-dangerous-false-positive-on-quoted-analysis-text.md:68: 3. Re-verify against the existing BL-0047/BL-0158/BL-0167 regression cases (prior false-positive fixes to

## 4. Playwright y Vitest por proyecto

Playwright tiene variantes por entorno/tier: no confundir workers globales con override serial por proyecto, ni declaraciones con casos multiplicados por viewport. Las fuentes completas siguientes permiten auditar los defaults y ramas. El conteo Vitest usa archivos *.test/ *.spec TS/JS fuera de e2e, node_modules, .next y .git; se informa además include/exclude real para contrastar el alcance.


### /Users/Shared/Proyectos/panda-corp/factory/portfolio.md

/Users/Shared/Proyectos/panda-corp/factory/portfolio.md:9: | PersonalPage v2 (Toshio.dev) | `../personal-page-v2/` | [repo](https://github.com/MineiToshio/personal-page-v2) | personal-page-v2 | release | sin datos | oportunidad + personal | **hold — sigue bloqueado por el mismo hallazgo operativo, no por señal de mercado.** Re-verificado en vivo 2026-09-07 (seis semanas después del hallazgo original del 2026-07-28, sin cambios en el bloqueo): `toshiominei.com` sigue sirviendo el **sitio viejo pre-rebuild** (proyectos jQuery-era: "GEOSERVICE", "SOUTHERN COPPER", "SCOTI CHATBOT" — no el contenido de este repo); `/en/projects` sigue devolviendo 404 en producción; `git log` no registra ningún commit de cutover DNS/Vercel. **Lo que sí cambió:** el build avanzó de verdad en los últimos días — `status.yaml` registró su primer gate completamente verde desde 2026-07-01 el 2026-09-06 (713 unit + 150 e2e), pasada de veracidad A5.1 corrigió seis afirmaciones exageradas en `/about` y los case studies, y `NEXT_PUBLIC_POSTHOG_KEY` ya tiene valor en `.env.local` (estaba vacía el 2026-08-31). Sigue sin poder leerse telemetría real de todos modos: la única org PostHog conectada a esta sesión sigue siendo "JobLeap AI". El proyecto está código-completo-adyacente pero le falta el ÚNICO paso que haría medible la ventana de 60 días del kill-signal: el cutover DNS/Vercel (gate humano de producción externa). Se mantiene **hold** — recomendación sin cambios: el owner necesita ejecutar (o agendar explícitamente) el cutover; el lado de construcción ya luce listo para eso — **Re-check 2026-09-21 (rutina programada):** SIN VEREDICTO NUEVO — precondición no cumplida: el `status.yaml` del proyecto (fuente de verdad) dice `phase: implementation`, no `release`; fila corregida. `toshiominei.com/en/projects` responde 200 pero sigue sirviendo el sitio viejo ("Southern Copper"), sin commit de cutover; PostHog conectado sigue siendo solo "JobLeap AI" → sin datos para este proyecto. Sin cambios de recomendación: hold; el owner decide el cutover. — **Re-check 2026-10-06 (rutina programada):** SIN VEREDICTO NUEVO — precondición aún no cumplida: `.pandacorp/status.yaml` sigue en `phase: implementation` (13/20 work orders done, 7 planned), no `release`; sin MCP de PostHog conectado en esta sesión → sin datos de verdad. **Hallazgo relevante (verificado en vivo, navegador real):** `toshiominei.com/en/projects` YA NO sirve el sitio viejo — ahora devuelve 200 con el contenido nuevo del rebuild (case studies "Pandacorp", "Work Connect", "Job Research"; "Southern Copper"/"Scoti Chatbot" aparecen en la sección Archive, no como listado principal), servido por Vercel (`server: Vercel`) con el CSP apuntando a `us.i.posthog.com` (coincide con `NEXT_PUBLIC_POSTHOG_KEY` ya seteada). El bloqueo de cutover DNS/Vercel que motivaba el hold desde 2026-07-28 **parece haberse resuelto** — pero `status.yaml` nunca se actualizó a `release` y no hay commit de cutover visible en `git log`, así que probablemente fue un deploy continuo de Vercel sirviendo `main` sin que el proyecto pasara por `/pandacorp:release`. Recomendación: el owner debería confirmar que el dominio en producción es intencional y correr `/pandacorp:release` para formalizar la fase (y conectar un MCP de PostHog para este proyecto) — así el próximo barrido ya puede leer métricas reales. Veredicto de negocio sin cambios: hold, sin datos todavía.  — **Release 2026-10-07 (`/pandacorp:release`):** v1.0.0 lanzado formalmente en https://toshiominei.com (`deploy_target: external`, Vercel). Construcción cerrada con hardening DR-085 (auditoría de seguridad 0 críticos tras subir Next a 16.3.7; analítica verificada: 9 eventos activos disparan), gate completo verde, smoke en producción verde. Desde aquí, `/pandacorp:review-launch` ya puede medir la ventana de 30/60 días (falta conectar un MCP de PostHog de este proyecto). Post-lanzamiento en cola: 2 cambios planificados (fecha `updated` en posts, portada en OG de casos de estudio) y deuda de readiness en 4 blueprints. — **Re-check 2026-10-12 (rutina programada `pandacorp-review-launch`):** **hold — demasiado pronto + sin fuente de datos conectada.** Verificado en vivo: `toshiominei.com/en/projects` responde `200` y sigue sirviendo el rebuild (case studies "Pandacorp"/"Work Connect"; "Southern Copper" en Archive) — el lanzamiento del 2026-10-07 se mantiene en pie, 5 días después. Precondición de fase cumplida (`status.yaml: phase: release`). Pero el gate de proveniencia del paso 2b de `/pandacorp:review-launch` no pasa: **ningún MCP de PostHog está conectado a esta sesión** (no aparece ni siquiera el de "JobLeap AI" que bloqueaba los barridos anteriores) → no se lee el proyecto PostHog id `427144` ("personal-page-v2", org "Panda Corp"); cae al camino de queries documentadas sin ejecutar. Además, a 5 días del lanzamiento, está muy por debajo de la ventana de 30 días de las métricas de éxito y de los 60 días del kill-signal de alcance del PRD — ni con datos reales habría veredicto hoy. La instrumentación en sí no es el problema: los 10 eventos del catálogo están verificados disparando en producción (`docs/analytics/events.md`, verificación 2026-10-07). Recomendación sin cambios respecto al hold: (1) conectar un MCP de PostHog con alcance al proyecto `personal-page-v2`/org "Panda Corp" para que el próximo barrido lea números reales, o (2) a partir de 2026-11-06 (30 días) pegar manualmente el resultado del embudo crítico documentado en `docs/analytics/events.md` §"Critical-flow funnel". Nada que matar/archivar — sigue siendo demasiado temprano. — **Re-check 2026-10-19 (rutina programada `pandacorp-review-launch`):** **hold — sin cambios, demasiado pronto + sin fuente de datos.** Verificado en vivo (navegador real): `toshiominei.com/en/projects` responde `200` y sigue sirviendo el rebuild (case studies "Pandacorp"/"Work Connect"/"Job Research"; "Southern Copper"/"Scoti Chatbot" en Archive) — el lanzamiento del 2026-10-07 se mantiene en pie, 12 días después. Precondición de fase cumplida (`status.yaml: phase: release`, `deploy_target: external`). Pero sigue sin haber ningún MCP de PostHog conectado a esta sesión (ni siquiera el de "JobLeap AI") → no se puede leer el proyecto PostHog id `427144` ("personal-page-v2", org "Panda Corp"); sin datos reales de nuevo. A 12 días del lanzamiento sigue muy por debajo tanto de la ventana de 30 días de las métricas de éxito del PRD como de los 60 días del kill-signal de alcance (0 contactos AND <100 visitantes únicos) — ni con datos reales habría veredicto hoy. Recomendación sin cambios: (1) conectar un MCP de PostHog con alcance a `personal-page-v2`/"Panda Corp" para que el próximo barrido lea números reales, o (2) esperar a 2026-11-06 (30 días) para pegar manualmente el resultado del embudo crítico documentado en `docs/analytics/events.md` §"Critical-flow funnel". Nada que matar/archivar. — **Re-check 2026-10-26 (rutina programada `pandacorp-review-launch`):** **hold — sin cambios, demasiado pronto + sin fuente de datos.** Verificado en vivo (navegador real): `toshiominei.com/en/projects` responde `200` y sigue sirviendo el rebuild (case studies "Pandacorp"/"Work Connect"/"Job Research"/"Alohub"/"Webveloper"/"Wozzii"; "Southern Copper"/"Scoti Chatbot"/"Bildin" en Archive) — el lanzamiento del 2026-10-07 se mantiene en pie, 19 días después. Precondición de fase cumplida (`status.yaml: phase: release`, `deploy_target: external`). Sigue sin haber ningún MCP de PostHog conectado a esta sesión → no se puede leer el proyecto PostHog id `427144` ("personal-page-v2", org "Panda Corp"); sin datos reales de nuevo. A 19 días del lanzamiento todavía está por debajo tanto de la ventana de 30 días de las métricas de éxito del PRD (faltan 11 días, cumple 2026-11-06) como de los 60 días del kill-signal de alcance (0 contactos AND <100 visitantes únicos, cumple 2026-12-06) — ni con datos reales habría veredicto hoy. Recomendación sin cambios: (1) conectar un MCP de PostHog con alcance a `personal-page-v2`/"Panda Corp" para que el próximo barrido lea números reales, o (2) esperar a 2026-11-06 (30 días) para pegar manualmente el resultado del embudo crítico documentado en `docs/analytics/events.md` §"Critical-flow funnel". Nada que matar/archivar. — **Re-check 2026-11-03 (rutina programada `pandacorp-review-launch`):** **hold — sin cambios, demasiado pronto + sin fuente de datos.** Verificado en vivo (navegador real): `toshiominei.com/en/projects` responde `200` y sigue sirviendo el rebuild (case studies "Pandacorp"/"Work Connect"/"Job Research"/"Alohub"/"Webveloper"/"Wozzii"; "Southern Copper"/"Scoti Chatbot"/"Bildin" en Archive) — el lanzamiento del 2026-10-07 se mantiene en pie, 27 días después. Precondición de fase cumplida (`status.yaml: phase: release`, `deploy_target: external`). Gate de proveniencia (paso 2b) verificado explícitamente en esta sesión vía `session_connectors_status`: los únicos MCP conectados son `rea`, Notion, Claude Docs y `scheduled-tasks` — **ningún MCP de PostHog conectado** (ni siquiera el de "JobLeap AI" de barridos anteriores) → no se puede leer el proyecto PostHog id `427144`; cae al camino de queries documentadas sin ejecutar, sin datos reales de nuevo. A 27 días del lanzamiento todavía está por debajo de la ventana de 30 días de las métricas de éxito del PRD (faltan 3 días, cumple 2026-11-06) y muy por debajo de los 60 días del kill-signal de alcance (0 contactos AND <100 visitantes únicos, cumple 2026-12-06) — ni con datos reales habría veredicto hoy. Recomendación sin cambios: (1) conectar un MCP de PostHog con alcance a `personal-page-v2`/"Panda Corp" para que el próximo barrido lea números reales, o (2) esperar a 2026-11-06 (30 días) para pegar manualmente el resultado del embudo crítico documentado en `docs/analytics/events.md` §"Critical-flow funnel". Nada que matar/archivar. — **Re-check 2026-11-09 (rutina programada `pandacorp-review-launch`):** **hold — sin cambios, sin fuente de datos (ya venció la ventana de 30 días).** Verificado en vivo (navegador real): `toshiominei.com/en/projects` responde `200` y sigue sirviendo el rebuild (case studies "Pandacorp"/"Work Connect"/"Job Research"; "Southern Copper" en Archive) — el lanzamiento del 2026-10-07 se mantiene en pie, 33 días después. Precondición de fase cumplida (`status.yaml: phase: release`, `deploy_target: external`, sin cambios desde el último barrido). Gate de proveniencia (paso 2b) verificado explícitamente en esta sesión vía `session_connectors_status`: los únicos MCP conectados son `rea`, Notion, Claude Docs, Sentry y `scheduled-tasks` — **ningún MCP de PostHog conectado** → no se puede leer el proyecto PostHog id `427144`; `docs/analytics/events.md` §"Critical-flow funnel" tampoco tiene ningún resultado pegado a mano → sin datos reales, otra vez. **Cambio de hecho respecto a barridos anteriores:** la ventana de 30 días de las métricas de éxito del PRD ya venció (cumplía 2026-11-06, hoy son 33 días) sin que se haya podido medir nada — la ventana de 60 días del kill-signal de alcance (0 contactos AND <100 visitantes únicos) sigue abierta hasta 2026-12-06. Sin telemetría no hay manera honesta de dar un veredicto nuevo (regla: leer real o vacío honesto). Recomendación sin cambios: (1) conectar un MCP de PostHog con alcance a `personal-page-v2`/"Panda Corp", o (2) pegar manualmente en `docs/analytics/events.md` el resultado del embudo crítico desde el dashboard de PostHog. Nada que matar/archivar — la decisión de archivar por falta de señal, si llega, es del owner cuando venza la ventana de 60 días sin datos. — **Re-check 2026-11-16 (rutina programada `pandacorp-review-launch`):** **hold — sin cambios, sin fuente de datos.** Verificado en vivo (`session_connectors_status`): los únicos MCP conectados a esta sesión son `rea`, Notion, Claude Docs, Sentry y `scheduled-tasks` — **ningún MCP de PostHog**. Revisados `.pandacorp/comms/` y `docs/analytics/events.md` del proyecto buscando algún resultado de embudo pegado a mano por el owner: no hay ninguno. Precondición de fase sigue cumplida (`status.yaml: phase: release`, `deploy_target: external`). El lanzamiento del 2026-10-07 lleva 40 días: la ventana de 30 días de las métricas de éxito del PRD sigue vencida sin medición (desde 2026-11-06); la ventana de 60 días del kill-signal de alcance (0 contactos AND <100 visitantes únicos) vence en 20 días, el 2026-12-06. Sin telemetría conectada no hay veredicto nuevo honesto que dar. Recomendación sin cambios: (1) conectar un MCP de PostHog con alcance a `personal-page-v2`/"Panda Corp" (proyecto PostHog id `427144`), o (2) pegar manualmente en `docs/analytics/events.md` el resultado del "Critical-flow funnel" desde el dashboard de PostHog antes del 2026-12-06. Nada que matar/archivar todavía. | 2026-10-10 |

/Users/Shared/Proyectos/panda-corp/factory/portfolio.md:12: | Funko Tracker | `../funko-tracker/` | [repo](https://github.com/MineiToshio/funko-tracker) | funko-tracker | product | — | personal + oportunidad | **hold — sin fuente de datos conectada + no está claro si arrancó el reloj del kill-signal.** Primer `/pandacorp:review-launch` de este proyecto, 2026-11-16 (rutina programada). **Hallazgo:** la columna "Fase" de esta fila está desincronizada — dice `product` pero el `.pandacorp/status.yaml` real del proyecto (fuente de verdad) dice `phase: release`, `created_via: scaffold`, 62/65 work orders VERIFIED (2 blocked, 1 in_review), construcción activa hasta 2026-11-15 (iteración post-lanzamiento normal, DR-085); correr `/pandacorp:sync-portfolio` para corregir esa columna. Con la precondición de fase cumplida, se corrió review-launch: telemetría SÍ existe (`docs/analytics/events.md`, PostHog Cloud US proyecto "Funko Tracker" id `718854`, cookieless, SIN cookies/perfiles — el documento mismo nota "Independent review and final integration gate remain open"), pero **ningún MCP de PostHog está conectado a esta sesión** (`session_connectors_status`: solo `rea`, Notion, Claude Docs, Sentry, `scheduled-tasks`) → sin datos reales, cae al camino de queries documentadas sin ejecutar. Además no se encontró ningún registro de la fecha de **lanzamiento público a la audiencia de @pandadcollector** (el evento que arranca la ventana de 60 días del kill-signal 1/2 del PRD: <20 usuarios activados o <30 exportaciones de checklist en 60 días) — solo hay despliegue continuo a producción (`https://funko.pandatrack.app`, ADR-0018 main=producción) sin un anuncio distinto registrado. Con el proyecto todavía en construcción activa y sin esa fecha clara, es demasiado pronto para un veredicto aunque hubiera datos. Recomendación: (1) conectar un MCP de PostHog con alcance al proyecto "Funko Tracker" (id `718854`), y (2) que el owner confirme/registre la fecha real de lanzamiento público a la audiencia, para que el próximo barrido pueda medir la ventana de 60 días con una fecha de inicio real. Nada que matar/archivar — demasiado pronto. | 2026-10-12 |

### /Users/Shared/Proyectos/panda-corp/mission-control


### /Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:1: import fs from "node:fs";

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:2: import path from "node:path";

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:3: import { defineConfig, devices, type Project } from "@playwright/test";

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:4: 

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:5: /**

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:6:  * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074) +

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:7:  * Shell-Presence Gate (DR-075) + the Production-Build Smoke (proposal 40, PANDACORP_PROD_SMOKE). VERBATIM stack template (DR-059) — at the project ROOT, conformance-checked by

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:8:  * /pandacorp:upgrade. Deterministic by construction: single worker, animations disabled, caret

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:9:  * hidden, fonts settled before each shot, retries OFF (a retry re-creates a missing baseline → the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:10:  * gate fails OPEN; DR-056 forbids it). In CI baselines are frozen (`updateSnapshots:'none'`);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:11:  * locally a NEW route's baseline is written once and must then be reviewed/blessed by the FRD gate.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:12:  *

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:13:  * The dev server runs on the project's reserved dev port (factory/standards/infra.md). Adjust PORT

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:14:  * to this project's `dev_port_base` if it differs from the default below.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:15:  *

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:16:  * Deterministic data sources (OPTIONAL): a project-local `e2e/server-env.json` — never part of the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:17:  * template, never overwritten by /pandacorp:upgrade — is injected into the webServer environment.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:18:  * It is the hook for pinning the app's data sources to frozen fixtures so LIVE data can never move

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:19:  * gate pixels. Values starting with "." resolve against the project root; a `PORT` entry moves the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:20:  * e2e server to its own port. When the file is present the server is NEVER reused — an

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:21:  * already-running dev server would read live data instead of the pinned fixture.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:22:  *

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:23:  * Parallel tier (OPTIONAL, DR-143): a project-local `e2e/parallel-safe.json` — never part of the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:24:  * template, never overwritten by /pandacorp:upgrade — lists the spec files (relative to e2e/) proven

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:25:  * to write nothing a sibling spec reads. The full `verify.sh` uses a single combined run: parallel projects first, then

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:26:  * desktop and mobile serial projects in dependency order, sharing one owned server. Serial is the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:27:  * default: a spec that is not listed keeps the determinism above, and with no file nothing changes.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:28:  * The visual gate may never be listed, because pixel baselines require a single worker (DR-056).

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:29:  *

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:30:  * Production-build server (OPTIONAL, DR-143): a project-local `e2e/prod-server.mjs` — seed, never

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:31:  * overwritten — takes `build` or `start <port>` and owns the project's fixture environment. The full

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:32:  * `verify.sh` builds once and sets PANDACORP_E2E_SERVER=prod, so every project shares one artifact and one server. Manual

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:33:  * and `--since` runs stay on `next dev`, and so does any project without the seed.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:34:  *

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:35:  * A project-local `e2e/globalSetup.ts` (optional, seed) is wired in when present, so a project can

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:36:  * hold a machine-wide test lease without forking this file.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:37:  */

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:38: const isCI = Boolean(process.env.CI);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:39: 

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:40: const SERVER_ENV_FILE = path.resolve("e2e", "server-env.json");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:41: const serverEnv: Record<string, string> = fs.existsSync(SERVER_ENV_FILE)

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:42:   ? Object.fromEntries(

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:43:       Object.entries(

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:44:         JSON.parse(fs.readFileSync(SERVER_ENV_FILE, "utf8")) as Record<string, string>,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:45:       ).map(([key, value]) => [key, value.startsWith(".") ? path.resolve(value) : value]),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:46:     )

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:47:   : {};

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:48: 

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:49: // Build lanes (proposal 40 Phase B): a lane worktree carries its own `.pandacorp/run/lane.env` (PANDACORP_LANE and the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:50: // lane's PORT), written by the build engine. It is read from DISK, not only from the shell env: a builder's fresh shell

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:51: // never sourced it, and an e2e on the default port would test a sibling lane's (or main's) server.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:52: const LANE_ENV_FILE = path.resolve(".pandacorp", "run", "lane.env");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:53: const laneEnv: Record<string, string> = fs.existsSync(LANE_ENV_FILE)

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:54:   ? Object.fromEntries(

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:55:       fs

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:56:         .readFileSync(LANE_ENV_FILE, "utf8")

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:57:         .split("\n")

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:58:         .map((line) => /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim()))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:59:         .filter((m): m is RegExpExecArray => m !== null)

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:60:         .map((m) => [m[1], m[2]]),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:61:     )

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:62:   : {};

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:63: 

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:64: const PORT = Number(serverEnv.PORT ?? laneEnv.PORT ?? process.env.PORT) || 3000;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:65: const BASE_URL = `http://127.0.0.1:${PORT}`;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:66: // Production-Build Smoke (proposal 40): the build engine sets PANDACORP_PROD_SMOKE in a detached worktree, so the

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:67: // server is the production artifact (`next build && next start`, its real CSP), never a reused dev server.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:68: const PROD_SMOKE = Boolean(process.env.PANDACORP_PROD_SMOKE);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:69: // In a lane (its lane.env, or PANDACORP_LANE in the env) the e2e never reuses a server a sibling lane or main left running.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:70: const LANE = Boolean(laneEnv.PANDACORP_LANE || process.env.PANDACORP_LANE);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:71: 

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:72: const PARALLEL_SAFE_FILE = path.resolve("e2e", "parallel-safe.json");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:73: const readParallelSafe = (): string[] => {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:74:   if (!fs.existsSync(PARALLEL_SAFE_FILE)) return [];

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:75:   const specs: unknown = JSON.parse(fs.readFileSync(PARALLEL_SAFE_FILE, "utf8"));

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:76:   if (!Array.isArray(specs))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:77:     throw new Error("e2e/parallel-safe.json must be a JSON array of spec paths");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:78:   return specs.map((spec) => {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:79:     if (typeof spec !== "string" || !fs.existsSync(path.resolve("e2e", spec))) {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:80:       throw new Error(`e2e/parallel-safe.json lists a spec that does not exist: ${String(spec)}`);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:81:     }

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:82:     if (!/^[\w./-]+\.spec\.ts$/.test(spec) || spec.split("/").includes(".."))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:83:       throw new Error(`Unsafe parallel spec path: ${spec}`);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:84:     if (spec === "visual.spec.ts")

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:85:       throw new Error("visual.spec.ts must stay on one worker (DR-056)");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:86:     return `**/e2e/${spec}`;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:87:   });

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:88: };

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:89: const GATE_PROD = process.env.PANDACORP_E2E_SERVER === "prod";

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:90: if (GATE_PROD && !fs.existsSync(path.resolve("e2e", "prod-server.mjs"))) {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:91:   throw new Error("PANDACORP_E2E_SERVER=prod needs e2e/prod-server.mjs");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:92: }

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:93: const TIER = process.env.PANDACORP_E2E_TIER;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:94: if (TIER !== undefined && TIER !== "parallel" && TIER !== "serial" && TIER !== "combined") {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:95:   throw new Error(`Unknown PANDACORP_E2E_TIER: ${TIER}`);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:96: }

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:97: const PARALLEL_SAFE = readParallelSafe();

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:98: const PARALLEL_WORKERS = Number(process.env.PANDACORP_E2E_WORKERS) || 3;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:99: const GLOBAL_SETUP = path.resolve("e2e", "globalSetup.ts");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:100: // An upgrade without a reviewed inventory preserves DR-143's complete mobile selection.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:101: // Reviewed inventories exclude only named duplicates; unknown/new specs stay on mobile.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:102: const MOBILE_FILE = path.resolve("e2e", "mobile-specs.json");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:103: const MOBILE_CORE = ["smoke.spec.ts", "visual.spec.ts", "responsive.spec.ts"];

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:104: const LEGACY_MOBILE_IGNORE = ["shell.spec.ts", "headers.spec.ts", "hydration.spec.ts"];

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:105: const readMobileExclusions = (): string[] => {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:106:   if (!fs.existsSync(MOBILE_FILE)) return LEGACY_MOBILE_IGNORE;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:107:   const inventory: unknown = JSON.parse(fs.readFileSync(MOBILE_FILE, "utf8"));

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:108:   if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:109:     throw new Error(

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:110:       "e2e/mobile-specs.json needs a reviewed {include, desktopOnly, review} inventory",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:111:     );

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:112:   const { include, desktopOnly, review, ...unknown } = inventory as Record<string, unknown>;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:113:   if (

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:114:     !Array.isArray(include) ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:115:     !Array.isArray(desktopOnly) ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:116:     Object.keys(unknown).length ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:117:     typeof review !== "string" ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:118:     !/^docs\/reviews\/[\w./-]+\.md$/.test(review) ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:119:     review.split("/").includes("..") ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:120:     !fs.existsSync(path.resolve(review))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:121:   )

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:122:     throw new Error(

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:123:       "Mobile coverage reductions require a valid review document and classified spec lists",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:124:     );

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:125:   for (const spec of [...include, ...desktopOnly]) {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:126:     if (

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:127:       typeof spec !== "string" ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:128:       !/^[\w./-]+\.spec\.ts$/.test(spec) ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:129:       spec.split("/").includes("..") ||

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:130:       !fs.existsSync(path.resolve("e2e", spec))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:131:     )

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:132:       throw new Error(`Invalid mobile spec: ${String(spec)}`);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:133:   }

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:134:   if (desktopOnly.some((spec) => include.includes(spec) || MOBILE_CORE.includes(spec)))

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:135:     throw new Error("Mobile core and included specs cannot be excluded");

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:136:   return desktopOnly as string[];

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:137: };

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:138: const MOBILE_IGNORE = readMobileExclusions().map((spec) => `**/e2e/${spec}`);

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:139: const MOBILE_PARALLEL = PARALLEL_SAFE.filter((spec) => !MOBILE_IGNORE.includes(spec));

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:140: const TIER_IGNORE = TIER === "serial" || TIER === "combined" ? PARALLEL_SAFE : [];

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:141: const COMBINED = TIER === "combined" && PARALLEL_SAFE.length > 0;

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:142: const DIAGNOSTIC = process.env.PANDACORP_VERIFY_NO_BAIL === "1";

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:143: // Dependencies require SUCCESS, so diagnostics omit them and use one global worker.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:144: // All projects then run even on red, without overlapping shared-state readers/writers.

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:145: const parallelProjects: (Project & { name: string })[] = COMBINED

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:146:   ? [

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:147:       {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:148:         name: "desktop-parallel",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:149:         testMatch: PARALLEL_SAFE,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:150:         use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:151:       },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:152:       {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:153:         name: "mobile-parallel",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:154:         testMatch: MOBILE_PARALLEL,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:155:         use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:156:       },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:157:     ]

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:158:   : [];

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:159: 

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:160: export default defineConfig({

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:161:   testDir: "./e2e",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:162:   ...(TIER === "parallel" ? { testMatch: PARALLEL_SAFE } : {}),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:163:   ...(fs.existsSync(GLOBAL_SETUP) ? { globalSetup: "./e2e/globalSetup.ts" } : {}),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:164:   fullyParallel: false,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:165:   workers: COMBINED && DIAGNOSTIC ? 1 : TIER === "parallel" || COMBINED ? PARALLEL_WORKERS : 1,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:166:   maxFailures: process.env.PANDACORP_E2E_CERTIFICATION === "1" && !DIAGNOSTIC ? 1 : 0,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:167:   forbidOnly: isCI,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:168:   retries: 0,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:169:   reporter: [["list"]],

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:170:   updateSnapshots: isCI ? "none" : "missing",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:171:   use: { baseURL: BASE_URL, trace: "off" },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:172:   expect: {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:173:     toHaveScreenshot: {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:174:       maxDiffPixelRatio: 0.02,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:175:       threshold: 0.2,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:176:       animations: "disabled",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:177:       caret: "hide",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:178:     },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:179:   },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:180:   projects: [

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:181:     ...parallelProjects,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:182:     {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:183:       name: "desktop",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:184:       ...(COMBINED

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:185:         ? {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:186:             workers: 1,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:187:             ...(DIAGNOSTIC

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:188:               ? {}

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:189:               : { dependencies: parallelProjects.map((project) => project.name) }),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:190:           }

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:191:         : {}),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:192:       testIgnore: TIER_IGNORE,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:193:       use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:194:     },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:195:     {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:196:       name: "mobile",

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:197:       ...(TIER === "parallel" ? { testMatch: MOBILE_PARALLEL } : {}),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:198:       testIgnore: [...TIER_IGNORE, ...MOBILE_IGNORE],

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:199:       ...(COMBINED ? { workers: 1, ...(DIAGNOSTIC ? {} : { dependencies: ["desktop"] }) } : {}),

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:200:       use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:201:     },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:202:   ],

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:203:   webServer: {

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:204:     command: GATE_PROD

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:205:       ? `node e2e/prod-server.mjs start ${PORT}`

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:206:       : PROD_SMOKE

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:207:         ? `next build && next start --hostname 127.0.0.1 --port ${PORT}`

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:208:         : `next dev --hostname 127.0.0.1 --port ${PORT}`,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:209:     url: BASE_URL,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:210:     reuseExistingServer:

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:211:       process.env.PANDACORP_E2E_CERTIFICATION !== "1" &&

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:212:       !PROD_SMOKE &&

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:213:       !GATE_PROD &&

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:214:       !LANE &&

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:215:       !isCI &&

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:216:       Object.keys(serverEnv).length === 0,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:217:     timeout: PROD_SMOKE ? 600_000 : 180_000,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:218:     env: serverEnv,

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:219:   },

/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts:220: });


### /Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:1: import react from "@vitejs/plugin-react";

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:2: import { defineConfig } from "vitest/config";

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:3: import { pandacorpVitest } from "./.pandacorp/vitest-policy";

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:4: import domSpecs from "./scripts/test/dom-specs.json";

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:5: 

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:6: export default defineConfig(

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:7:   pandacorpVitest(

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:8:     {

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:9:       plugins: [react()],

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:10:       test: {

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:11:         globals: true,

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:12:         setupFiles: ["./vitest.setup.ts"],

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:13:         include: ["**/*.{test,spec}.{ts,tsx}"],

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:14:         // Runtime archives and worktrees are never part of the product test corpus.

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:15:         exclude: [

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:16:           "**/node_modules/**",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:17:           ".next",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:18:           "prototype",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:19:           "e2e/**",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:20:           "**/.claude/worktrees/**",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:21:           ".pandacorp/run/**",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:22:           ".stryker-tmp/**",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:23:           ".mutation-cache/**",

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:24:         ],

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:25:         // Raised from the default 5 000 ms to accommodate:

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:26:         //   - WO-13-003 large-list keyboard-nav stress test (1 100 fireEvent × 1 000 items in jsdom)

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:27:         //   - WO-13-002 adversarial tests that invoke npx @tailwindcss/cli (cold-cache download)

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:28:         // Per-test overrides can narrow this further when needed (see a11y-primitives.test.tsx).

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:29:         testTimeout: 120000,

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:30:       },

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:31:       resolve: {

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:32:         alias: {

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:33:           "@": new URL("./src/", import.meta.url).pathname,

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:34:         },

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:35:       },

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:36:     },

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:37:     { dom: domSpecs, domSetupFiles: ["./vitest.dom.setup.ts"] },

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:38:   ),

/Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.ts:39: );


### /Users/Shared/Proyectos/panda-corp/mission-control/vitest.config.mts

No existe este artefacto.


### /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:1: // Managed VERBATIM as .pandacorp/vitest-policy.ts (DR-159). Config stays project-owned.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:2: import type { ViteUserConfig as UserConfig } from "vitest/config";

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:3: 

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:4: export function pandacorpVitest(

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:5:   config: UserConfig = {},

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:6:   {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:7:     dom = [],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:8:     domSetupFiles = [],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:9:     defaultMaxWorkers,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:10:   }: { dom?: string[]; domSetupFiles?: string[]; defaultMaxWorkers?: number } = {},

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:11: ): UserConfig {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:12:   const { test = {}, ...shared } = config;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:13:   if (test.projects !== undefined) {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:14:     throw new Error("Migrate existing Vitest projects explicitly before adopting pandacorpVitest");

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:15:   }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:16:   const configured = process.env.PANDACORP_VITEST_MAX_WORKERS;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:17:   if (configured !== undefined && !/^[1-9]\d*$/.test(configured)) {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:18:     throw new Error("PANDACORP_VITEST_MAX_WORKERS must be a positive integer");

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:19:   }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:20:   const maxWorkers = configured === undefined ? defaultMaxWorkers : Number(configured);

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:21:   if (maxWorkers !== undefined && (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1)) {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:22:     throw new Error("Vitest maxWorkers must be a positive safe integer");

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:23:   }

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:24:   // Vitest 4+ native defaults; retain the project's explicit selection when present.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:25:   const include = test.include ?? ["**/*.{test,spec}.?(c|m)[jt]s?(x)"];

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:26:   const exclude = test.exclude ?? ["**/node_modules/**", "**/.git/**"];

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:27:   const setup =

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:28:     test.setupFiles === undefined

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:29:       ? []

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:30:       : typeof test.setupFiles === "string"

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:31:         ? [test.setupFiles]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:32:         : test.setupFiles;

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:33:   // Never extends:true: Vitest concatenates include AND globalSetup arrays, causing

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:34:   // duplicate tests/setup. Explicitly share config while keeping root globalSetup once.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:35:   const project = (

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:36:     name: string,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:37:     environment: "node" | "jsdom",

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:38:     selection: string[],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:39:     ignored: string[],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:40:     setupFiles: string[],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:41:   ) => ({

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:42:     ...shared,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:43:     test: {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:44:       ...test,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:45:       name,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:46:       environment,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:47:       isolate: true,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:48:       include: selection,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:49:       exclude: ignored,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:50:       projects: undefined,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:51:       // One root budget, including the env override; project caps otherwise take precedence.

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:52:       maxWorkers: undefined,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:53:       globalSetup: [],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:54:       setupFiles,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:55:     },

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:56:   });

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:57:   return {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:58:     ...shared,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:59:     test: {

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:60:       ...test,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:61:       include: [],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:62:       environment: "node",

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:63:       isolate: true,

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:64:       ...(maxWorkers === undefined ? {} : { maxWorkers }),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:65:       projects: [

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:66:         project("node", "node", include, [...exclude, ...dom], setup),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:67:         ...(dom.length

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:68:           ? [project("dom", "jsdom", dom, exclude, [...setup, ...domSetupFiles])]

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:69:           : []),

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:70:       ],

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:71:     },

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:72:   };

/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/vitest-policy.ts:73: }


### /Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:1: #!/usr/bin/env node

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:2: // DR-158: one production artifact for all browser projects, with the same fixture env at build/start.

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:3: import { spawn } from "node:child_process";

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:4: import fs from "node:fs";

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:5: import path from "node:path";

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:6: 

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:7: const action = process.argv[2];

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:8: if (action !== "build" && action !== "start")

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:9:   throw new Error("usage: prod-server.mjs build | start <port>");

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:10: const envFile = path.resolve("e2e/server-env.json");

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:11: const fixtureEnv = fs.existsSync(envFile) ? JSON.parse(fs.readFileSync(envFile, "utf8")) : {};

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:12: for (const [key, value] of Object.entries(fixtureEnv)) {

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:13:   if (typeof value !== "string") throw new Error(`Invalid server environment: ${key}`);

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:14:   fixtureEnv[key] = value.startsWith(".") ? path.resolve(value) : value;

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:15: }

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:16: const port = process.argv[3];

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:17: if (

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:18:   action === "start" &&

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:19:   (!port || !/^\d+$/.test(port) || Number(port) > 65535 || Number(port) < 1)

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:20: )

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:21:   throw new Error("start requires a valid port");

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:22: const child = spawn(

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:23:   process.execPath,

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:24:   [

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:25:     path.resolve("node_modules/next/dist/bin/next"),

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:26:     action,

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:27:     ...(action === "start" ? ["--hostname", "127.0.0.1", "--port", port] : []),

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:28:   ],

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:29:   {

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:30:     stdio: "inherit",

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:31:     env: { ...process.env, ...fixtureEnv, NODE_ENV: "production" },

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:32:   },

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:33: );

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:34: for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:35: child.on("error", (error) => {

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:36:   console.error(error);

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:37:   process.exitCode = 1;

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:38: });

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:39: child.on("exit", (code, signal) => {

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:40:   process.exitCode = code ?? (signal ? 1 : 0);

/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:41: });

```text
$ rg -c test\( /Users/Shared/Proyectos/panda-corp/mission-control/e2e
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/resumen-fragua.reviewer.spec.ts:18
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/commands.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/navigation-root.reviewer.spec.ts:5
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/ideas-board.spec.ts:8
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-07-10-s4c.reviewer.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-21-pending-merge.reviewer.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/achievements.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-02-s2a.reviewer.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/workspace-frame.reviewer.spec.ts:8
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd10-statistics-layout.reviewer.spec.ts:5
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/proposals.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-17-22-proposals.reviewer.spec.ts:9
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/hydration.spec.ts:5
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-19-app-shell.reviewer.spec.ts:17
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/portafolio.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd25-v2-aliases.reviewer.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/_prod-smoke.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/visual.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-05-gate.reviewer.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/backlog.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-21-pending-merge.behaviour.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/w6-integration.reviewer.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/model-usability.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-04-11-s5c-gate.reviewer.spec.ts:15
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/work-order-detail.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/portfolio-spec.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/shell-sidebar.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-08-gate.reviewer.spec.ts:14
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/cuentas.reviewer.spec.ts:7
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-13-visual-gate.reviewer.spec.ts:6
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/logical-data-model.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-18-gate.reviewer.spec.ts:6
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/laneM-tablet.spec.ts:6
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/observability.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/tokens.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/shell-usability.spec.ts:5
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-smoke.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/shell-ssr.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/achievements-statistics.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/_read-only-state.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/configuration.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/cuentas.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/responsive-widths.reviewer.spec.ts:7
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-14-snapshot-and-feedback.behaviour.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-02-idea-page.reviewer.spec.ts:11
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/page-errors.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/prod-server.mjs:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/tabs-keyboard.reviewer.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/worktrees.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/visual-system.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/headers.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-19-sidebar.gate.reviewer.spec.ts:6
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd25-gate-regressions.reviewer.spec.ts:5
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/model-s2b.reviewer.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/resumen.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/integration-navigation-refresh.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/frd-25-persistent-navigation.behaviour.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/smoke.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/nav-client-refresh.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/responsive.spec.ts:4
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/documentation.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/shell-hydration.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/shell.spec.ts:6
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/inicio.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/achievements.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/model.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/_live-race.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/manual.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/board.spec.ts:3
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/proposals.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/history-race.spec.ts:6
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/destinations.spec.ts:1
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/configuration.spec.ts:2
/Users/Shared/Proyectos/panda-corp/mission-control/e2e/persistent-navigation/workspace.spec.ts:2
[exit 0]
```

**medida** collect.py: 72 archivos e2e *.spec.* en /Users/Shared/Proyectos/panda-corp/mission-control/e2e.

**medida** collect.py: 540 archivos unit/component candidatos; inventario:

/Users/Shared/Proyectos/panda-corp/mission-control/content/manual/wo-14-004.feedback-channels.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/content/manual/wo-08-005.content.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/scripts/oracle/_tests/dev-oracle.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/scripts/fidelity/_tests/calibration.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/visualClosure.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/frd07.gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/frd07.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/persistentNavigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/frd07.detail-edges.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/page.integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/configuration/_tests/frd07.s4c-blockers.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_utils/_tests/attributes.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_utils/_tests/viewRules.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/frd-10-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/frd-10.s4c-blockers.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/page.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/wo-10-005-hall-surfaces.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/frd-10-gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/closure-d.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/frd-10-integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/page.ledger-hermeticity.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/frd-10-reuse.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_tests/frd-10-stats-gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/RankLadder/_tests/RankLadder.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/_components/charts/_tests/seriesLabels.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/Informe/_tests/clientBoundary.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/Informe/_tests/Informe.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/achievements/Informe/_tests/informeData.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_utils/_tests/readCardProject.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_utils/_tests/readCardProject.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/IdeaBoardView/_tests/IdeaBoardView.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/IdeaBoardView/_tests/IdeaBoardView.wo02014.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/IdeaBoardView/_tests/IdeaBoardView.wo02005.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/frd-02.idea-route.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/frd-02.shell-integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/frd-02.stage-default-tab.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/frd-02.s2a-board.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/frd-02.integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/board-orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/wo-02-005-board-surface.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/discard-write.integration.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_tests/board-search.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/[...segments]/_tests/ideaPage.integration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/_tests/CardDetail.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/_tests/CardDetail.adversarial.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/_tests/CardDetail.navigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/_tests/CardDetail.cohesion.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/_tests/CardDetail.frd02-integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/IdeaPitch/_tests/IdeaPitch.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/ArchitectureDigest/_tests/ArchitectureDigest.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/ArchitectureDigest/_tests/s2b.adversarial.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/ArchitectureDigest/_tests/orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/ArchitectureDigest/_tests/usability.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/CardDetail/SpecDigest/_tests/SpecDigest.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/DiscardedModal/_tests/DiscardedModal.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/IntakeModal/_tests/IntakeModal.adversarial.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/_components/IntakeModal/_tests/IntakeModal.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/actions/_tests/actions.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/board/actions/_tests/read-doc.security.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/layout.theme.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/layout.shell.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/wo-09-006-snapshotLedger.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/client-directive.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/layout.guard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/layout.sidebar.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/error-net.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/globals.css.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/frd13.source-contracts.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/layout.sidebar.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/agentColorTokens.integration.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/page.dashboard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_tests/globals.css.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_observability/WoLiveRefresh/_tests/wo-live-refresh.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_observability/FrdDriftBadge/_tests/FrdDriftBadge.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_tests/page.reviewer.integration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_tests/workspace-frame.adversarial.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_tests/workspace-route.empty.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_tests/page.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_tests/workspace-frame.integration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_tests/workspace-route.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_actions/_tests/discard-change.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-changes/_tests/changes.v2.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-changes/_tests/ChangeCard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.relativeDate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/snapshot-panel/_tests/frd-14-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.adversarial.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/snapshot-panel/_tests/frd-14-rebuild.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/workspace-shell.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/architecture-tab.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/spec-tab.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/workspace-navigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/frd-05-reuse.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/_tests/frd-05-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-commands/_tests/frd-11-gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-commands/_tests/frd-11-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-commands/_tests/targets.v2.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-commands/_tests/ComandosPanel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.fidelity.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.wo04005.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-views/_tests/panel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-views/_tests/views.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-views/_tests/frd-05-gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-views/_tests/nativeNavigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-board/_tests/wo-board.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/Fragua/_tests/FraguaScene.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/Fragua/_tests/FraguaLive.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/Fragua/_tests/FraguaToken.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/deps/_tests/data.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/deps/_tests/DependencyMap.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/deps/_tests/DependencyCanvas.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/deps/_tests/DependencyCanvas.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.wo04005.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/build-v2.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.snapshot-liveness.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/readSummary.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.snapshot-liveness.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/frd-04-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-empty/_tests/wo-empty.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/version-freshness/_tests/version-freshness.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-state-filter/_tests/wo-state-filter.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/wo-frd-filter/_tests/wo-frd-filter.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/ProgressList/_tests/ProgressList.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/projects/[slug]/_components/ProgressList/_tests/progressItems.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manualSingleSource.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/day1-engine.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/page.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/docs-search.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manualPages.builder.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/frd-08-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/frd-08-content.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manualPages.fastLane.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/conceptEquipo.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/frd-08-reuse.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manualPages.dr133.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/persistentNavigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manualPages.multi-runtime.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manual-content-v2.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manual.reviewer.integration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/manualPages.lanes.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/manual/_tests/visual-reanchor.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_components/OnboardingGate/_tests/OnboardingGate.contract.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_components/OnboardingGate/_tests/OnboardingGate.clipboard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_components/OnboardingGate/_tests/OnboardingGate.gaps.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_components/OnboardingGate/_tests/OnboardingGate.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_components/plugin-sync-banner/_tests/plugin-sync-banner.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_components/plugin-sync-banner/_tests/plugin-sync-banner.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/portfolio/_tests/overview.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/plugin-sync/_tests/route.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/plugin-sync/_tests/route.integration.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/live/_tests/security.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/live/_tests/route.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/live/_tests/route.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/live/_tests/route.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/api/live/_tests/route.eventstore.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_design/tokens/_tests/assets.bytes.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/_design/tokens/_tests/tokens.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/(dashboard)/_tests/frd-18-integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/wo-17-004-req17001.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/frd-17-reuse.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/frd-17-lesson-detail.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/frd-17-gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/persistentNavigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/frd-17-gate-opus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/proposals-integration.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/proposals-wiring.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/frd-17-resolver.gate.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/proposals-composition.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/proposals-page.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_tests/wo-17-005-lesson-detail-v2.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_actions/_tests/discard-backlog.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_components/PromotionsQueuePanel/_tests/PromotionsQueuePanel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_components/BacklogPanel/_tests/frd-22-gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_components/BacklogPanel/_tests/BacklogPanel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_components/BacklogPanel/_tests/persistentNavigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/app/proposals/_components/ProposalsTabs/_tests/ProposalsTabs.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/test/_tests/ownerPrivateState.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/_tests/security-boundaries.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/_tests/board-not-found.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/tests/fixtures/_tests/index.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/tests/fixtures/_tests/index.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Tabs/_tests/Tabs.s1a.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Tabs/_tests/Tabs.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Tabs/_tests/Tabs.orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CopyButton/_tests/CopyButton.orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CopyButton/_tests/CopyButton.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CopyButton/_tests/CopyButton.adversarial.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CopyButton/_tests/CopyButton.contract.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CopyButton/_tests/CopyButton.tokens.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Card/_tests/Card.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/DiscardButton/_tests/DiscardButton.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/FavoriteButton/_tests/FavoriteButton.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Markdown/_tests/security.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Markdown/_tests/anchors.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Markdown/_tests/Markdown.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Markdown/_tests/Markdown.orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/PhaseStepper/_tests/PhaseStepper.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Toast/_tests/Toast.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Chip/_tests/Chip.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Chip/_tests/vocabulary.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Chip/_tests/stackOrder.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Chip/_tests/state-shapes.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/ProgressBar/_tests/ProgressBar.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Field/_tests/Field.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Button/_tests/IconButton.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Button/_tests/Button.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Button/_tests/ButtonLink.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Table/_tests/Table.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/SectionHead/_tests/SectionHead.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Avatar/_tests/Avatar.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Ring/_tests/Ring.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Icon/_tests/Icon.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Modal/_tests/Modal.focus.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Modal/_tests/Modal.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Modal/_tests/Modal.orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Modal/_tests/Modal.s1a.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CmdRow/_tests/CmdRow.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/CmdRow/_tests/CmdRow.s1a.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/RestoreButton/_tests/RestoreButton.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/core/Banner/_tests/Banner.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/Cartera/_tests/cartera.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/Progreso/_tests/Progreso.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/TuTurno/_tests/TuTurno.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/GamificationLedgerSync/_tests/GamificationLedgerSync.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/dashboard/DashboardLiveWatcher/_tests/DashboardLiveWatcher.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/a11y/_tests/a11y-primitives.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/a11y/_tests/wo-13-003.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/a11y/_tests/a11y-primitives.adversarial.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/PromotionsQueue/_tests/PromotionsQueue.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/SectionedMarkdown/_tests/SectionedMarkdown.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/GuildBar/_tests/GuildCard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/GuildHero/_tests/GuildHero.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Spec/_tests/integration-patches.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Spec/_tests/FrdCard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/FreshnessBadge/_tests/FreshnessBadge.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/ProjectSwitcher/_tests/ProjectSwitcher.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/BuildModePicker/_tests/BuildModePicker.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/BuildModePicker/_tests/BuildModePicker.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/manual-diagrams/_tests/ModificationGuide.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/manual-diagrams/_tests/RuntimeComparison.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/manual-diagrams/_tests/SourceOfTruthMap.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/manual-diagrams/_tests/MultiRuntimeDiagram.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/theme-toggle.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/sidebar.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/ShellLocation.hydration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/shellPolish.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/collapse.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/AppShell.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AppShell/_tests/pills.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/AchievementToast/_tests/AchievementToast.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Worktrees/_tests/Worktrees.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Worktrees/_tests/Worktrees.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/CampaignPipeline/_tests/CampaignPipeline.wo-02-013.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/CampaignPipeline/_tests/CampaignPipeline.orbita.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/CampaignPipeline/_tests/CampaignPipeline.s2a.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/CampaignPipeline/_tests/CampaignPipeline.ac010-8.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/IdeaCard/_tests/IdeaCard.wo02008.adversarial.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/IdeaCard/_tests/IdeaCard.wo02008.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/IdeaCard/_tests/IdeaCard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DocumentReader/_tests/copyDocument.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DocumentReader/_tests/DocumentReader.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Nav/_tests/nav-counts.gate.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Nav/_tests/nav-counts.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Nav/_tests/project-nav-item.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Nav/_tests/navActive.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Nav/_tests/persistentNavigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Nav/_tests/Nav.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/BuildRunPanel/_tests/BuildRunPanel.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/ReportBand/_tests/EnvFold.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/ReportBand/_tests/reportBand.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/restoration.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/modelContent.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/async.ux.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/navigation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/layout.ux.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/s2b.adversarial.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/viewer.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/layout.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/routing.ux.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/frame.consistency.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/viewport.mutation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/fullscreen.consistency.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/modelIdentity.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/DataModelViewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/fullscreen.ux.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/usability.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/layout.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/hostile-ids.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/asyncLayout.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/DataModelViewer/_tests/viewport.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/Pulso/_tests/pulso.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/ProjectCard/_tests/ProjectCard.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/components/modules/ServicesDirectory/_tests/Accounts.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/hooks/_tests/useLiveSnapshot.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/hooks/_tests/useFullscreen.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/hooks/_tests/useLiveSnapshot.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pitch/_tests/proposalSummary.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pitch/_tests/pitch.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pendingMerge/_tests/worktreesByRepo.malformed.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pendingMerge/_tests/engine-branches.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pendingMerge/_tests/worktreesByRepo.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pendingMerge/_tests/worktreesByRepo.realgit.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/pendingMerge/_tests/worktreesByRepo.async.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/snapshot/_tests/snapshot.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/snapshot/_tests/gap.gate.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/snapshot/_tests/gap.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/work-orders.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/sections.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/published.mutation.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/work-orders.wo05002.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/detail.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/work-orders.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/work-orders/_tests/real-source-boundaries.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/tasks/_tests/tasks.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/plugin-sync/_tests/plugin-sync.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/memory/_tests/memory-health.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/memory/_tests/memory-loop-v2.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/memory/_tests/memory.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/memory/_tests/memory.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/_tests/seals-rarity.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/_tests/chains-sagas.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/_tests/catalogue.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/_tests/signals.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/_tests/achievements.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/_tests/metric-level.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/backfill.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/informeResolver.sealCoverage.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/factoryStoreWriter.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/aggregateConsumer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/statsSchema.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/factorySchema.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/statsWriter.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/aggregateWiring.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/seal.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/factoryStoreReader.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/aggregateChain.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/statsReader.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/regen.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/informeResolver.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/aggregate.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/factorySeal.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/read-model/_tests/composedReader.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/frd-10-stats-honesty.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/report.integration.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/flowSeries.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/gitFailure.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/scalars.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/flowSeries.halves.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/lessons.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/phaseTransitions.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/verdict.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/usage.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/funnel.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/statProvenance.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/achievements/report/_tests/seamAdoption.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/frds/_tests/frd-index.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/frds/_tests/frd-drift.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/board/_tests/board.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/board/_tests/board.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/_tests/command-modes.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/_tests/slug.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/_tests/active-projects.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/_tests/build-modes.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/_tests/active-projects.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/_tests/build-modes.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/discard/_tests/restore.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/discard/_tests/discard.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/discard/_tests/discard.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/config/_tests/env.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/config/_tests/oracleEnv.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/config/_tests/oracleEnv.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/config/_tests/config.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/overlay-freshness/_tests/overlay-freshness.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/gamification/_tests/ledger.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/gamification/_tests/gamification.guild-survivors.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/gamification/_tests/guildState.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/gamification/_tests/ledger.adversarial.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/gamification/_tests/gamification.guild.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/gamification/_tests/ledger-v2-security.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/backlog/_tests/backlog.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/backlog/_tests/areas.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/backlog/_tests/discard-backlog.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/backlog/_tests/backlog.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/backlog/_tests/discard-backlog.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/backlog/_tests/areas.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/inicio/_tests/resolvers.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/inicio/_tests/streaming.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/inicio/_tests/guild.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/inicio/_tests/oracleCounts.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/changes/_tests/discard-change.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/changes/_tests/discard-change.gate.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/changes/_tests/openChanges.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/changes/_tests/openChanges.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/changes/_tests/changes.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/spec/_tests/read-spec.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/spec/_tests/read-artifacts.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/spec/_tests/read-frds.mutation.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/spec/_tests/spec.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/identity-cli.adversarial.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/identities.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/live-refresh-harness.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/routeState.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/destinations.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/keys.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/history.mutation.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/navigationTransition.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/useUrlState.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/aliases.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/parallel-safety-harness.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/v2-acceptance.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/v2-boundaries.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/NavigationLink.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/live-frame-refresh-harness.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/v2-survivors.reviewer.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/canonicalHistory.test.tsx
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/persistent-navigation.adversarial.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/parallel-safety-lifecycle.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/navigation/_tests/urls.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/favorite/_tests/favorite.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fs-utils/_tests/security.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fs-utils/_tests/fs-utils.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fs-utils/_tests/fs-utils.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fs-utils/_tests/frontmatter-import-boundary.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-run/_tests/performance-isolation.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-run/_tests/build-run.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-run/_tests/schema-source.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-run/_tests/display.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-run/_tests/decisions-and-events.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/status/_tests/liveness.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/status/_tests/lease-liveness.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/status/_tests/status.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/status/_tests/state-version.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/status/_tests/status.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/status/_tests/state-version-moved.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/activity.resolved-in-file.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.wo04001.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.wo04002.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/tree.v2.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.wo04002.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/documentBody.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/decision-id-golden.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/activity.resolved-in-file.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/activity.turn-detail.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/documentBody.adversarial.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/links.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/activity.spanish-resolved.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.wo24001.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/docs/_tests/docs.wo04001.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/self-suggest/_tests/self-suggest.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/_tests/read-architecture.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/_tests/env.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/_tests/adr.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/_tests/architecture.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/_tests/read-artifacts.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/_tests/artifact-boundaries.mutation.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/data-model/_tests/model.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/data-model/_tests/read-data-model.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/data-model/_tests/model.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/architecture/data-model/_tests/injected-rule-contract.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/manual/_tests/manual.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/profile/_tests/profile.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/profile/_tests/profile.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/theme/_tests/theme.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/campaign/_tests/campaign.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/registry/_tests/registry.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/overview.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/portfolio.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/overview-resolver.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/displayName.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/overview.integration.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/portfolio.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/lastCommit.fixture.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/sidebarProjects.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/portfolio/_tests/frd-03-overview.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fragua/_tests/boundaries.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fragua/_tests/fragua.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fragua/_tests/scene-data.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/fragua/_tests/signal-age.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/next-step/_tests/next-step.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/next-step/_tests/next-step.wo04003.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/next-step/_tests/next-step.wo04003.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/next-step/_tests/next-step.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/deps-layout/_tests/parity.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/deps-layout/_tests/prototype-golden.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/deps-layout/_tests/layout.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/copy/_tests/copy.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-track/_tests/build-track.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-track/_tests/build-track.engineV2.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/build-track/_tests/build-track.drift.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/ideas/_tests/ideaCounts.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/ideas/_tests/ideas.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/ideas/_tests/ideas.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/eventSourceHealth.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.adversarial.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.projectFilter.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/event-time.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.uipassskipped.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/eventSourceHealth.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.multi-runtime.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.achievements.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.newvocab.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/events/_tests/events.wo06012.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/services/_tests/services.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/services/_tests/views.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/services/_tests/reader-boundaries.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/services/_tests/views.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/reference/_tests/reference.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/reference/_tests/configurationCatalogs.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/git/_tests/fixtureGit.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/git/_tests/fixtureGit.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/git/_tests/gitBoundary.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/git/_tests/fixtureSeams.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/git/_tests/git.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/git/_tests/git.async.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/clock/_tests/clock.reviewer.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/clock/_tests/clock.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/proposals/_tests/routeSelection.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/proposals/_tests/ownerActions.test.ts
/Users/Shared/Proyectos/panda-corp/mission-control/src/lib/standards/_tests/standards.test.ts

**estimada** suma rg -c test\(: 295 líneas coincidentes (bucles/parametrización/test.skip/multilínea pueden diferir).

### /Users/Shared/Proyectos/funko-tracker


### /Users/Shared/Proyectos/funko-tracker/playwright.config.ts

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:1: import fs from "node:fs";

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:2: import path from "node:path";

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:3: import { defineConfig, devices, type Project } from "@playwright/test";

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:4: 

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:5: /**

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:6:  * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074) +

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:7:  * Shell-Presence Gate (DR-075) + the Production-Build Smoke (proposal 40, PANDACORP_PROD_SMOKE). VERBATIM stack template (DR-059) — at the project ROOT, conformance-checked by

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:8:  * /pandacorp:upgrade. Deterministic by construction: single worker, animations disabled, caret

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:9:  * hidden, fonts settled before each shot, retries OFF (a retry re-creates a missing baseline → the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:10:  * gate fails OPEN; DR-056 forbids it). In CI baselines are frozen (`updateSnapshots:'none'`);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:11:  * locally a NEW route's baseline is written once and must then be reviewed/blessed by the FRD gate.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:12:  *

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:13:  * The dev server runs on the project's reserved dev port (factory/standards/infra.md). Adjust PORT

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:14:  * to this project's `dev_port_base` if it differs from the default below.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:15:  *

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:16:  * Deterministic data sources (OPTIONAL): a project-local `e2e/server-env.json` — never part of the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:17:  * template, never overwritten by /pandacorp:upgrade — is injected into the webServer environment.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:18:  * It is the hook for pinning the app's data sources to frozen fixtures so LIVE data can never move

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:19:  * gate pixels. Values starting with "." resolve against the project root; a `PORT` entry moves the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:20:  * e2e server to its own port. When the file is present the server is NEVER reused — an

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:21:  * already-running dev server would read live data instead of the pinned fixture.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:22:  *

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:23:  * Parallel tier (OPTIONAL, DR-143): a project-local `e2e/parallel-safe.json` — never part of the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:24:  * template, never overwritten by /pandacorp:upgrade — lists the spec files (relative to e2e/) proven

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:25:  * to write nothing a sibling spec reads. The full `verify.sh` uses a single combined run: parallel projects first, then

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:26:  * desktop and mobile serial projects in dependency order, sharing one owned server. Serial is the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:27:  * default: a spec that is not listed keeps the determinism above, and with no file nothing changes.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:28:  * The visual gate may never be listed, because pixel baselines require a single worker (DR-056).

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:29:  *

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:30:  * Production-build server (OPTIONAL, DR-143): a project-local `e2e/prod-server.mjs` — seed, never

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:31:  * overwritten — takes `build` or `start <port>` and owns the project's fixture environment. The full

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:32:  * `verify.sh` builds once and sets PANDACORP_E2E_SERVER=prod, so every project shares one artifact and one server. Manual

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:33:  * and `--since` runs stay on `next dev`, and so does any project without the seed.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:34:  *

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:35:  * A project-local `e2e/globalSetup.ts` (optional, seed) is wired in when present, so a project can

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:36:  * hold a machine-wide test lease without forking this file.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:37:  */

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:38: const isCI = Boolean(process.env.CI);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:39: 

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:40: const SERVER_ENV_FILE = path.resolve("e2e", "server-env.json");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:41: const serverEnv: Record<string, string> = fs.existsSync(SERVER_ENV_FILE)

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:42:   ? Object.fromEntries(

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:43:       Object.entries(

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:44:         JSON.parse(fs.readFileSync(SERVER_ENV_FILE, "utf8")) as Record<string, string>,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:45:       ).map(([key, value]) => [key, value.startsWith(".") ? path.resolve(value) : value]),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:46:     )

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:47:   : {};

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:48: 

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:49: // Build lanes (proposal 40 Phase B): a lane worktree carries its own `.pandacorp/run/lane.env` (PANDACORP_LANE and the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:50: // lane's PORT), written by the build engine. It is read from DISK, not only from the shell env: a builder's fresh shell

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:51: // never sourced it, and an e2e on the default port would test a sibling lane's (or main's) server.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:52: const LANE_ENV_FILE = path.resolve(".pandacorp", "run", "lane.env");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:53: const laneEnv: Record<string, string> = fs.existsSync(LANE_ENV_FILE)

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:54:   ? Object.fromEntries(

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:55:       fs

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:56:         .readFileSync(LANE_ENV_FILE, "utf8")

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:57:         .split("\n")

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:58:         .map((line) => /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim()))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:59:         .filter((m): m is RegExpExecArray => m !== null)

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:60:         .map((m) => [m[1], m[2]]),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:61:     )

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:62:   : {};

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:63: 

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:64: const PORT = Number(serverEnv.PORT ?? laneEnv.PORT ?? process.env.PORT) || 3000;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:65: const BASE_URL = `http://127.0.0.1:${PORT}`;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:66: // Production-Build Smoke (proposal 40): the build engine sets PANDACORP_PROD_SMOKE in a detached worktree, so the

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:67: // server is the production artifact (`next build && next start`, its real CSP), never a reused dev server.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:68: const PROD_SMOKE = Boolean(process.env.PANDACORP_PROD_SMOKE);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:69: // In a lane (its lane.env, or PANDACORP_LANE in the env) the e2e never reuses a server a sibling lane or main left running.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:70: const LANE = Boolean(laneEnv.PANDACORP_LANE || process.env.PANDACORP_LANE);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:71: 

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:72: const PARALLEL_SAFE_FILE = path.resolve("e2e", "parallel-safe.json");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:73: const readParallelSafe = (): string[] => {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:74:   if (!fs.existsSync(PARALLEL_SAFE_FILE)) return [];

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:75:   const specs: unknown = JSON.parse(fs.readFileSync(PARALLEL_SAFE_FILE, "utf8"));

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:76:   if (!Array.isArray(specs))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:77:     throw new Error("e2e/parallel-safe.json must be a JSON array of spec paths");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:78:   return specs.map((spec) => {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:79:     if (typeof spec !== "string" || !fs.existsSync(path.resolve("e2e", spec))) {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:80:       throw new Error(`e2e/parallel-safe.json lists a spec that does not exist: ${String(spec)}`);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:81:     }

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:82:     if (!/^[\w./-]+\.spec\.[cm]?ts$/.test(spec) || spec.split("/").includes(".."))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:83:       throw new Error(`Unsafe parallel spec path: ${spec}`);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:84:     if (spec === "visual.spec.ts")

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:85:       throw new Error("visual.spec.ts must stay on one worker (DR-056)");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:86:     return `**/e2e/${spec}`;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:87:   });

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:88: };

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:89: const GATE_PROD = process.env.PANDACORP_E2E_SERVER === "prod";

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:90: if (GATE_PROD && !fs.existsSync(path.resolve("e2e", "prod-server.mjs"))) {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:91:   throw new Error("PANDACORP_E2E_SERVER=prod needs e2e/prod-server.mjs");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:92: }

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:93: const TIER = process.env.PANDACORP_E2E_TIER;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:94: if (TIER !== undefined && TIER !== "parallel" && TIER !== "serial" && TIER !== "combined") {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:95:   throw new Error(`Unknown PANDACORP_E2E_TIER: ${TIER}`);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:96: }

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:97: const PARALLEL_SAFE = readParallelSafe();

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:98: const PARALLEL_WORKERS = Number(process.env.PANDACORP_E2E_WORKERS) || 3;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:99: const GLOBAL_SETUP = path.resolve("e2e", "globalSetup.ts");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:100: // An upgrade without a reviewed inventory preserves DR-143's complete mobile selection.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:101: // Reviewed inventories exclude only named duplicates; unknown/new specs stay on mobile.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:102: const MOBILE_FILE = path.resolve("e2e", "mobile-specs.json");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:103: const MOBILE_CORE = ["smoke.spec.ts", "visual.spec.ts", "responsive.spec.ts"];

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:104: const LEGACY_MOBILE_IGNORE = ["shell.spec.ts", "headers.spec.ts", "hydration.spec.ts"];

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:105: const readMobileExclusions = (): string[] => {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:106:   if (!fs.existsSync(MOBILE_FILE)) return LEGACY_MOBILE_IGNORE;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:107:   const inventory: unknown = JSON.parse(fs.readFileSync(MOBILE_FILE, "utf8"));

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:108:   if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:109:     throw new Error(

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:110:       "e2e/mobile-specs.json needs a reviewed {include, desktopOnly, review} inventory",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:111:     );

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:112:   const { include, desktopOnly, review, ...unknown } = inventory as Record<string, unknown>;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:113:   if (

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:114:     !Array.isArray(include) ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:115:     !Array.isArray(desktopOnly) ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:116:     Object.keys(unknown).length ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:117:     typeof review !== "string" ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:118:     !/^docs\/reviews\/[\w./-]+\.md$/.test(review) ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:119:     review.split("/").includes("..") ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:120:     !fs.existsSync(path.resolve(review))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:121:   )

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:122:     throw new Error(

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:123:       "Mobile coverage reductions require a valid review document and classified spec lists",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:124:     );

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:125:   for (const spec of [...include, ...desktopOnly]) {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:126:     if (

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:127:       typeof spec !== "string" ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:128:       !/^[\w./-]+\.spec\.[cm]?ts$/.test(spec) ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:129:       spec.split("/").includes("..") ||

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:130:       !fs.existsSync(path.resolve("e2e", spec))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:131:     )

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:132:       throw new Error(`Invalid mobile spec: ${String(spec)}`);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:133:   }

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:134:   if (desktopOnly.some((spec) => include.includes(spec) || MOBILE_CORE.includes(spec)))

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:135:     throw new Error("Mobile core and included specs cannot be excluded");

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:136:   return desktopOnly as string[];

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:137: };

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:138: const MOBILE_IGNORE = readMobileExclusions().map((spec) => `**/e2e/${spec}`);

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:139: const MOBILE_PARALLEL = PARALLEL_SAFE.filter((spec) => !MOBILE_IGNORE.includes(spec));

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:140: const TIER_IGNORE = TIER === "serial" || TIER === "combined" ? PARALLEL_SAFE : [];

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:141: const COMBINED = TIER === "combined" && PARALLEL_SAFE.length > 0;

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:142: const DIAGNOSTIC = process.env.PANDACORP_VERIFY_NO_BAIL === "1";

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:143: // Dependencies require SUCCESS, so diagnostics omit them and use one global worker.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:144: // All projects then run even on red, without overlapping shared-state readers/writers.

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:145: const parallelProjects: (Project & { name: string })[] = COMBINED

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:146:   ? [

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:147:       {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:148:         name: "desktop-parallel",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:149:         testMatch: PARALLEL_SAFE,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:150:         use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:151:       },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:152:       {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:153:         name: "mobile-parallel",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:154:         testMatch: MOBILE_PARALLEL,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:155:         use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:156:       },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:157:     ]

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:158:   : [];

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:159: 

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:160: export default defineConfig({

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:161:   testDir: "./e2e",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:162:   ...(TIER === "parallel" ? { testMatch: PARALLEL_SAFE } : {}),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:163:   ...(fs.existsSync(GLOBAL_SETUP) ? { globalSetup: "./e2e/globalSetup.ts" } : {}),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:164:   fullyParallel: false,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:165:   workers: COMBINED && DIAGNOSTIC ? 1 : TIER === "parallel" || COMBINED ? PARALLEL_WORKERS : 1,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:166:   maxFailures: process.env.PANDACORP_E2E_CERTIFICATION === "1" && !DIAGNOSTIC ? 1 : 0,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:167:   forbidOnly: isCI,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:168:   retries: 0,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:169:   reporter: [["list"]],

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:170:   updateSnapshots: isCI ? "none" : "missing",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:171:   use: { baseURL: BASE_URL, trace: "off" },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:172:   expect: {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:173:     toHaveScreenshot: {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:174:       maxDiffPixelRatio: 0.02,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:175:       threshold: 0.2,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:176:       animations: "disabled",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:177:       caret: "hide",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:178:     },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:179:   },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:180:   projects: [

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:181:     ...parallelProjects,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:182:     {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:183:       name: "desktop",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:184:       ...(COMBINED

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:185:         ? {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:186:             workers: 1,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:187:             ...(DIAGNOSTIC

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:188:               ? {}

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:189:               : { dependencies: parallelProjects.map((project) => project.name) }),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:190:           }

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:191:         : {}),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:192:       testIgnore: TIER_IGNORE,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:193:       use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:194:     },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:195:     {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:196:       name: "mobile",

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:197:       ...(TIER === "parallel" ? { testMatch: MOBILE_PARALLEL } : {}),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:198:       testIgnore: [...TIER_IGNORE, ...MOBILE_IGNORE],

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:199:       ...(COMBINED ? { workers: 1, ...(DIAGNOSTIC ? {} : { dependencies: ["desktop"] }) } : {}),

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:200:       use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:201:     },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:202:   ],

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:203:   webServer: {

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:204:     command: GATE_PROD

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:205:       ? `node e2e/prod-server.mjs start ${PORT}`

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:206:       : PROD_SMOKE

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:207:         ? `next build && next start --hostname 127.0.0.1 --port ${PORT}`

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:208:         : `next dev --hostname 127.0.0.1 --port ${PORT}`,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:209:     url: BASE_URL,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:210:     reuseExistingServer:

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:211:       process.env.PANDACORP_E2E_CERTIFICATION !== "1" &&

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:212:       !PROD_SMOKE &&

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:213:       !GATE_PROD &&

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:214:       !LANE &&

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:215:       !isCI &&

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:216:       Object.keys(serverEnv).length === 0,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:217:     timeout: PROD_SMOKE ? 600_000 : 180_000,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:218:     env: serverEnv,

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:219:   },

/Users/Shared/Proyectos/funko-tracker/playwright.config.ts:220: });


### /Users/Shared/Proyectos/funko-tracker/vitest.config.ts

No existe este artefacto.


### /Users/Shared/Proyectos/funko-tracker/vitest.config.mts

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:1: import { globSync, readFileSync } from "node:fs";

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:2: import { availableParallelism } from "node:os";

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:3: import { fileURLToPath } from "node:url";

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:4: import react from "@vitejs/plugin-react";

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:5: import { defineConfig } from "vitest/config";

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:6: import { pandacorpVitest } from "./.pandacorp/vitest-policy";

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:7: import reviewedNodeSpecs from "./scripts/test/node-specs.json" with { type: "json" };

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:8: 

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:9: const excluded = ["e2e/**", "docs/**", "node_modules/**", ".claude/**", ".pandacorp/**", ".ops/**"];

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:10: const nodeSpecs = [

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:11:   ...new Set([

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:12:     ...reviewedNodeSpecs,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:13:     ...globSync(["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]).filter((file) =>

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:14:       /@vitest-environment\s+node\b/.test(readFileSync(file, "utf8")),

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:15:     ),

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:16:   ]),

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:17: ];

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:18: 

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:19: // Unreviewed tests retain jsdom; only the existing reviewed Node inventory opts out.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:20: const domSpecs = globSync(["**/*.{test,spec}.?(c|m)[jt]s?(x)"], {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:21:   exclude: excluded,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:22: }).filter((file) => !nodeSpecs.includes(file));

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:23: 

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:24: // Tests receive explicit fixture inputs; private provider handoff files are never loaded here.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:25: const config = pandacorpVitest(

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:26:   {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:27:     plugins: [react()],

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:28:     test: {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:29:       environment: "jsdom",

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:30:       // The default 5s limit fails unrelated jsdom and database tests when the shared machine is busy.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:31:       testTimeout: 20_000,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:32:       // Database-backed beforeEach hooks share the same busy-machine budget as the tests themselves.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:33:       hookTimeout: 60_000,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:34:       // Starts the native test PostgreSQL when no DATABASE_URL is injected and enforces zero residue.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:35:       globalSetup: ["./src/test/db/globalPostgres.ts"],

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:36:       globals: true,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:37:       restoreMocks: true,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:38:       sequence: { shuffle: true },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:39:       // e2e specs use Playwright's test(); .pandacorp/** and .claude/** hold the gate worktrees and

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:40:       // overlay scripts whose nested node_modules must never be globbed (LESSON-0099); .ops/** is

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:41:       // ignored operator scratch and disposable mutation sandboxes whose copied tests must never join

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:42:       // the app suite. docs/** holds prototype and example sources that are not part of the app's test suite.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:43:       exclude: excluded,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:44:     },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:45:     resolve: {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:46:       alias: {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:47:         "@": fileURLToPath(new URL("./src", import.meta.url)),

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:48:       },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:49:     },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:50:   },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:51:   {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:52:     dom: domSpecs,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:53:     domSetupFiles: ["./src/test/setup.ts"],

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:54:     // Zero-residue per-worker database clones (DR-140), reserving two cores.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:55:     defaultMaxWorkers: Math.min(5, Math.max(1, availableParallelism() - 2)),

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:56:   },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:57: );

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:58: 

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:59: // Vitest 5 inherits inline projects implicitly; each helper project already has shared settings.

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:60: export default defineConfig({

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:61:   ...config,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:62:   test: {

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:63:     ...config.test,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:64:     projects: config.test?.projects?.map((project) =>

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:65:       typeof project === "object" && project !== null ? { ...project, extends: false } : project,

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:66:     ),

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:67:   },

/Users/Shared/Proyectos/funko-tracker/vitest.config.mts:68: });


### /Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:1: // Managed VERBATIM as .pandacorp/vitest-policy.ts (DR-159). Config stays project-owned.

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:2: import type { ViteUserConfig as UserConfig } from "vitest/config";

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:3: 

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:4: export function pandacorpVitest(

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:5:   config: UserConfig = {},

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:6:   {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:7:     dom = [],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:8:     domSetupFiles = [],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:9:     defaultMaxWorkers,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:10:   }: { dom?: string[]; domSetupFiles?: string[]; defaultMaxWorkers?: number } = {},

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:11: ): UserConfig {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:12:   const { test = {}, ...shared } = config;

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:13:   if (test.projects !== undefined) {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:14:     throw new Error("Migrate existing Vitest projects explicitly before adopting pandacorpVitest");

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:15:   }

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:16:   const configured = process.env.PANDACORP_VITEST_MAX_WORKERS;

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:17:   if (configured !== undefined && !/^[1-9]\d*$/.test(configured)) {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:18:     throw new Error("PANDACORP_VITEST_MAX_WORKERS must be a positive integer");

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:19:   }

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:20:   const maxWorkers = configured === undefined ? defaultMaxWorkers : Number(configured);

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:21:   if (maxWorkers !== undefined && (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1)) {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:22:     throw new Error("Vitest maxWorkers must be a positive safe integer");

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:23:   }

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:24:   // Vitest 4+ native defaults; retain the project's explicit selection when present.

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:25:   const include = test.include ?? ["**/*.{test,spec}.?(c|m)[jt]s?(x)"];

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:26:   const exclude = test.exclude ?? ["**/node_modules/**", "**/.git/**"];

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:27:   const setup =

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:28:     test.setupFiles === undefined

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:29:       ? []

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:30:       : typeof test.setupFiles === "string"

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:31:         ? [test.setupFiles]

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:32:         : test.setupFiles;

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:33:   // Never extends:true: Vitest concatenates include AND globalSetup arrays, causing

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:34:   // duplicate tests/setup. Explicitly share config while keeping root globalSetup once.

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:35:   const project = (

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:36:     name: string,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:37:     environment: "node" | "jsdom",

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:38:     selection: string[],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:39:     ignored: string[],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:40:     setupFiles: string[],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:41:   ) => ({

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:42:     ...shared,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:43:     test: {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:44:       ...test,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:45:       name,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:46:       environment,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:47:       isolate: true,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:48:       include: selection,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:49:       exclude: ignored,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:50:       projects: undefined,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:51:       // One root budget, including the env override; project caps otherwise take precedence.

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:52:       maxWorkers: undefined,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:53:       globalSetup: [],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:54:       setupFiles,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:55:     },

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:56:   });

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:57:   return {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:58:     ...shared,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:59:     test: {

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:60:       ...test,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:61:       include: [],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:62:       environment: "node",

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:63:       isolate: true,

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:64:       ...(maxWorkers === undefined ? {} : { maxWorkers }),

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:65:       projects: [

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:66:         project("node", "node", include, [...exclude, ...dom], setup),

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:67:         ...(dom.length

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:68:           ? [project("dom", "jsdom", dom, exclude, [...setup, ...domSetupFiles])]

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:69:           : []),

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:70:       ],

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:71:     },

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:72:   };

/Users/Shared/Proyectos/funko-tracker/.pandacorp/vitest-policy.ts:73: }


### /Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:1: #!/usr/bin/env node

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:2: // Factory seed contract (DR-143): `build` once, then `start <port>` per Playwright tier.

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:3: import { spawn } from "node:child_process";

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:4: import { e2eFixtureEnvironment, PORT, ROOT, SERVER_ENV } from "../scripts/fidelity/config.mjs";

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:5: import { resetE2eFixture } from "../scripts/fidelity/db.mjs";

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:6: import { fidelityRuntimeEnv } from "../scripts/fidelity/runtimeEnv.mjs";

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:7: import { buildApp } from "../scripts/fidelity/server.mjs";

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:8: import { acquireGateLease } from "../scripts/test/gateLease.mjs";

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:9: 

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:10: const [command, port] = process.argv.slice(2);

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:11: if (command === "build") {

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:12:   const release = await acquireGateLease({ kind: "playwright" });

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:13:   try {

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:14:     // Prerender only the server's current fixture, never a missing DB or another port's seed.

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:15:     await resetE2eFixture(e2eFixtureEnvironment({ ...process.env, PANDACORP_E2E_SERVER: "prod" }));

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:16:     buildApp();

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:17:   } finally {

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:18:     await release();

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:19:   }

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:20: } else if (command === "start" && Number(port) === PORT) {

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:21:   const child = spawn(

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:22:     "pnpm",

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:23:     ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:24:     { cwd: ROOT, env: fidelityRuntimeEnv(process.env, SERVER_ENV), stdio: "inherit" },

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:25:   );

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:26:   child.once("exit", (code, signal) => {

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:27:     process.exit(code ?? (signal ? 1 : 0));

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:28:   });

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:29: } else {

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:30:   throw new Error("Usage: prod-server.mjs build | start <fixture port>");

/Users/Shared/Proyectos/funko-tracker/e2e/prod-server.mjs:31: }

```text
$ rg -c test\( /Users/Shared/Proyectos/funko-tracker/e2e
/Users/Shared/Proyectos/funko-tracker/e2e/frd-05-checklist-export.behaviour.spec.ts:10
/Users/Shared/Proyectos/funko-tracker/e2e/help/help.spec.ts:5
/Users/Shared/Proyectos/funko-tracker/e2e/help/legal.gate.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/fidelity-targets.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/hydration.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/visual.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/frd-03-private-inventory.behaviour.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/tokens.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/fidelity/referenceActions.spec.mts:1
/Users/Shared/Proyectos/funko-tracker/e2e/universe/universe.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/account/account.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/account/settings.codexGate.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/_publicCacheFixtures.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/export/checklistFlow.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/export/hydration.independent.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/export/asyncReadiness.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/export/codexGate.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/app-shell/app-shell.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/directories/directories.spec.ts:5
/Users/Shared/Proyectos/funko-tracker/e2e/directories/fidelity.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/frd-01-catalog-browsing.behaviour.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/pwa/installability.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/pwa/pwa.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/frd-08-help-contact-legal.behaviour.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/goal-editor/goal-editor.spec.ts:7
/Users/Shared/Proyectos/funko-tracker/e2e/publicCacheWorkflows.spec.ts:8
/Users/Shared/Proyectos/funko-tracker/e2e/_isolated.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/publicCache.spec.ts:8
/Users/Shared/Proyectos/funko-tracker/e2e/prod-smoke.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/detail/lifecycle.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/globalSetup.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/frd-04-goals-and-to-get.behaviour.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/page-errors.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/follow-export-recovery.behaviour.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/detail/actionBlock.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/to-get/sticky-owned.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/detail/detail.spec.ts:7
/Users/Shared/Proyectos/funko-tracker/e2e/detail/fidelity.codex.gate.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/smoke.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/headers.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/securityHeaders.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/to-get/goal-handoff.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/explore/exploreColor.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/collection/personal-controls-touch.independent.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/frd-02-collectible-detail.behaviour.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/responsive.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/to-get/reserved.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/englishRoutes.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/explore/exploreHome.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/cardPresentation.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/to-get/to-get.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/shell.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/collection/collection.spec.ts:5
/Users/Shared/Proyectos/funko-tracker/e2e/to-get/wishlist.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/launch/shared.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/fidelity.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/collection/split-status.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/collection/visitor-resume.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/collection/personal-controls-motion.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/launch/social.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/collection/directPersonalFooter.independent.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/launch/analytics.spec.ts:5
/Users/Shared/Proyectos/funko-tracker/e2e/collection/allFranchises.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/goals/goals.spec.ts:9
/Users/Shared/Proyectos/funko-tracker/e2e/launch/observability.spec.ts:2
/Users/Shared/Proyectos/funko-tracker/e2e/_prod-smoke.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/contact/contact.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/collection/reserved.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/auth/forms.codexGate.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/fidelity-harness.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/launch/seo.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/contact/launchNoJs.spec.ts:4
/Users/Shared/Proyectos/funko-tracker/e2e/auth/auth.spec.ts:6
/Users/Shared/Proyectos/funko-tracker/e2e/contact/httpStatus.review.spec.ts:1
/Users/Shared/Proyectos/funko-tracker/e2e/explore/codexGate.spec.ts:3
/Users/Shared/Proyectos/funko-tracker/e2e/auth/prehydration.spec.ts:1
[exit 0]
```

**medida** collect.py: 72 archivos e2e *.spec.* en /Users/Shared/Proyectos/funko-tracker/e2e.

**medida** collect.py: 888 archivos unit/component candidatos; inventario:

/Users/Shared/Proyectos/funko-tracker/scripts/contact/migration.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/seed/_tests/seedDetail.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/seed/_tests/seed.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/seed/_tests/seedSafety.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/seed/_tests/processedMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/test/_tests/e2eIsolation.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/test/_tests/testFocus.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/test/_tests/gateLease.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/_tests/exportDataModel.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/framework/_tests/redirectHeaders.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/vercelIgnore.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/ignoreCommand.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/operatorMigration.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/nextConfig.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/vercelBuild.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/modalWorkflow.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/modalDeploy.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/deploy/_tests/mainPushGuard.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/env/_tests/mediaProfiles.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/env/_tests/localTargets.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/env/_tests/profiles.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/env/_tests/localDatabase.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/env/_tests/fixtureIsolation.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/env/_tests/launchProfiles.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/db/_tests/retireUnknownReleaseStatus.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/db/_tests/testPostgres.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/dispatch.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionPublication.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/outputPrivacy.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/publicationCacheProtocol.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestRun.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionDelivery.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionNormalizeProbe.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/catalogNames.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/mainTransactionBudget.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/mainLocalTargets.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestQuickReviewSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/startupDiagnostics.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/deferredExpiry.review.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestQuickSafety.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepExecution.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionFindings.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestQuickFormat.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/revalidate.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/reviewerProbes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/destinationCopies.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/deltaRoutine.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestQuickPath.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/seriesCorrection.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestContinuation.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/researchChecks.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionReview.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionExclusivesReview.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/sweepCorrectionRoute.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/deliveryWorkflow.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/ingestPublication.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/workflowCorrections.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/_tests/liveQuickRuntime.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/queries/_tests/databaseIdentity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/schema/_tests/schema.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlScale.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRevisions.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/failClosedApproval.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/releaseTargets.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlDatabase.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewUnsealedAuthority.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/publish.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSql.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/publisherRemote.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderMutationShard2.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoContractV2.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewViewerReplay.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/providerTranscripts.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/sweepCorrectionApproval.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlRun.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoReadinessV2.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/targetedEffects.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderMutationShard3.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/sweepTransactions.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderIntegrity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/universePlateRebinding.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogCorrectionSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlApply.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogRenamePopEvidence.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewTechnicalEffect.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestChain.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/contentMemo.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoRecordReproduce.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewChangeNotesSql.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/runAudit.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderMutationShard1.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/sweepCorrectionFreshness.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/localCatalog.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlRunVisibility.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlLight.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogReleaseUndo.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewReceipts.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlPolicyVisibility.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRendererPin.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogUniverse.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewAi.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/verifiedRelease.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoRecords.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/sweepCorrectionApprovalReview.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoReviewChecklist.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/mediaPublishedVerification.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/roundThreeApproval.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewChangeSection.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/undoMediaSafety.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/roundFourAuthority.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoControlWarnings.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoRunReadiness.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/mainCheckoutRoot.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogReleaseTargets.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/quickEnvironment.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/mediaRetirementLive.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/sweepCorrection.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogRenamePopIds.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/preservedCoverage.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ownerIntent.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewLegacyReplay.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/threadBinding.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/roundTwoApproval.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/quickFormat.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/deliveryTarget.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/crossConversationApproval.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderMutationLegacy.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/mediaReferences.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/publicationInvalidation.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/quickScope.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/seriesAuditTarget.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewCards.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/runUndoSheet.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/universeLogoBindings.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestPublish.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewChangeNotes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/deliveryProofMemo.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/publishResilience.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogStoredCopies.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderContext.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewAuthorityIsolation.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/mediaRetirement.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewPages.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogSqlFix.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewTechnicalRegeneration.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestPreflight.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/seriesCorrection.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/correctionBinding.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/mediaReferencesDatabase.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/retirementPending.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoRecordCutoutSource.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewTechnicalRealRuns.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/sweepCorrectionProductCode.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/replacedMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewViewer.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewVisibleNotes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewDelivery.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogUndoDatabase.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/runActivity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/deliveryCheckReuse.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestApplySweep.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/runAuthorityStore.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoReviewSheet.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestVerification.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestPreflightServices.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogExport.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/approvalSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewRenderMutation.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/reviewTechnicalBaselineMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoSourceExtent.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/catalogReleaseBackup.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/ingestStepCommands.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/lib/_tests/photoReadiness.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/retentionCommands.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/reviewDecide.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/universeCommands.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/catalogRevalidate.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/workingPathBoundaries.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/coverageReport.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/ingestPlan.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/ingestApply.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/gateEngineProbes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/mediaPublishReadiness.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/catalogUniverse.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/gateRunsProbes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/runResume.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/reviewList.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/runStatus.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/mediaPublishScale.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/mediaCheckUnknownHost.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/gateDecisionProbes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/commandActivity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/photoRecord.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/gateMediaCheckProbes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/releasesDue.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/gateDeltaReadContract.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/catalogRollout.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/deltaWindow.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/mediaFrame.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/publishSelection.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/photoRecordAiGrant.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/mergeConfirm.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/catalogFind.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/scopesList.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/launchReport.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/catalogExport.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/ops/commands/_tests/mediaCheck.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/e2eEnvironment.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/fixturePublication.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/review.codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/e2eFixtureReset.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/templateReuse.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/gate.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/runtimeDotenv.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/referenceAmendments.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/recipes.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/readStates.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/server.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/fidelity/_tests/runtimeEnv.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/analytics/_tests/launchReport.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/sweepRegression.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/safeDownload.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/uprightness.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/boxTurn.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/edgeQuality.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/downloadSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/figureLight.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/detectorCalibration.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/deskew.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/photoTools/_tests/boxOutline.test.ts
/Users/Shared/Proyectos/funko-tracker/scripts/media/imageSearch/_tests/imageSearch.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/account-deleted/_tests/page.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/franchises/_tests/FranchisesView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_utils/_tests/resolveExploreEntry.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/preparationFrame.rereview.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/nativePost.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/page.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/nativeGetVisibility.review.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/mountedMarks.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/sessionRefresh.final.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/pendingControls.review.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/page.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/publicProjection.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/nativePostRdc.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/personalContinuity.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/nativeLoading.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/nativeRetry.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_tests/localFilters.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_actions/_tests/admission.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_actions/_tests/exploreAdmission.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_actions/_tests/exploreBatch.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_actions/_tests/loadMoreResults.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_actions/_tests/loadMoreRateLimit.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreHub/_tests/transport.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreHub/_tests/ExploreHubView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreHub/_tests/HubRecovery.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreHub/_tests/publicControlIdentity.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreHub/_tests/HubPersonalTransport.review.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreHub/_tests/accountIsolation.review.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreFrame/_tests/ExploreFrame.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreResults/_tests/resultsLogic.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_components/ExploreResults/_tests/ExploreResultsView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/explore/_hooks/_tests/useLoadMoreSession.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/news/_tests/NewsView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/news/_tests/NewsPersonal.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/universe/_tests/universeView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/universe/_tests/publicProjection.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/universe/_components/UniverseModal/_tests/UniverseModal.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/universe/_components/UniverseTile/_tests/UniverseTile.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/collections/_tests/CollectionsView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_tests/controlIdentity.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_tests/publicPrerender.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_tests/personalIsland.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_tests/streaming.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/mediaPresentation.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/FichaLightbox.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/FichaLayout.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/FichaLayout.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/productionRuns.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/fidelity.codex.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/FichaMedia.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/mediaAvailability.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/ui2.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(catalog)/piece/[id]/_components/FichaLayout/_tests/FichaActions.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_tests/MissingPagination.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_tests/PieceCards.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_tests/viewParams.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_tests/wishlistSnapshot.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_tests/readiness.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/GoalsList/_tests/GoalsList.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/GoalsList/_tests/GoalsSlot.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/WishlistView/_tests/WishlistView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/WishlistView/_tests/wishlistParity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/GoalView/_tests/GoalView.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/GoalView/_tests/goalViewFlows.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/to-get/_components/GoalView/_tests/goalViewRetention.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/prerenderBoundaries.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/pwaTheme.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/not-found.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/notFound.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/error.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/global-error.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/_tests/layout.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle-media/_tests/media.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/contact/_tests/pages.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/_tests/estados.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/_tests/recovery.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/_tests/session.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/explore/filters/_tests/page.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/explore/hub/_tests/page.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/states/_states/_tests/collectionStates.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/states/_states/_tests/detailNotFound.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/oracle/states/_states/_tests/detailMediaPlaceholder.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_tests/contactForm.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_tests/reportAction.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_tests/contactForm.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_tests/publicPreparation.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_components/_tests/ProtectedContact.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_components/ContactForm/_tests/submitContact.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_components/ContactForm/_tests/submitContactTimeout.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/contact/_components/ContactForm/_tests/submitContactBoundary.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/_tests/legalPages.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/_tests/privacyMigration.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/_tests/privacyContract.review.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(help)/_tests/helpPages.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/api/contact/_tests/routeBounds.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/contact/_tests/route.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/contact/_tests/origin.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/contact/_tests/route.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/health/_tests/route.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/internal/maintenance/_tests/route.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/internal/revalidate/_tests/completion.rereview.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/internal/revalidate/_tests/route.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/exports/_tests/route.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/exports/_tests/delivery.codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/piece-personal/_tests/route.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/api/csp-report/_tests/security.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/export/_utils/_tests/ui2Params.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/export/_utils/_tests/resetDate.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_utils/_tests/asyncPanel.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_utils/_tests/loadExportPage.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/export/_utils/_tests/restore.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/export/_utils/_tests/jobSelector.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/controlIdentity.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/retryRestored.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/checklistFlowPreview.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/transportBoundaries.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/loading.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/remoteSession.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/expectedFailures.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/readyCounts.codexGate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/transportRecovery.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/launchAnalytics.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/export.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/pollingLifecycle.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_tests/pagination.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_components/ExportPreview/_tests/fitObserver.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_components/ExportPreview/_tests/lazyImages.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_components/ExportPreview/_tests/PreviewInspect.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_components/ExportPreview/_tests/reservationParity.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_components/ExportPreview/_tests/realChecklistPreview.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/export/_components/ExportPreview/_tests/imageLoading.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/account/_tests/accountActions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/account/_tests/AccountSettings.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/account/_components/DeleteAccountDialog/_tests/DeleteAccount.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(auth)/_tests/forms.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/(auth)/_tests/actions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/(auth)/_tests/validation.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/my-collection/_tests/allFranchises.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/my-collection/_tests/page.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/my-collection/_tests/loading.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/my-collection/_tests/CollectionPanel.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/onboarding/_tests/onboarding.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/onboarding/_tests/readiness.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/app/goal/_tests/params.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/goal/_tests/params.test.ts
/Users/Shared/Proyectos/funko-tracker/src/app/goal/_tests/preview.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/factories/_tests/factories.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/db/_tests/fixtureTarget.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/db/_tests/setupTestDatabase.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/db/_tests/globalPostgres.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/db/_tests/templateIsolation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/db/_tests/resetLifecycle.test.ts
/Users/Shared/Proyectos/funko-tracker/src/test/db/_tests/processLiveness.test.ts
/Users/Shared/Proyectos/funko-tracker/src/_tests/cspSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/_tests/nativeBrowse.rereview.test.ts
/Users/Shared/Proyectos/funko-tracker/src/_tests/nextConfig.test.ts
/Users/Shared/Proyectos/funko-tracker/src/_tests/proxy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/_tests/staticDependencies.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/inventory.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportJobSafety.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportJob.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/maintenancePreflight.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogDirectory.codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/wishlist.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/visibilityProvenance.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogVisibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/accountDeletion.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/wishlistView.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/user.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/goalEditorSeed.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/merge.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/myCollection.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/rateLimit.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogPublishMetadata.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/candidate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/myCollection.allFranchises.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogNames.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogProjection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/mediaPresentation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/universeBulkUpdates.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/ui2CatalogMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/prismaTimezone.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/contactMessage.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/universeLogos.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/collectibleDetail.codex.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/hiddenPromotionCandidates.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/storedCopy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/onboardedScope.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/collectibleDetail.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/collectibleDetail.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogMerge.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogDirectory.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogUniverse.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportSnapshot.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/_db.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/goalStrips.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/checklistMetadata.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/sourceFraming.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/universeImportIntegrity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/reservedMerge.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/publicReleaseParity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/ingestionRun.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportSnapshot.codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/reservedMigration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/goalPages.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/toGetExportOrder.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/toGet.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/publicationIds.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/reservedViews.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/universeTaxonomy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/goal.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exploreHome.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/userPreference.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/universe.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/maintenanceCheckpoint.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/accountErasure.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportPublic.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogCoverage.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/sessionRelease.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/follow.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/helpExamples.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/sessionLock.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/mediaHealth.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportJobStatus.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/auditRecord.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/evidence.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogSearch.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/sourceFraming.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogDirectory.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/toGet.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/seriesReviewFixes.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exploreReleaseEquivalence.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/wishlistSummary.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/helpExamples.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/goalViews.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/exportDurability.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/mutationReceipt.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/launchMetrics.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/productionRunNote.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/migrationStatus.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogVisibilityMigration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/taxonomy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/publicDiscovery.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogSearch.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/identityGuards.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/myCollection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/mediaReclassification.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogMatch.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/publication.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/publicPieceIds.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/coverageCell.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/eligibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/catalogExport.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/lightCatalog.test.ts
/Users/Shared/Proyectos/funko-tracker/src/queries/_tests/mediaCheck.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/core/Tabs/_tests/TabsHydration.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Tabs/_tests/Tabs.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Crumbs/_tests/Crumbs.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Radio/_tests/Radio.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Input/_tests/Input.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Alert/_tests/Alert.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Toast/_tests/Toast.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Chip/_tests/Chip.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Checkbox/_tests/Checkbox.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/ProgressBar/_tests/ProgressBar.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Field/_tests/Field.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Sticker/_tests/Sticker.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/PillOption/_tests/PillOption.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Dialog/_tests/Dialog.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Textarea/_tests/Textarea.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Button/_tests/Button.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/SegmentedControl/_tests/SegmentedControl.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/SegmentedControl/_tests/SegmentedControlHydration.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/MultiCombo/_tests/MultiCombo.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/MultiCombo/_tests/MultiCombo.zeroEdges.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Switch/_tests/Switch.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/IconButton/_tests/IconButton.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Select/_tests/Select.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/core/Icon/_tests/Icon.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/DocLayout/_tests/DocLayout.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Footer/_tests/responsiveMarkers.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Footer/_tests/Footer.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Footer/_tests/Footer.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Footer/_tests/launchEntries.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/OwnToggle/_tests/OwnToggle.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/FollowPicker/_tests/FollowPicker.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalRow/_tests/GoalRow.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalRow/_tests/GoalRow.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/SearchForm/_tests/preHydrationPrivacy.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/SearchForm/_tests/SearchForm.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/SearchForm/_tests/SearchForm.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/SpecialListCard/_tests/SpecialListCard.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/FilterRail/_tests/FilterRail.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/FilterRail/_tests/FilterRail.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalTiles/_tests/GoalTiles.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ModeCard/_tests/ModeCard.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ContextualReport/_tests/reportForm.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/AppShell/_tests/SessionRefresher.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/AppShell/_tests/AppShell.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/AppShell/_tests/publicChrome.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ChecklistTable/_tests/ChecklistTable.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/FollowBar/_tests/FollowBar.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalNavigation/_tests/GoalNavigation.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ImageViewer/_tests/ImageViewer.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/PublicShare/_tests/PublicShare.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalEditor/_tests/hydration.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalEditor/_tests/hiddenPersistence.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalEditor/_tests/GoalEditor.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalEditor/_tests/GoalEditor.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportReadyNotification/_tests/streamingReadiness.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportReadyNotification/_tests/lifecycle.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportReadyNotification/_tests/polling.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportReadyNotification/_tests/readyWatcher.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportReadyNotification/_tests/pendingLayout.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportReadyNotification/_tests/notification.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/PhotoStage/_tests/PhotoStage.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/CollectibleCard/_tests/CollectibleCard.gate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/CollectibleCard/_tests/reservedCard.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/CollectibleCard/_tests/CollectibleCard.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/AuthGate/_tests/AuthGate.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Shelf/_tests/Shelf.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ResultsToolbar/_tests/ResultsToolbar.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Nav/_tests/accountMenuHydration.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/Nav/_tests/Nav.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/DirectoryCard/_tests/DirectoryCard.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalSummary/_tests/GoalSwitcher.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalSummary/_tests/GoalSummary.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportPoster/_tests/ExportPoster.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportPoster/_tests/fitCaptions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportPoster/_tests/checklistFlowStyles.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportPoster/_tests/checklistFlow.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/ExportPoster/_tests/fitChecklistFlow.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalMenu/_tests/goalMenuPlacement.test.ts
/Users/Shared/Proyectos/funko-tracker/src/components/modules/GoalMenu/_tests/GoalMenu.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/PieceThumb/_tests/PieceThumb.framing.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/components/modules/PieceStrip/_tests/PieceStrip.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/hooks/_tests/hooks.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/hooks/_tests/useSwipe.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/preferences/_tests/preferences.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchContext.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchBootstrapHints.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/visitorSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/noJsResult.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/contactPipeline.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchOrigin.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchNativeActionTransport.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchMailTimeout.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/contact.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchDelivery.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchValidation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/contact/_tests/launchFormBoundary.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/ui/_tests/ui.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/strip.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/goals.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/exploreOverview.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/equivalent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/hiddenPicks.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/wishlistTally.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/actions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/goals/_tests/suggestedGoal.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/routingConfig.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/productionSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/env.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/englishRoutes.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/routes.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/prisma.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/routes.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/modalFoundation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/searchText.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/launchIntegration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/prismaConnectionOptions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/_tests/problem.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/auth.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/sessionIdentity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/backoffSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/actions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/trustedClientFixture.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/fixtureRecovery.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/trustedClientSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/_tests/sessionRefresh.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/auth/sessionIsland/_tests/useSessionMember.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/mail/_tests/transactionalDesign.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/mail/_tests/mail.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/mail/_tests/outbox.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/mail/_tests/exportReadyTemplate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/mail/_tests/sendMailSignal.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/mutations/_tests/mutations.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/mutations/_tests/mutations.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/gateLimits.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/correctionIntegration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/gateAdversarial.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/manyScopes.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/releaseDue.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/gateConcurrency.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/recovery.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/visibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/window.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/hiddenReview.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/deltaKind.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/newSeries.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/intraRunSimilar.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/preparedObservations.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/media.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/delta/_tests/lifecycle.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/codexGateLimits.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/mediaCorrection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/candidateFile.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/officialRenderVisibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/productionRunNotes.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/gateBoundaries.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/postponement.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/series.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/vaulted.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/visibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/viewMatrixSkillParity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/envelope.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/franchiseBackfillContract.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/report.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/contract/_tests/extractorIdentity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/identity/_tests/candidateIdentity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/identity/_tests/identity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/identity/_tests/nameAnchor.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/_tests/writeBoundaryProbe.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/_tests/importBoundary.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/_tests/preparation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/decisions/_tests/identityUpdate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/decisions/_tests/decisions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/decisions/_tests/postponement.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/decisions/_tests/identityConfirmationGuard.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/decisions/_tests/identityConfirmation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/provenanceIntegration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/process.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/visibilityProvenance.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/catalogVisibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/figureMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/planReads.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/approvedIdentity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/intraRunSimilar.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/engine/_tests/provenance.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/probeFixture.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/catalogScale.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/sweepCorrectionOptions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/aiCommunityCorrection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/codexGateCli.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/workingRootOverride.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/runs.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/batchContinuation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/skillContract.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/figureMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/bulkSafety.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/planSiblingReads.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/largePlan.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/seriesMetadata.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/sourceFraming.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/deltaSkillContract.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/sweepCorrectionAdapterReview.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/intraRunSimilar.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/sweepCorrectionAdapter.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/mediaReclassification.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/aiMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/runs/_tests/workingPaths.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/anyHttpsSource.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/communityMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/policy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/mediaCorrection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/updateOptions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/reviewedPhotoReplacement.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/announcementVisibility.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/sourceSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/mediaReclassification.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/storedRunRecovery.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/aiMedia.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ingest/policy/_tests/storedMediaSource.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/publicRelease.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/capacitySecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/cursorParity.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/publicProjection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/order.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/displayName.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/publicReleaseProjection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/exploreParams.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/catalog/_tests/newsSelection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/accountDeletion/_tests/accountDeletion.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/accountDeletion/_tests/accountDeletion.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/pieces/_tests/pieceSummary.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/observability/_tests/release.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/observability/_tests/security.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/observability/_tests/policy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/observability/_tests/redact.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/storage/_tests/deletionSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/storage/_tests/prefixGuard.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/storage/_tests/privateBucket.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/storage/_tests/pagedErasure.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/polling/_tests/coordinator.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklist.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistTypography.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistFlowProperties.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistFlowRows.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/planner.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistFlowPages.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistCaptionTokens.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistOrder.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistSheet.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistCaption.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistStoreSticker.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/plan/_tests/checklistGeneric.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/durability.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/checklistSnapshotPlan.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/schemas.codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/checklistFlowVersion.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/checksOption.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/familiesOption.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/productionVariantIdentity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/pollAccount.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/posterLabelText.adversarial.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/startExport.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/restore.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/snapshotData.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/reservedSnapshot.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/records.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/job/_tests/durableAcceptance.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/notifications/_tests/readyEmail.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/exports/notifications/_tests/readyEmail.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/env/_tests/localFidelity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/env/_tests/posthog.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/testDoubles/_tests/read.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/testDoubles/_tests/doubles.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/personalControlsIsolation.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/refreshIdentity.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/reservedConflict.independent.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/viewerIsolation.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/personalState.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/reserved.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/reservedUi.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/ownership.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/actions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/splitPersonalActions.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/reservedIsolation.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/personalControlsPending.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/ownership.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/directPersonalFooter.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/ownership/_tests/adoptionNotifications.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/theme/_tests/theme.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/taxonomy/_tests/groupByTaxonomy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/http/_tests/publicSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/http/_tests/signedBody.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/http/_tests/ingressBounds.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/pwa/_tests/manifest.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/pwa/_tests/pwaHead.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/actions/_tests/actionResult.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/exportBudget.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/erasureSafety.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/exportFences.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/contactRetentionMigration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/erasureCredentials.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/erasureRecovery.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/erasureCheckpointRetention.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/erasureMigration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/purgeContactMessages.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/expireExports.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/retentionSafety.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/tasks/_tests/exportMaintenance.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/runProtocol.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/drain.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/security.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/monitoring.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/runPreflight.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/bodyBounds.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/maintenance/_tests/endpoint.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/pendingAction/_tests/pendingAction.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/pendingAction/_tests/pendingAction.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/pendingAction/_tests/PendingActionResumer.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/pendingAction/_tests/englishReturnTo.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/directories/_tests/nativeExploreRequest.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/directories/_tests/exploreBatch.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/directories/_tests/discoveryPublication.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/directories/_tests/exploreBatchFixture.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/directories/_tests/exploreReadBudget.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/directories/_tests/exploreSelection.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/jobs/_tests/modalDispatch.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/jobs/_tests/cancellation.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/jobs/_tests/jobs.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/jobs/_tests/dispatchBounds.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/follows/_tests/follows.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/follows/_tests/follows.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/universe/_tests/search.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/social.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/discoveryBuild.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/discoveryRequest.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/directoryStructuredData.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/imageMetadata.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/pageMetadata.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/seo/_tests/metadata.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/collectible/_tests/photoFailure.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/collectible/_tests/collectible.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/validation/_tests/browserConfiguration.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/wishlist/_tests/actions.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/wishlist/_tests/useWishlist.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/analytics/_tests/sdkSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/analytics/_tests/analytics.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/analytics/_tests/closeoutServer.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/analytics/_tests/closeoutClient.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/popsplanetMerchant.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/imageHosts.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/franchiseLogo.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/fetchImage.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/dnsSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/merchantCdn.independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/merchantCdn.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/productionStickers.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/studioNamespaces.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/viewRequirements.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/mocaMerchant.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/presentation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/communityCatalogs.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/approvedRunHosts.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/researchedHosts.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/sourceUrl.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/fixtureMediaRoot.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/resolveMediaUrl.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/_tests/resolveMediaUrl.gate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/storedCopy/_tests/previewUrl.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/storedCopy/_tests/storedCopy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/storedCopy/_tests/baseEnvironment.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/browser.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/independent.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/pngAnimation.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/analyze.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/imageProps.test.tsx
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/pixels.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/prepareIncoming.test.ts
/Users/Shared/Proyectos/funko-tracker/src/lib/media/framing/_tests/framing.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/_tests/importBoundary.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/_tests/logSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/_tests/registry.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/_tests/sentry.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/_tests/schemaGuard.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/pipeline.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/checklistLogo.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/policy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/storedCopy.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/productionStickers.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/checklistPipeline.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/boundedRenderer.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/sourceFraming.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/media.codexGate.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/checklistFlowMeasures.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/captureBudget.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/render/_tests/mediaCancellation.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/http/_tests/problemSecurity.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/jobs/_tests/durableRender.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/jobs/_tests/renderStorage.review.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/jobs/_tests/exportRender.test.ts
/Users/Shared/Proyectos/funko-tracker/src/worker/tick/_tests/tick.test.ts
/Users/Shared/Proyectos/funko-tracker/src/i18n/_tests/i18n.test.tsx

**estimada** suma rg -c test\(: 254 líneas coincidentes (bucles/parametrización/test.skip/multilínea pueden diferir).

### /Users/Shared/Proyectos/personal-page-v2


### /Users/Shared/Proyectos/personal-page-v2/playwright.config.ts

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:1: import fs from "node:fs";

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:2: import path from "node:path";

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:3: import { defineConfig, devices, type Project } from "@playwright/test";

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:4: 

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:5: /**

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:6:  * Preview Smoke Gate (DR-055) + Visual-Fidelity Gate Layer A (DR-056) + Responsive Gate (DR-074) +

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:7:  * Shell-Presence Gate (DR-075) + the Production-Build Smoke (proposal 40, PANDACORP_PROD_SMOKE). VERBATIM stack template (DR-059) — at the project ROOT, conformance-checked by

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:8:  * /pandacorp:upgrade. Deterministic by construction: single worker, animations disabled, caret

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:9:  * hidden, fonts settled before each shot, retries OFF (a retry re-creates a missing baseline → the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:10:  * gate fails OPEN; DR-056 forbids it). In CI baselines are frozen (`updateSnapshots:'none'`);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:11:  * locally a NEW route's baseline is written once and must then be reviewed/blessed by the FRD gate.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:12:  *

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:13:  * The dev server runs on the project's reserved dev port (factory/standards/infra.md). Adjust PORT

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:14:  * to this project's `dev_port_base` if it differs from the default below.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:15:  *

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:16:  * Deterministic data sources (OPTIONAL): a project-local `e2e/server-env.json` — never part of the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:17:  * template, never overwritten by /pandacorp:upgrade — is injected into the webServer environment.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:18:  * It is the hook for pinning the app's data sources to frozen fixtures so LIVE data can never move

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:19:  * gate pixels. Values starting with "." resolve against the project root; a `PORT` entry moves the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:20:  * e2e server to its own port. When the file is present the server is NEVER reused — an

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:21:  * already-running dev server would read live data instead of the pinned fixture.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:22:  *

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:23:  * Parallel tier (OPTIONAL, DR-143): a project-local `e2e/parallel-safe.json` — never part of the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:24:  * template, never overwritten by /pandacorp:upgrade — lists the spec files (relative to e2e/) proven

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:25:  * to write nothing a sibling spec reads. The full `verify.sh` uses a single combined run: parallel projects first, then

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:26:  * desktop and mobile serial projects in dependency order, sharing one owned server. Serial is the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:27:  * default: a spec that is not listed keeps the determinism above, and with no file nothing changes.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:28:  * The visual gate may never be listed, because pixel baselines require a single worker (DR-056).

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:29:  *

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:30:  * Production-build server (OPTIONAL, DR-143): a project-local `e2e/prod-server.mjs` — seed, never

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:31:  * overwritten — takes `build` or `start <port>` and owns the project's fixture environment. The full

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:32:  * `verify.sh` builds once and sets PANDACORP_E2E_SERVER=prod, so every project shares one artifact and one server. Manual

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:33:  * and `--since` runs stay on `next dev`, and so does any project without the seed.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:34:  *

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:35:  * A project-local `e2e/globalSetup.ts` (optional, seed) is wired in when present, so a project can

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:36:  * hold a machine-wide test lease without forking this file.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:37:  */

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:38: const isCI = Boolean(process.env.CI);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:39: 

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:40: const SERVER_ENV_FILE = path.resolve("e2e", "server-env.json");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:41: const serverEnv: Record<string, string> = fs.existsSync(SERVER_ENV_FILE)

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:42:   ? Object.fromEntries(

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:43:       Object.entries(

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:44:         JSON.parse(fs.readFileSync(SERVER_ENV_FILE, "utf8")) as Record<string, string>,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:45:       ).map(([key, value]) => [key, value.startsWith(".") ? path.resolve(value) : value]),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:46:     )

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:47:   : {};

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:48: 

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:49: // Build lanes (proposal 40 Phase B): a lane worktree carries its own `.pandacorp/run/lane.env` (PANDACORP_LANE and the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:50: // lane's PORT), written by the build engine. It is read from DISK, not only from the shell env: a builder's fresh shell

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:51: // never sourced it, and an e2e on the default port would test a sibling lane's (or main's) server.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:52: const LANE_ENV_FILE = path.resolve(".pandacorp", "run", "lane.env");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:53: const laneEnv: Record<string, string> = fs.existsSync(LANE_ENV_FILE)

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:54:   ? Object.fromEntries(

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:55:       fs

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:56:         .readFileSync(LANE_ENV_FILE, "utf8")

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:57:         .split("\n")

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:58:         .map((line) => /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim()))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:59:         .filter((m): m is RegExpExecArray => m !== null)

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:60:         .map((m) => [m[1], m[2]]),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:61:     )

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:62:   : {};

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:63: 

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:64: const PORT = Number(serverEnv.PORT ?? laneEnv.PORT ?? process.env.PORT) || 3000;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:65: const BASE_URL = `http://127.0.0.1:${PORT}`;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:66: // Production-Build Smoke (proposal 40): the build engine sets PANDACORP_PROD_SMOKE in a detached worktree, so the

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:67: // server is the production artifact (`next build && next start`, its real CSP), never a reused dev server.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:68: const PROD_SMOKE = Boolean(process.env.PANDACORP_PROD_SMOKE);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:69: // In a lane (its lane.env, or PANDACORP_LANE in the env) the e2e never reuses a server a sibling lane or main left running.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:70: const LANE = Boolean(laneEnv.PANDACORP_LANE || process.env.PANDACORP_LANE);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:71: 

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:72: const PARALLEL_SAFE_FILE = path.resolve("e2e", "parallel-safe.json");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:73: const readParallelSafe = (): string[] => {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:74:   if (!fs.existsSync(PARALLEL_SAFE_FILE)) return [];

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:75:   const specs: unknown = JSON.parse(fs.readFileSync(PARALLEL_SAFE_FILE, "utf8"));

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:76:   if (!Array.isArray(specs))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:77:     throw new Error("e2e/parallel-safe.json must be a JSON array of spec paths");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:78:   return specs.map((spec) => {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:79:     if (typeof spec !== "string" || !fs.existsSync(path.resolve("e2e", spec))) {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:80:       throw new Error(`e2e/parallel-safe.json lists a spec that does not exist: ${String(spec)}`);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:81:     }

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:82:     if (!/^[\w./-]+\.spec\.ts$/.test(spec) || spec.split("/").includes(".."))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:83:       throw new Error(`Unsafe parallel spec path: ${spec}`);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:84:     if (spec === "visual.spec.ts")

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:85:       throw new Error("visual.spec.ts must stay on one worker (DR-056)");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:86:     return `**/e2e/${spec}`;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:87:   });

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:88: };

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:89: const GATE_PROD = process.env.PANDACORP_E2E_SERVER === "prod";

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:90: if (GATE_PROD && !fs.existsSync(path.resolve("e2e", "prod-server.mjs"))) {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:91:   throw new Error("PANDACORP_E2E_SERVER=prod needs e2e/prod-server.mjs");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:92: }

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:93: const TIER = process.env.PANDACORP_E2E_TIER;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:94: if (TIER !== undefined && TIER !== "parallel" && TIER !== "serial" && TIER !== "combined") {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:95:   throw new Error(`Unknown PANDACORP_E2E_TIER: ${TIER}`);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:96: }

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:97: const PARALLEL_SAFE = readParallelSafe();

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:98: const PARALLEL_WORKERS = Number(process.env.PANDACORP_E2E_WORKERS) || 3;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:99: const GLOBAL_SETUP = path.resolve("e2e", "globalSetup.ts");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:100: // An upgrade without a reviewed inventory preserves DR-143's complete mobile selection.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:101: // Reviewed inventories exclude only named duplicates; unknown/new specs stay on mobile.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:102: const MOBILE_FILE = path.resolve("e2e", "mobile-specs.json");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:103: const MOBILE_CORE = ["smoke.spec.ts", "visual.spec.ts", "responsive.spec.ts"];

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:104: const LEGACY_MOBILE_IGNORE = ["shell.spec.ts", "headers.spec.ts", "hydration.spec.ts"];

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:105: const readMobileExclusions = (): string[] => {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:106:   if (!fs.existsSync(MOBILE_FILE)) return LEGACY_MOBILE_IGNORE;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:107:   const inventory: unknown = JSON.parse(fs.readFileSync(MOBILE_FILE, "utf8"));

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:108:   if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:109:     throw new Error(

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:110:       "e2e/mobile-specs.json needs a reviewed {include, desktopOnly, review} inventory",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:111:     );

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:112:   const { include, desktopOnly, review, ...unknown } = inventory as Record<string, unknown>;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:113:   if (

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:114:     !Array.isArray(include) ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:115:     !Array.isArray(desktopOnly) ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:116:     Object.keys(unknown).length ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:117:     typeof review !== "string" ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:118:     !/^docs\/reviews\/[\w./-]+\.md$/.test(review) ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:119:     review.split("/").includes("..") ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:120:     !fs.existsSync(path.resolve(review))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:121:   )

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:122:     throw new Error(

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:123:       "Mobile coverage reductions require a valid review document and classified spec lists",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:124:     );

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:125:   for (const spec of [...include, ...desktopOnly]) {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:126:     if (

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:127:       typeof spec !== "string" ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:128:       !/^[\w./-]+\.spec\.ts$/.test(spec) ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:129:       spec.split("/").includes("..") ||

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:130:       !fs.existsSync(path.resolve("e2e", spec))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:131:     )

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:132:       throw new Error(`Invalid mobile spec: ${String(spec)}`);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:133:   }

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:134:   if (desktopOnly.some((spec) => include.includes(spec) || MOBILE_CORE.includes(spec)))

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:135:     throw new Error("Mobile core and included specs cannot be excluded");

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:136:   return desktopOnly as string[];

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:137: };

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:138: const MOBILE_IGNORE = readMobileExclusions().map((spec) => `**/e2e/${spec}`);

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:139: const MOBILE_PARALLEL = PARALLEL_SAFE.filter((spec) => !MOBILE_IGNORE.includes(spec));

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:140: const TIER_IGNORE = TIER === "serial" || TIER === "combined" ? PARALLEL_SAFE : [];

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:141: const COMBINED = TIER === "combined" && PARALLEL_SAFE.length > 0;

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:142: const DIAGNOSTIC = process.env.PANDACORP_VERIFY_NO_BAIL === "1";

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:143: // Dependencies require SUCCESS, so diagnostics omit them and use one global worker.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:144: // All projects then run even on red, without overlapping shared-state readers/writers.

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:145: const parallelProjects: (Project & { name: string })[] = COMBINED

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:146:   ? [

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:147:       {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:148:         name: "desktop-parallel",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:149:         testMatch: PARALLEL_SAFE,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:150:         use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:151:       },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:152:       {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:153:         name: "mobile-parallel",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:154:         testMatch: MOBILE_PARALLEL,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:155:         use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:156:       },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:157:     ]

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:158:   : [];

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:159: 

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:160: export default defineConfig({

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:161:   testDir: "./e2e",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:162:   ...(TIER === "parallel" ? { testMatch: PARALLEL_SAFE } : {}),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:163:   ...(fs.existsSync(GLOBAL_SETUP) ? { globalSetup: "./e2e/globalSetup.ts" } : {}),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:164:   fullyParallel: false,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:165:   workers: COMBINED && DIAGNOSTIC ? 1 : TIER === "parallel" || COMBINED ? PARALLEL_WORKERS : 1,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:166:   maxFailures: process.env.PANDACORP_E2E_CERTIFICATION === "1" && !DIAGNOSTIC ? 1 : 0,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:167:   forbidOnly: isCI,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:168:   retries: 0,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:169:   reporter: [["list"]],

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:170:   updateSnapshots: isCI ? "none" : "missing",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:171:   use: { baseURL: BASE_URL, trace: "off" },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:172:   expect: {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:173:     toHaveScreenshot: {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:174:       maxDiffPixelRatio: 0.02,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:175:       threshold: 0.2,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:176:       animations: "disabled",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:177:       caret: "hide",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:178:     },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:179:   },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:180:   projects: [

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:181:     ...parallelProjects,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:182:     {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:183:       name: "desktop",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:184:       ...(COMBINED

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:185:         ? {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:186:             workers: 1,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:187:             ...(DIAGNOSTIC

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:188:               ? {}

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:189:               : { dependencies: parallelProjects.map((project) => project.name) }),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:190:           }

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:191:         : {}),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:192:       testIgnore: TIER_IGNORE,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:193:       use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:194:     },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:195:     {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:196:       name: "mobile",

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:197:       ...(TIER === "parallel" ? { testMatch: MOBILE_PARALLEL } : {}),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:198:       testIgnore: [...TIER_IGNORE, ...MOBILE_IGNORE],

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:199:       ...(COMBINED ? { workers: 1, ...(DIAGNOSTIC ? {} : { dependencies: ["desktop"] }) } : {}),

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:200:       use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:201:     },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:202:   ],

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:203:   webServer: {

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:204:     command: GATE_PROD

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:205:       ? `node e2e/prod-server.mjs start ${PORT}`

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:206:       : PROD_SMOKE

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:207:         ? `next build && next start --hostname 127.0.0.1 --port ${PORT}`

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:208:         : `next dev --hostname 127.0.0.1 --port ${PORT}`,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:209:     url: BASE_URL,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:210:     reuseExistingServer:

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:211:       process.env.PANDACORP_E2E_CERTIFICATION !== "1" &&

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:212:       !PROD_SMOKE &&

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:213:       !GATE_PROD &&

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:214:       !LANE &&

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:215:       !isCI &&

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:216:       Object.keys(serverEnv).length === 0,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:217:     timeout: PROD_SMOKE ? 600_000 : 180_000,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:218:     env: serverEnv,

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:219:   },

/Users/Shared/Proyectos/personal-page-v2/playwright.config.ts:220: });


### /Users/Shared/Proyectos/personal-page-v2/vitest.config.ts

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:1: import { resolve } from "node:path";

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:2: import react from "@vitejs/plugin-react";

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:3: import { defineConfig } from "vitest/config";

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:4: import { pandacorpVitest } from "./.pandacorp/vitest-policy";

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:5: 

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:6: const config = pandacorpVitest(

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:7:   {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:8:     plugins: [react()],

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:9:     test: {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:10:       environment: "jsdom",

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:11:       globals: true,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:12:       // Exclude Playwright e2e specs — they use @playwright/test's test() which

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:13:       // conflicts with vitest's test runner when picked up here. Also exclude

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:14:       // .claude/** and .pandacorp/run/** so sibling git worktrees (parallel-session

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:15:       // worktrees under .claude/worktrees/, DR-096, and the build engine's own

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:16:       // gate-worktree under .pandacorp/run/, BL-0067) don't get their nested

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:17:       // node_modules/** globbed — that pattern only matches the root node_modules,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:18:       // not one several directories deep inside a worktree copy of the repo.

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:19:       exclude: ["e2e/**", "node_modules/**", ".claude/**", ".pandacorp/run/**"],

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:20:       server: {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:21:         deps: {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:22:           // next@16.2.9 ships no `exports` map, so the extensionless `next/server` specifier

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:23:           // (used internally by next-intl's bundled middleware) fails strict Node ESM

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:24:           // resolution from a nested pnpm-store install when externalized. Force it through

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:25:           // Vite's own (alias-aware) resolver instead.

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:26:           inline: [/next-intl/],

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:27:         },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:28:       },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:29:     },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:30:     resolve: {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:31:       alias: {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:32:         "@": resolve(__dirname, "./src"),

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:33:         "content-collections": resolve(__dirname, "./.content-collections/generated"),

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:34:         "next/server": resolve(__dirname, "./node_modules/next/server.js"),

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:35:       },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:36:     },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:37:   },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:38:   {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:39:     // Every existing suite uses jsdom; retain that environment and its exact selection.

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:40:     dom: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:41:     domSetupFiles: ["./src/test/setup.ts"],

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:42:   },

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:43: );

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:44: 

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:45: // Keep the existing single jsdom root: inline projects add prefixes to CLI file identities.

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:46: const domProject = config.test?.projects?.find(

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:47:   (project) => typeof project === "object" && "test" in project && project.test?.name === "dom",

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:48: );

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:49: if (!domProject || typeof domProject !== "object" || !("test" in domProject) || !domProject.test) {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:50:   throw new Error("Expected the shared Vitest policy to produce the jsdom project");

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:51: }

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:52: config.test = {

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:53:   ...domProject.test,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:54:   projects: undefined,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:55:   name: undefined,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:56:   globalSetup: config.test?.globalSetup,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:57:   maxWorkers: config.test?.maxWorkers,

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:58: };

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:59: 

/Users/Shared/Proyectos/personal-page-v2/vitest.config.ts:60: export default defineConfig(config);


### /Users/Shared/Proyectos/personal-page-v2/vitest.config.mts

No existe este artefacto.


### /Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:1: // Managed VERBATIM as .pandacorp/vitest-policy.ts (DR-159). Config stays project-owned.

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:2: import type { ViteUserConfig as UserConfig } from "vitest/config";

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:3: 

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:4: export function pandacorpVitest(

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:5:   config: UserConfig = {},

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:6:   {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:7:     dom = [],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:8:     domSetupFiles = [],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:9:     defaultMaxWorkers,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:10:   }: { dom?: string[]; domSetupFiles?: string[]; defaultMaxWorkers?: number } = {},

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:11: ): UserConfig {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:12:   const { test = {}, ...shared } = config;

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:13:   if (test.projects !== undefined) {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:14:     throw new Error("Migrate existing Vitest projects explicitly before adopting pandacorpVitest");

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:15:   }

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:16:   const configured = process.env.PANDACORP_VITEST_MAX_WORKERS;

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:17:   if (configured !== undefined && !/^[1-9]\d*$/.test(configured)) {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:18:     throw new Error("PANDACORP_VITEST_MAX_WORKERS must be a positive integer");

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:19:   }

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:20:   const maxWorkers = configured === undefined ? defaultMaxWorkers : Number(configured);

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:21:   if (maxWorkers !== undefined && (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1)) {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:22:     throw new Error("Vitest maxWorkers must be a positive safe integer");

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:23:   }

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:24:   // Vitest 4+ native defaults; retain the project's explicit selection when present.

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:25:   const include = test.include ?? ["**/*.{test,spec}.?(c|m)[jt]s?(x)"];

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:26:   const exclude = test.exclude ?? ["**/node_modules/**", "**/.git/**"];

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:27:   const setup =

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:28:     test.setupFiles === undefined

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:29:       ? []

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:30:       : typeof test.setupFiles === "string"

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:31:         ? [test.setupFiles]

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:32:         : test.setupFiles;

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:33:   // Never extends:true: Vitest concatenates include AND globalSetup arrays, causing

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:34:   // duplicate tests/setup. Explicitly share config while keeping root globalSetup once.

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:35:   const project = (

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:36:     name: string,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:37:     environment: "node" | "jsdom",

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:38:     selection: string[],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:39:     ignored: string[],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:40:     setupFiles: string[],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:41:   ) => ({

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:42:     ...shared,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:43:     test: {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:44:       ...test,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:45:       name,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:46:       environment,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:47:       isolate: true,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:48:       include: selection,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:49:       exclude: ignored,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:50:       projects: undefined,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:51:       // One root budget, including the env override; project caps otherwise take precedence.

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:52:       maxWorkers: undefined,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:53:       globalSetup: [],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:54:       setupFiles,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:55:     },

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:56:   });

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:57:   return {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:58:     ...shared,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:59:     test: {

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:60:       ...test,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:61:       include: [],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:62:       environment: "node",

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:63:       isolate: true,

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:64:       ...(maxWorkers === undefined ? {} : { maxWorkers }),

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:65:       projects: [

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:66:         project("node", "node", include, [...exclude, ...dom], setup),

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:67:         ...(dom.length

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:68:           ? [project("dom", "jsdom", dom, exclude, [...setup, ...domSetupFiles])]

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:69:           : []),

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:70:       ],

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:71:     },

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:72:   };

/Users/Shared/Proyectos/personal-page-v2/.pandacorp/vitest-policy.ts:73: }


### /Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:1: #!/usr/bin/env node

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:2: // DR-158: one production artifact for all browser projects, with the same fixture env at build/start.

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:3: import { spawn } from "node:child_process";

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:4: import fs from "node:fs";

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:5: import path from "node:path";

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:6: 

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:7: const action = process.argv[2];

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:8: if (action !== "build" && action !== "start")

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:9:   throw new Error("usage: prod-server.mjs build | start <port>");

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:10: const envFile = path.resolve("e2e/server-env.json");

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:11: const fixtureEnv = fs.existsSync(envFile) ? JSON.parse(fs.readFileSync(envFile, "utf8")) : {};

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:12: for (const [key, value] of Object.entries(fixtureEnv)) {

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:13:   if (typeof value !== "string") throw new Error(`Invalid server environment: ${key}`);

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:14:   fixtureEnv[key] = value.startsWith(".") ? path.resolve(value) : value;

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:15: }

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:16: const port = process.argv[3];

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:17: if (

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:18:   action === "start" &&

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:19:   (!port || !/^\d+$/.test(port) || Number(port) > 65535 || Number(port) < 1)

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:20: )

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:21:   throw new Error("start requires a valid port");

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:22: const child = spawn(

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:23:   process.execPath,

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:24:   [

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:25:     path.resolve("node_modules/next/dist/bin/next"),

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:26:     action,

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:27:     ...(action === "start" ? ["--hostname", "127.0.0.1", "--port", port] : []),

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:28:   ],

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:29:   {

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:30:     stdio: "inherit",

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:31:     env: { ...process.env, ...fixtureEnv, NODE_ENV: "production" },

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:32:   },

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:33: );

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:34: for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:35: child.on("error", (error) => {

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:36:   console.error(error);

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:37:   process.exitCode = 1;

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:38: });

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:39: child.on("exit", (code, signal) => {

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:40:   process.exitCode = code ?? (signal ? 1 : 0);

/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:41: });

```text
$ rg -c test\( /Users/Shared/Proyectos/personal-page-v2/e2e
/Users/Shared/Proyectos/personal-page-v2/e2e/hydration.spec.ts:5
/Users/Shared/Proyectos/personal-page-v2/e2e/visual.spec.ts:2
/Users/Shared/Proyectos/personal-page-v2/e2e/tokens.spec.ts:2
/Users/Shared/Proyectos/personal-page-v2/e2e/i18n-routing.spec.ts:6
/Users/Shared/Proyectos/personal-page-v2/e2e/closing-fidelity.spec.ts:3
/Users/Shared/Proyectos/personal-page-v2/e2e/home-fidelity.spec.ts:2
/Users/Shared/Proyectos/personal-page-v2/e2e/blog-cover-alt.spec.ts:4
/Users/Shared/Proyectos/personal-page-v2/e2e/blog-post-body.spec.ts:1
/Users/Shared/Proyectos/personal-page-v2/e2e/home.spec.ts:6
/Users/Shared/Proyectos/personal-page-v2/e2e/prod-server.mjs:1
/Users/Shared/Proyectos/personal-page-v2/e2e/projects-fidelity.spec.ts:4
/Users/Shared/Proyectos/personal-page-v2/e2e/headers.spec.ts:3
/Users/Shared/Proyectos/personal-page-v2/e2e/_prod-smoke.ts:3
/Users/Shared/Proyectos/personal-page-v2/e2e/prod-smoke.spec.ts:1
/Users/Shared/Proyectos/personal-page-v2/e2e/page-errors.spec.ts:2
/Users/Shared/Proyectos/personal-page-v2/e2e/smoke.spec.ts:2
/Users/Shared/Proyectos/personal-page-v2/e2e/a11y.spec.ts:2
/Users/Shared/Proyectos/personal-page-v2/e2e/responsive.spec.ts:4
/Users/Shared/Proyectos/personal-page-v2/e2e/shell.spec.ts:6
[exit 0]
```

**medida** collect.py: 18 archivos e2e *.spec.* en /Users/Shared/Proyectos/personal-page-v2/e2e.

**medida** collect.py: 180 archivos unit/component candidatos; inventario:

/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/publishFidelity.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/caseStudySource.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/skillDoc.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/coverOptimize.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/decisionLogSource.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/profileSource.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/publishGuard.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/storyIndex.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/denylist.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/skillV2.structure.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/lessonsSource.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/postWriter.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/storyLedger.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/privacyGate.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/imagePrompt.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/claimsCheck.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/claims.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/frontmatter.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/frd08.acceptance.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/storyIndexFile.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/transcriptExtract.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/seoLint.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/frd08.gate3.adversarial.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/workTranscriptSource.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/frd08.gate.integration.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/ogImageUnchanged.guard.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/proseBlocks.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/secretScan.test.ts
/Users/Shared/Proyectos/personal-page-v2/scripts/blog-generator/_tests/sourceGate.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_lib/_tests/getUtmFromSearchParams.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_lib/_tests/contactFormSchema.csp.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_lib/_tests/contactFormSchema.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_components/ContactForm/_tests/ContactForm.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_components/ContactView/_tests/ContactView.adversarial.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/contact/_components/ContactView/_tests/ContactView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_tests/homeCopyHonesty.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_tests/layout.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_tests/error.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/_components/Archive/_tests/Archive.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/_components/CaseStudyCardList/_tests/CaseStudyCardList.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/_components/ProjectsIndexView/_tests/ProjectsIndexView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_tests/generateStaticParams.adversarial.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/CaseStudyGallery/_tests/CaseStudyGallery.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/CaseStudyBody/_tests/CaseStudyBody.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/NextProjectCard/_tests/NextProjectCard.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/CaseStudyViewTracker/_tests/CaseStudyViewTracker.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/CaseStudyHeader/_tests/CaseStudyHeader.adversarial.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/CaseStudyHeader/_tests/CaseStudyHeader.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/projects/[slug]/_components/ShotsGallery/_tests/ShotsGallery.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_lib/_tests/buildShellLabels.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/about/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/about/_lib/_tests/getAboutOrThrow.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/about/_lib/_tests/buildAboutLabels.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/about/_components/AboutView/_tests/AboutView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/about/_components/AboutSections/_tests/AboutSections.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/rss.xml/_tests/route.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_tests/coverAltSurfaces.review.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/selectRelatedPosts.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/headingSlugs.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/extractHeadings.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/rehypeHeadingIds.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/adversarial.review.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/slugifyHeading.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/formatPostDate.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_lib/_tests/buildRssFeed.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_components/BlogIndexView/_tests/BlogIndexView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/_components/TagFilter/_tests/TagFilter.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_tests/generateStaticParams.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/PostNotFound/_tests/PostNotFound.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/CodeBlock/_tests/CodeBlock.mdxOverride.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/CodeBlock/_tests/CodeBlock.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/BlogProseLink/_tests/BlogProseLink.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/TableOfContents/_tests/TableOfContents.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/ReadingProgress/_tests/ReadingProgress.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/[slug]/_components/PostView/_tests/PostView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/tag/[tag]/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/tag/[tag]/_tests/generateStaticParams.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/blog/tag/[tag]/_components/TagPageView/_tests/TagPageView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/HowIUseAI/_tests/HowIUseAI.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/ProofStrip/_tests/ProofStrip.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/SelectedWork/_tests/SelectedWork.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/HowIWork/_tests/HowIWork.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/HomeView/_tests/HomeView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/Hero/_tests/Hero.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/_components/SkillsStack/_tests/SkillsStack.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_tests/page.metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_lib/_tests/freshness.adversarial.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_lib/_tests/freshness.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_lib/_tests/getNowOrThrow.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_lib/_tests/buildNowLabels.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_components/NowView/_tests/NowView.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/[locale]/now/_components/NowStatusList/_tests/NowStatusList.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/_tests/sitemap.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/_tests/llmsTxt.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/_tests/not-found.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/app/_tests/robots.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/app/_tests/global-error.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/_tests/proxy.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/_tests/aboutStructure.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/_tests/archive-projects.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/_tests/mdxFrontmatterParity.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/_tests/contentParity.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/case-studies/_tests/schema.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/case-studies/_tests/i18nKeys.adversarial.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/case-studies/_tests/caseStudies.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/case-studies/_tests/tldrBudget.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/content/case-studies/_tests/imageAssets.adversarial.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/components/core/MediaFrame/_tests/MediaFrame.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/MetaRow/_tests/MetaRow.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/PageTitle/_tests/PageTitle.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/SectionHeader/_tests/SectionHeader.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Card/_tests/Card.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/LocaleLink/_tests/LocaleLink.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Reveal/_tests/Reveal.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/FormField/_tests/FormField.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/LinkArrow/_tests/LinkArrow.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Lightbox/_tests/Lightbox.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Status/_tests/Status.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/EmptyState/_tests/EmptyState.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Button/_tests/Button.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Avatar/_tests/Avatar.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/IconSet/_tests/IconSet.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Eyebrow/_tests/Eyebrow.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/TechLogos/_tests/TechLogos.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Stagger/_tests/Stagger.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Tag/_tests/Tag.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/core/Badge/_tests/Badge.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/Footer/_tests/Footer.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/ThemeToggle/_tests/ThemeToggle.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/AppShell/_tests/AppShell.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/AppShell/_tests/AppShell.integration.review.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/PageViewTracker/_tests/PageViewTracker.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/SkipLink/_tests/SkipLink.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/LangSwitcher/_tests/LangSwitcher.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/shell/Nav/_tests/Nav.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/providers/ThemeProvider/_tests/ThemeProvider.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/providers/PostHogProvider/_tests/PostHogProvider.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/SocialLinks/_tests/SocialLinks.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/CaseStudyCard/_tests/CaseStudyCard.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/PostCard/_tests/PostCard.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/CtaBand/_tests/CtaBand.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/ContactCta/_tests/ContactCta.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/MdxContent/_tests/MdxContent.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/modules/MdxContent/_tests/MdxContent.serverOnly.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/components/seo/OgCard/_tests/OgCard.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/seo/JsonLd/_tests/JsonLd.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/components/seo/JsonLd/_tests/JsonLd.xss.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/hooks/_tests/useSpotlight.test.tsx
/Users/Shared/Proyectos/personal-page-v2/src/lib/_tests/site-config.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/_tests/analytics.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/_tests/experience.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/_tests/cn.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/about.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/schema.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/splitAboutSections.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/now.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/splitNowSections.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/coverAltCorpus.review.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/content/_tests/blog.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/env/_tests/web3forms.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/i18n/_tests/localizedHref.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/i18n/_tests/locales.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/json-ld-profile.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/alternates.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/site-url.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/json-ld-creative-work.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/json-ld-breadcrumb.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/post-locales.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/og-fonts.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/og-template.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/json-ld.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/json-ld-validate.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/lib/seo/_tests/route-metadata.test.ts
/Users/Shared/Proyectos/personal-page-v2/src/i18n/_tests/messages.test.ts

**estimada** suma rg -c test\(: 59 líneas coincidentes (bucles/parametrización/test.skip/multilínea pueden diferir).

### /Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:1: # Factory engine test corpus
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:2: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:3: Run `bash plugin/scripts/run-engine-tests.sh` from the factory checkout. The runner
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:4: executes every `test-*.mjs` plus the explicitly listed shell suites, aggregates all
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:5: failures and returns nonzero if any suite fails. It never substitutes skipped tests
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:6: for missing dependencies.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:7: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:8: ## Dependencies
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:9: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:10: The Ubuntu job in `.github/workflows/factory-engine-tests.yml` uses Node 24,
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:11: Git, Bash, jq, lsof and zsh. zsh is required by the adversarial alias and guarded restore
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:12: regressions; replacing those tests with Bash would lose the owner's shell coverage.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:13: It installs the real Codex CLI 0.144.1 for strict config parsing and execpolicy.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:14: The strict config test starts an EOF-only app server in a temporary Codex home,
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:15: checks the exact generated config and proves an unknown field is rejected. It
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:16: needs neither credentials nor provider reachability; `doctor` checks both and is
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:17: therefore unsuitable as an offline config oracle.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:18: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:19: The AST and production smoke suites use Mission Control's installed dependencies:
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:20: `pnpm --dir mission-control install --frozen-lockfile` (pnpm 10.12.1), then
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:21: `pnpm --dir mission-control exec playwright install --with-deps chromium`.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:22: Acorn remains a real independent parser and the CSP fixture still runs Chromium.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:23: Dependency installation needs network access on CI; the test corpus itself uses
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:24: local fixtures and must not request a model or contact the provider.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:25: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:26: ## Fixture isolation
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:27: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:28: Launcher argument tests provide their own Codex executable; offline preflight tests
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:29: use the version-capable worker fixture. The real CLI parser tests remain real CLI
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:30: tests. Git fixtures configure a local author and disable signing, including for
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:31: subsequent commits. Nothing writes the owner's global Git configuration.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:32: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:33: Product-build suites exercise `plugin/runtime/build/` through fixture projects
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:34: and fake workers, including lease fencing, relay, admission and landing. They
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:35: do not certify real provider reachability or unattended process survival. The
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:36: separate factory backlog Workflow retains its own harness.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:37: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:38: ## Whole-FRD documentation oracle
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:39: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:40: The canonical whole-FRD gate policy is `plugin/agents/reviewer.md`. The build
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:41: engine reads that policy into unit briefs, and the Codex reviewer projection is
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:42: generated from the same source. Retired project-executor documentation and
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:43: deleted Manual renderers are not current verification oracles.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:44: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:45: ## Restricted local verification
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:46: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:47: A sandbox may forbid process inspection (`ps`), loopback listeners, Chromium, or
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:48: writes to `.codex`. Report those failures separately from CI defects. Do not mock
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:49: those checks away or declare the complete runner green. The projection regeneration
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:50: checks can additionally be run in a disposable copy with writable `.codex`, using
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:51: the same committed inputs and real CLI. Ubuntu execution remains required to prove
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:52: the job's dependency installation; macOS results alone cannot certify it.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:53: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:54: ## Stack A template conformance
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:55: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:56: `test-template-e2e-conformance.mjs` is auto-discovered by the same runner. It copies
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:57: Stack A's `biome.json` and complete `e2e/` into a disposable Git repository (with
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:58: an empty ignore file, so no factory ignore can hide template files), then runs
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:59: `biome check e2e --error-on-warnings`. It also checks named hydration imports,
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:60: including aliases, against the helper's exported functions. Missing-export and
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:61: formatting negative controls prove both checks fail on regressions.
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:62: 
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:63: The Biome binary comes from the existing Mission Control dependency installation;
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:64: `PANDACORP_TEMPLATE_DEPS_DIR` may point to another installed project's directory
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:65: for local verification. Missing Biome fails the test. No install or dependency
/Users/Shared/Proyectos/panda-corp/plugin/docs/engine-tests.md:66: change is needed in CI.
