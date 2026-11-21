# "Listo" vs "mergeable": gates, árbol certificado y cola de merge (lectura del código real)

Fecha de lectura: 2026-11-20. Investigación de solo lectura. No se ejecutó verify.sh, merge-queue.sh, tests ni builds.

**Abreviaturas de rutas** (todas leídas en esta sesión):
- `MQ` = `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/merge-queue.sh`
- `GS` = `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/green-stamp.sh`
- `VS` = `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh`
- `WB` = `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/worktree-bootstrap.sh`
- `VBS` = `/Users/Shared/Proyectos/panda-corp/plugin/scripts/verify-before-stop.sh` (hook Stop)
- `RB` = `/Users/Shared/Proyectos/panda-corp/plugin/runtime/build/` (motor v2 del CLI `pandacorp-build.mjs`)
- `REG` = `/Users/Shared/Proyectos/panda-corp/factory/decisions/registry.yaml`
- `BO` = `/Users/Shared/Proyectos/panda-corp/factory/standards/build-orchestration.md`

## 0. Versiones y deriva de las copias

Comparación con `diff -q` contra las plantillas `plugin/templates/shared/.pandacorp/*` y `plugin/templates/stack-a-nextjs/verify.sh` (plugin 10.14.3, `plugin/.claude-plugin/plugin.json:3`; plantilla de overlay 9.4.2, `plugin/templates/OVERLAY_VERSION`):

| Proyecto | overlay_version | phase / deploy_target | merge-queue / green-stamp / worktree-bootstrap / change-reconcile | verify.sh |
|---|---|---|---|---|
| mission-control | 9.2.0 | implementation / internal (`mission-control/.pandacorp/status.yaml`) | IGUALES a la plantilla | DIFERENTE: le falta el bloque DR-140 `db:test:check-clean` (líneas 1020-1030 de la plantilla) |
| funko-tracker | 9.4.2 | release / **sin `deploy_target`** (grep vacío) → cuenta como externo | IGUALES | IGUAL |
| personal-page-v2 | 9.2.0 | release / external | IGUALES | DIFERENTE: mismo bloque DR-140 ausente |

Conclusión: la maquinaria de cola y sello es idéntica en los tres; MC y ppv2 van una versión de overlay atrás solo en el bloque de BD de test de verify.sh (irrelevante para MC, que no tiene BD). Ningún proyecto tiene `.pandacorp/gate-budget.json` (ls: no existe en los tres), así que las advertencias de presupuesto DR-159 (`VS:592-615`) nunca se disparan.

`merge-queue.sh --help` NO existe: el script no lee argumentos (no hay `$1` en `MQ`); invocarlo con `--help` ejecutaría la cola. No lo ejecuté.

## 1. Mapa de gates

### 1a. Etapas de `verify.sh` en orden (`VS`)

| # | Etapa (nombre en gate-report) | Qué hace | ¿En `--light`? | Cita |
|---|---|---|---|---|
| 0 | lock de dueño | flock exclusivo en `.pandacorp/run/verify.lock`; contención → exit 75 | sí | VS:53-77 |
| 0b | auditoría de inventarios e2e (DR-159) | solo WARN | sí | VS:134-179 |
| 0c | `--affected` (DR-158) | clasifica diff; omite Playwright solo si todo es `src/queries/*.ts`/`src/worker/*.ts` | n/a | VS:301-404 |
| 0d | `green-stamp.sh start` | solo si scope=full | no (scope partial) | VS:413-416 |
| 1 | structure-guard | tests fuera de `_tests/` | sí | VS:752-760 |
| 2 | live-data-asserts | advertencia, siempre exit 0 | sí | VS:763-811 |
| 3 | data-layer | Prisma fuera de `src/queries/` | sí | VS:817-832 |
| 4 | api-error-contract | rutas 4xx/5xx sin `problem` | sí | VS:837-851 |
| 5 | doc-lint | `.pandacorp/doc-lint.sh` | sí | VS:864-871 |
| 6 | residual-ambiguity | `[NEEDS CLARIFICATION]` en docs ACTIVE | sí | VS:878-892 |
| 7 | biome | `biome check . --error-on-warnings` | sí | VS:897-901 |
| 8 | tsc | `tsc --noEmit` | sí | VS:904 |
| 9 | knip | código muerto | sí | VS:907 |
| 10 | madge | ciclos | sí | VS:910 |
| 11 | vitest | `vitest run` entero, `--bail=1`, barajado con semilla | solo con `--tests=` (y solo esos ficheros) | VS:938-954, VS:265-271 |
| 12 | playwright | `prod-server.mjs build` + `playwright test e2e/` (combined tier si hay parallel-safe.json); con `--since` solo smoke+shell | nunca | VS:968-1009 |
| 13 | DR-080 bless advisory | solo aviso | — | VS:1016-1018 |
| (plantilla 9.4.2) | database-clean | `pnpm db:test:check-clean` si existe el script | — | `plugin/templates/stack-a-nextjs/verify.sh:1020-1030` (solo funko lo tiene) |

Paralelismo: las etapas son **secuenciales** dentro de verify.sh (cada `run_cheap_gate`/`run_gate` es una llamada en serie, VS:760-1009). El único paralelismo es dentro de Playwright: proyectos "parallel-safe" hasta 3 workers y luego desktop/mobile serie (`mission-control/playwright.config.ts:160-200`; `factory/standards/quality.md` §DR-158). Fail-fast: sin `--report-all` la primera etapa barata roja aborta (VS:736-748); vitest `--bail=1` (VS:941) y Playwright `maxFailures: 1` bajo certificación (`playwright.config.ts:166`, `PANDACORP_E2E_CERTIFICATION=1` exportado en VS:671).

Atajos DR-146/158/159: `--light` (VS:261-274), `--tests=` (VS:943-944), `--only` (VS:637-660), `--files` (VS:897-899, 945-946), `--since` (VS:93, 948, 991-992), `--affected` (VS:301-404). **Todos marcan `scope: partial`** salvo `--since` (scope `since`) (VS:289-295, 399). Solo `scope == full` puede escribir sello (VS:414, 627-629). No hay caché de resultados de tests; la única "caché" es el sello.

### 1b. Caminos que dicen "listo" y qué gate corren

| Camino | Comando exacto | Árbol | Incluye | Omite respecto del full | Cita |
|---|---|---|---|---|---|
| Sesión directa, fin de turno (hook Stop) | `verify.sh --light [--tests=<tests de los ficheros editados, máx 50>]` | checkout/worktree de la sesión, sin rebase | etapas 1-10 + esos tests | vitest completo, **todo Playwright**; tests de specs e2e editadas (filtra `e2e/*`, VBS:150); si >50 tests, ningún test (VBS:170-175) | VBS:103-127, 118, 150, 170-175; omite el gate entero si hay build activo (VBS:63-65) o sello válido (VBS:97-99) |
| Motor v2, unidad (G1) | `verify.sh --light [--tests=<tests nuevos>]` y luego `--light` | worktree de unidad (sparse checkout, base = rama de integración) | 1-10 + tests nuevos | vitest completo, Playwright | RB/report.mjs:166-176, 183-193; RB/units/worktrees.mjs:56, 223-226 |
| Motor v2, por FRD (G2) | `worktree-bootstrap.sh && verify.sh --since <base integración>` | snapshot detached de la punta de integración `<build>/g2/<frd>-<sha>` | 1-10 + `vitest run --changed <sha>` + Playwright **solo smoke+shell** | resto de vitest, visual/responsive/headers/demás specs e2e | RB/next/constants.mjs:27-34; VS:948, 991-992 |
| Motor v2, rescate | `bash .pandacorp/verify.sh` (full) | worktree de la unidad rescatada (no la integración, no rebasada) | todo | nada | RB/rescue.mjs:275, 348 |
| Motor v2, aterrizaje (G3) | job `bash .pandacorp/merge-queue.sh` → full `verify.sh` | worktree de integración `lane/<run_id>/integration`, **rebasado sobre main + commit de metadatos de aterrizaje** | todo | nada (salvo sello válido) | RB/land/command.mjs:30-41, 69-95, 104-114 |
| Cierre de run (`finish`/close-out) | ninguno propio; el único full es G3 | — | — | — | BO:487-490 ("G1 remains light, G2 remains scoped"); `plugin/skills/implement/references/engine-v2.md` §8 no lanza gate |
| Carril rápido (fast lane) | **ya no existe**: "SUPERSEDED fast-lane scheduler at Day 1" | — | — | — | REG:779 |
| sync close-out | ninguno; exige gate-report reciente con `green:true` y `scope ∈ {full, since}` | lo que haya en `.pandacorp/run/gate-report.json` | acepta un `since` como suficiente | un `since` omite visual/responsive y vitest no cambiado | `plugin/skills/sync/SKILL.md:30` |
| implement-backlog | prueba propia del ítem; merge directo a main de la fábrica (sin cola) | worktree de la fábrica | — | — | `plugin/skills/implement-backlog/SKILL.md:39, 49`; `plugin/skills/worktrees/SKILL.md:63` |
| worktrees "Integrar" | `cd <worktree> && bash .pandacorp/merge-queue.sh` | worktree de la rama | full (vía cola) | — | `plugin/skills/worktrees/SKILL.md:62` |
| Receta manual recomendada | commit → `bash .pandacorp/verify.sh` → `merge-queue.sh` | worktree de la sesión | full ×2 salvo sello | — | `mission-control/.pandacorp/guide.md` (sección Batch/Certified tree), BO:321-327 |

**Respuesta corta:** "listo" y "mergeable" **no pasan por el mismo gate**. Ningún camino de "listo" ejecuta el gate completo sobre el árbol que se va a mergear. El primer `vitest` entero y el primer Playwright completo (visual, responsive, headers, mobile, specs de comportamiento) sobre el árbol combinado y rebasado ocurren en `merge-queue.sh` (MQ:242).

## 2. La cola paso a paso (`MQ`)

1. Topología: worktree, rama, git-dir común, checkout de main (MQ:30-36).
2. Precondiciones → exit 20: estar en main (MQ:50), ser el checkout principal (MQ:51), árbol con cambios (`git status --porcelain` de **todo el repo**, MQ:52), no encontrar main (MQ:53).
3. Lock serializado `"$COMMON_DIR/pandacorp-merge.lock"` (mkdir atómico); espera de 5 s en 5 s hasta 600 s → exit 20; reclama lock con mtime > 15 min (MQ:56-70, 175).
4. Preflight "main ocupado": `git -C $MAIN_WT status --porcelain` no vacío → exit 12 (MQ:183-185). Para MC esto es el estado de **toda la fábrica**.
5. `git fetch` del checkout de main (MQ:188); quita skip-worktree y restaura `.claude/launch.json` y `e2e/server-env.json` comprometidos (MQ:192-201).
6. `git rebase main`; conflicto → abort → exit 10 (MQ:202-206).
7. Si `e2e/server-env.json` difiere de HEAD → exit 11; sin `jq` → exit 20 (MQ:214-219).
8. Decisión de sello: `green-stamp.sh check` OK → `[certified-tree]`, salta el gate (MQ:226-228). Si no → `[full-gate]` (MQ:230).
9. Con gate completo: sonda del puerto comprometido → exit 14 si ocupado (MQ:232-238); refresco del lock cada 60 s (MQ:79-98, 239); **slot de trabajo pesado del host sin límite de espera** (bucle infinito, MQ:124-152, 240; H_max = min(2, floor(ncpu/4)) = 2 en esta máquina de 10 CPUs, medido con `getconf`); `bash .pandacorp/verify.sh` (MQ:242); exit 75 del verify → exit 14 (MQ:244); borra `.next .next-fidelity test-results` (MQ:247); rojo → exit 11 (MQ:249-251).
10. Proyecto lanzado (`phase: release` y `deploy_target` ≠ internal) sin `PANDACORP_OWNER_RELEASE_OK=1` → exit 21 **después** del gate (MQ:256-268).
11. `git merge --ff-only` en main; falla → exit 12 (MQ:273-275).
12. Borra manifiesto del worktree (MQ:286); copia el sello al checkout de main si `check` sigue OK (MQ:291-296).
13. Lanzado: `git push origin main`; falla → exit 13 (MQ:301-306).
14. `change-reconcile.mjs --apply` en main, best-effort (MQ:313-316). Solo lee historial y mueve tarjetas gitignored; no hace commits (`change-reconcile.mjs:11-16, 161-204`).
15. No borra el worktree (MQ:277-285, 317); exit 0.
16. Trap EXIT (MQ:162-174): suelta refresco, slot y lock; **si el exit es ≠ 0, re-ejecuta `worktree-bootstrap.sh`**, que vuelve a reescribir el puerto y a poner skip-worktree.

Logs y tiempos: `MQ` **no escribe ningún log propio ni registra tiempos**; solo stdout/stderr y una notificación macOS en exits 10-14 (MQ:42-48). Lo único persistente es `.pandacorp/run/gate-report.json` de verify.sh, con `duration_ms` por etapa, **sobrescrito en cada corrida** (VS:127-130, 580-618). En el motor, la salida del job queda en `.pandacorp/run/build/jobs/<id>/out.log` (RB/paths.mjs:76, 133; RB/jobs.mjs:277).

Reintentos: la cola nunca reintenta por sí misma. Cada invocación corre el gate completo salvo sello válido. El motor reintenta exits 12/14/20 tras 60 s (RB/next/constants.mjs:13-14; RB/next/landing.mjs:15); dos exit 20 seguidos → ENGINE_FAILURE (RB/land/harvest.mjs:226-228); exit 11 → unidad `patch` hasta el intento 3 y luego hand-back (RB/land/harvest.mjs:111-151); lote solo de docs: un reintento del gate sin parche (RB/land/harvest.mjs:76-96).

## 3. Árbol certificado (`GS`, DR-146 / DR-158)

**Escritura** (`record`, solo desde verify.sh): (1) la corrida fue `scope: full` (VS:414, 627); (2) `start` vio el árbol limpio antes de cualquier etapa (VS:415; GS:106-112); (3) exit 0 (VS:625-629); (4) al final el `HEAD^{tree}` es el mismo (GS:119-120), (5) sigue limpio (GS:121) y (6) el hash de entradas es igual al del inicio (GS:122-123). Cualquier rojo borra el sello (VS:625-626; GS:170-172).

**Lectura** (`check`): flock compartido en `verify.lock`, si hay un verify vivo → duda (GS:135-153); versión 2 (GS:154); mismo `HEAD^{tree}` (GS:159-160); limpio (GS:161); mismo sha256 de verify.sh (GS:162-163); mismo `inputs_sha256` (GS:164-165); edad ≤ 43 200 s (GS:23, 166-167).

"Limpio" = `git status --porcelain` vacío (incluye no-trackeados no ignorados) **y** ninguna entrada skip-worktree/assume-unchanged en el índice (GS:95-101).

`inputs_sha256` (GS:41-89) incluye: `verify.sh`, `green-stamp.sh`, `.pandacorp/run/lane.env`, `vitest-policy.ts`, metadatos de `node_modules` (`.modules.yaml`, `.pnpm/lock.yaml`, `.package-lock.json`), **el directorio `e2e/` completo recorrido físicamente (también ficheros ignorados)**, `playwright.config.ts`, `package.json`, `*lock*`, `.env*`, `node --version` y **todas las variables de entorno** salvo una lista corta de controles (GS:75-87).

| Condición | Situación realista que la invalida |
|---|---|
| mismo `HEAD^{tree}` | main avanzó y la cola rebasó; el motor añade un commit de metadatos (`status.yaml`, WOs VERIFIED) antes del gate (RB/land/command.mjs:69-95) |
| limpio sin skip-worktree | **todo worktree bootstrapeado**: WB:222 pone skip-worktree a `e2e/server-env.json` (los tres proyectos lo tienen); WB:157-158 a `.claude/launch.json` si está trackeado (funko); los worktrees de unidad usan sparse checkout (RB/units/worktrees.mjs:222-223), que también marca bits skip-worktree |
| inputs: e2e/ | en el worktree, WB:212-213 reescribe el `PORT` de `e2e/server-env.json` → hash distinto del que verá la cola tras restaurarlo (MQ:194-201); en MC, ficheros ignorados que la propia corrida e2e crea dentro de `e2e/` (ver d) |
| inputs: entorno | cualquier variable distinta entre la corrida del verify y la de la cola: `session-cleanup ... run` exporta `PANDACORP_CLEANUP_SESSION`, `PANDACORP_SESSION_TEMP_BASE`, `TMPDIR`, `npm_config_cache` por sesión (`plugin/scripts/session-cleanup.mjs:148`), ninguna en la lista de controles (GS:75-82). El job `land` hereda el entorno del proceso que lo lanza (RB/jobs.mjs:84, 277; RB/land/command.mjs:98-102) |
| inputs: deps | `pnpm install` distinto (lockfile cambiado en el rebase) |
| verify.sh igual | `/pandacorp:upgrade` entre corrida y cola |
| ≤ 12 h | proyecto lanzado que espera la orden "aterriza" toda la noche (exit 21) |
| sin verify vivo | un hook Stop `--light` u otro verify en el mismo checkout durante `check` (GS:141-146) |

Respuestas precisas:

- **(a)** Sí. El sello liga el árbol raíz completo (`git rev-parse HEAD^{tree}`, GS:92). Si main avanzó con cualquier commit que cambie contenido, el árbol rebasado es otro y el sello **siempre** se invalida. La única excepción es un cambio neto vacío. En el motor además se reescribe el commit de metadatos (RB/land/command.mjs:30-41, 108-112), aunque con main quieto ese árbol puede repetirse (el sello liga el árbol, no el commit).
- **(b)** Vive **por worktree**: `STAMP=".pandacorp/run/green-stamp"` relativo al directorio del proyecto del checkout actual (GS:22). Solo se copia a main después de un aterrizaje (MQ:291-296). Evidencia: el único sello en disco está en `funko-tracker/.claude/worktrees/pensive-wing-dad871/.pandacorp/run/green-stamp` (medido con `find_stamps.py`), con árbol `d0db37b4…` igual al `HEAD^{tree}` actual de ese worktree, que ya está en main (`git branch --contains`).
- **(c)** No. G1 es `--light` (partial), G2 es `--since` (scope `since`), Stop es `--light` (partial): ninguno pasa `scope == full` y por tanto no llama a `start`/`record` (VS:289-295, 414). El rescate sí corre full, pero en un worktree de unidad con sparse checkout y skip-worktree → `start` devuelve vacío → no hay sello (VS:415; GS:108). El único full que puede escribir sello hoy es **el de la propia cola** (en el worktree ya rebasado y sin skip-worktree, MQ:192-201). El DR lo admite: "worktrees whose bootstrap sets skip-worktree overrides … can never pre-certify, by design, so there the skip only serves queue retries" (nota de DR-146 en REG). Por eso la receta "commit → verify.sh → queue" (BO:326-327) **nunca** ahorra el segundo full en ninguno de los tres proyectos (los tres tienen `e2e/server-env.json`): las dos corridas completas se pagan siempre.
- **(d)** Sí, en MC. Bajo `e2e/` hay ficheros ignorados que escribe la ejecución e2e: `e2e/fixtures/factory-root/factory/gamification-ledger.json` y `e2e/fixtures/factory-root/host/home/Library/Preferences/nextjs-nodejs/config.json` (`git status --ignored -- e2e`). El ledger lo escribe `snapshotGamificationLedger` cuando los totales cambian o el fichero es nuevo (`mission-control/src/app/_actions/snapshotLedger.ts:96-127`), con `PANDACORP_FACTORY_ROOT`/`HOME` apuntando al fixture (`mission-control/e2e/server-env.json`). Como `inputs_sha256` recorre `e2e/` físicamente (GS:65-71), en un checkout recién creado (integración del motor, worktree nuevo) la primera corrida e2e cambia las entradas entre start y end → `record` responde "inputs changed during the run — nothing certified" (GS:122-123). Esto es una inferencia del código y no está observado en un log. funko y ppv2 no tienen ignorados bajo `e2e/` en su checkout principal. Otros generados: `.next`, `test-results` y `next-env.d.ts` están ignorados y fuera de las entradas (`mission-control/.gitignore:12-13, 24`). `AGENTS.md` solo lo reescribe `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js:2`), y el full usa `prod-server.mjs` (VS:987-990); que `next build` no lo toque **no está verificado**. Las líneas base visuales nuevas se escriben localmente porque `updateSnapshots` vale `"missing"` fuera de CI (`playwright.config.ts:170`): aparecen como no-trackeadas bajo `e2e/` y ensuciarían el árbol y las entradas.
- **(e)** Sí. MC comparte el `.git` de la fábrica; `HEAD^{tree}` es el árbol de toda la fábrica y "limpio" abarca toda la fábrica (GS:92, 97-99). Cualquier `chore(memory)` mueve main → rebase → árbol nuevo. Medido: 44 commits en main en 7 días, 25 tocan `mission-control/` (`git log --since="7 days ago"`). El 19 y 20-nov las rutinas hicieron 5 commits `chore(memory)` entre 09:07 y 09:18. Además el preflight de "main ocupado" mira toda la fábrica (MQ:183).
- **(f)** `MAX_AGE_S=43200` (GS:23, 166-167). Solo pesa en el reintento tras exit 21 (proyectos lanzados: funko y ppv2): si "aterriza" llega más de 12 h después, se vuelve a pagar el full.

## 4. Ciclo de reparación tras un rojo de la cola

- **Motor v2:** G3 rojo (exit 11) → quita el commit de metadatos y crea una unidad `patch` con base en la rama de integración (ya rebasada) (RB/land/harvest.mjs:111-151; RB/units/worktrees.mjs:56). El parche se verifica **solo con G1** (`--light` + tests nuevos, en sparse checkout; RB/report.mjs:166-193), pasa revisión, se integra y vuelve a `land` → otro G3 completo. Presupuesto de 3 intentos y luego hand-back (RB/land/harvest.mjs:121-133; SKILL implement "three-execution budget"). Lote solo de docs: un reintento del gate sin parche (RB/land/harvest.mjs:76-96).
- **Sesión manual/lote:** "repair only that defect, commit, and re-run the full queue/gate once on the repaired combined result" (BO:310-315); "Max 3 repair attempts" (`docs/rules/quality-and-testing.md`). Para reproducir: `PANDACORP_VITEST_SEED=<seed> bash .pandacorp/verify.sh --only=vitest` (VS:942; guide). Como la cola rebasó la rama en su propio worktree (MQ:202), el arreglo se hace **sobre el árbol rebasado**. No se prescribe ningún gate intermedio obligatorio antes de reintentar: la verificación real del arreglo es el siguiente full de la cola.
- Consecuencia: como la certificación es fail-fast (VS:736-748, 941; `playwright.config.ts:166`), cada vuelta revela **solo el primer fallo**. Con N fallos independientes hacen falta ≥ N corridas completas. `--no-bail`/`--report-all` existen (VS:197-231) pero la cola no los usa (MQ:242).

## 5. Entorno: worktree vs checkout principal

- **Puerto e2e:** el worktree reescribe `e2e/server-env.json` con un PORT derivado de su ruta y lo oculta con skip-worktree (WB:177-223). La cola restaura el comprometido y exige que esté libre (MQ:194-201, 232-238): MC 3900, funko 4037, ppv2 4010. El "listo" corre Playwright en un puerto y la cola en otro. En funko, `BETTER_AUTH_URL` y `ORACLE_MEDIA_BASE_URL` siguen fijos en `:4037` (`funko-tracker/e2e/server-env.json`; WB:207-210 explica que es deliberado), así que el Playwright del worktree corre con origen desalineado y el de la cola alineado. Que eso cambie veredictos **no está verificado**.
- **BD de test (funko):** `ft_gate` compartida en `localhost:4032`, serializada por un lease (`funko-tracker/e2e/globalSetup.ts:14, 27`) y por el lock de la cola (MQ:209-212). El verify de un worktree y el gate de la cola compiten por ese lease (más espera). La DB por worktree la rechazó el dueño (MQ:211).
- **node_modules:** `pnpm install --offline --frozen-lockfile` con clones APFS y un marcador de hash del lockfile (WB:83-128). Ambos lados usan el mismo almacén y se hashean metadatos, no el contenido de `node_modules`.
- **`.env.local`:** en MC el worktree escribe `PANDACORP_FACTORY_ROOT=$WORKTREE` (WB:247-259); el principal no. En funko se copian `.env.local` y `.env.fidelity.local` del principal (`funko-tracker/.pandacorp/worktree-setup.sh:24-60`). Entran en el hash (`.env*`).
- **Líneas base visuales:** trackeadas en `e2e/visual.spec.ts-snapshots/`, `maxDiffPixelRatio 0.02` (`playwright.config.ts:174`). Localmente se escriben las que faltan (`updateSnapshots: "missing"`, línea 170). Se bendicen en el gate del FRD (DR-080, VS:1016-1018). Todo corre en la misma máquina; la dependencia de fuentes del host **no se verificó**.
- **Cachés:** `.next` por checkout, borrado tras el gate de la cola (MQ:247); `NEXT_SWC_PATH` solo en G1 (RB/report.mjs:174).
- **Carga del host:** como mucho 2 trabajos pesados simultáneos (G2 + verify de cola) por máquina (MQ:107-113; RB/admission/constants.mjs:59; RB/jobs.mjs:79). Medido en vivo: `~/.pandacorp/host/h-slots/slot-0/owner.json` lo tiene un merge-queue de funko (pid 35294, 23:33Z). funko usa `testTimeout: 20_000` (`funko-tracker/vitest.config.mts:31`).
- **Snapshot `panda-corp-live`/launchd:** es un worktree bloqueado en `/Users/Shared/local-deployments/panda-corp` (detached 56fcd1f9, `git worktree list`) que sirve MC en :1987 (`status.yaml:11`). No interviene en el gate (el e2e usa el fixture y el puerto 3900).

## 6. Tests inestables y orden

**Hay:**
- vitest siempre barajado con semilla explícita, impresa y registrada como `vitest_seed`, y reproducible (VS:417-423, 940-942, 586-587).
- Playwright con `retries: 0` (`playwright.config.ts:168`) y `workers:1` en lo visual.
- `--no-bail` para diagnóstico.
- Un único reintento de G3 en lotes solo de docs (RB/land/harvest.mjs:76).

**No hay:**
- reintentos de tests (DR-146 "No retries anywhere").
- cuarentena de tests inestables: la única "cuarentena" es la de rutas `BLOCKED: needs-owner` (`plugin/templates/stack-a-nextjs/e2e/_skip.ts:2-24`).
- registro histórico de inestabilidad por test.
- re-ejecución automática con la misma semilla para distinguir "inestable" de "roto" antes de abrir un parche.

**Corroboración medida:** dos jobs de aterrizaje consecutivos de funko, run `br-2026-11-13-02`, ambos `[full-gate]` con "no certified-tree stamp" y ambos rojos en vitest con fallos distintos y semillas distintas:
- `land-25-1`: seed 763470787, `PrismaClientKnownRequestError` en out.log:378; empezó 21:19:31Z, log cerrado 16:24:30 hora local.
- `land-25-2`: seed 391584655, "Test timed out in 20000ms" en out.log:261; empezó 21:27:50Z, log cerrado 16:34:16 hora local.
- Fuente: `funko-tracker/.pandacorp/run/build-suspended/br-2026-11-13-02/jobs/land-25-{1,2}/out.log`.

## 7. DR-138

Lanzados hoy según `status.yaml`: **funko-tracker** (`phase: release`, sin `deploy_target` → externo según MQ:258-259 y la regla de DR-138 "missing counts as external") y **personal-page-v2** (`release`/`external`). MC no (`internal`).

Restringe:
- nada llega a `main` de GitHub sin la orden explícita del dueño. Con la orden, la cola hace ff + push juntos (MQ:262-268, 301-306).
- el hook pre-push rechaza el push sin el flag (`funko-tracker/.git/hooks/pre-push` cabecera).
- el motor nunca pone el flag (RB/land/command.mjs:98-102).

Lo que **no** se puede mover a "después":
- el gate completo antes del ff+push, porque push = despliegue de producción (DR-138 (3)-(4); DR-158 "Keep full G3 certification before main").
- la orden del dueño antes del push.

Lo que sí es movible sin violarlo:
- el gate ya corre **antes** de la comprobación del dueño (MQ:226-253, luego 255-268), así que la espera por la orden no exige otro gate si el sello sobrevive (mismo árbol, mismo entorno, < 12 h).
- en MC (no lanzado) DR-138 no aplica, pero DR-158 sigue exigiendo el G3 completo antes de main.

## 8. Hipótesis ordenadas (por qué "listo" ≠ "mergeable")

1. **CONFIRMADA-EN-CÓDIGO: el primer gate completo sobre el árbol a mergear es el de la cola.** Stop = light (VBS:103-127), G1 = light (RB/report.mjs:166-176), G2 = `--since`, que solo corre smoke+shell (RB/next/constants.mjs:34; VS:991-992). Visual, responsive, headers, specs de comportamiento, móvil y el vitest no cambiado se ven por primera vez en MQ:242.
   - Predice: rojos de G3 en specs e2e no smoke/shell y en tests no tocados, y un "listo" verde que no anticipa nada de eso.
   - Explica los éxitos: cambios pequeños sin efecto en esas superficies aterrizan a la primera.
2. **CONFIRMADA-EN-CÓDIGO: el árbol certificado no puede aprovecharse en el primer aterrizaje desde un worktree.** El bootstrap pone skip-worktree (WB:222) → `start` no certifica (GS:108; VS:415). El PORT reescrito cambia `inputs` (WB:212; GS:65-71). Lo reconoce la nota de DR-146 en REG.
   - Predice: cada aterrizaje loguea `[full-gate] (… no certified-tree stamp)`, como en ambos jobs de funko (out.log:2), y si la sesión corrió un full antes, se pagan **dos** fulls (≈24 min cada uno en funko; medido en gate-reports full: 1407 s, 1459 s, 1499 s).
   - Explica los éxitos: el sello solo ayuda en reintentos de la cola tras un verde (exit 21 o un exit 12 al hacer el ff) con main quieto, mismo entorno y menos de 12 h; ese es el sello real de `pensive-wing-dad871`.
3. **CONFIRMADA-EN-CÓDIGO: el rebase invalida el sello en cuanto main avanza.** El sello liga el árbol raíz (GS:92, 159-160).
   - En MC lo agrava cualquier commit de la fábrica (44 commits en 7 días, rutinas `chore(memory)` diarias).
   - En el motor se suma el commit de metadatos (RB/land/command.mjs:69-95).
4. **CONFIRMADA-EN-CÓDIGO (MC): una corrida e2e en un checkout nuevo cambia `inputs`.** Crea ignorados bajo `e2e/fixtures` (snapshotLedger.ts:96-127; GS:65-71) → ni siquiera el full de la cola certifica en una integración nueva → el reintento tras un exit 12 al hacer el ff también paga el full. Que se dé en cada corrida (y no solo en la primera) es NO-DECIDIBLE-SIN-DATOS: lo resolvería un gate-report full de MC con el stdout de `green-stamp: …` o comparar mtimes del ledger entre corridas.
5. **CONFIRMADA-EN-CÓDIGO: la certificación es fail-fast** (VS:736-748, 941; `playwright.config.ts:166`), así que N fallos independientes necesitan N vueltas completas. Predice cadenas "rojo → arreglo → rojo" con un fallo distinto en cada vuelta (observado en land-25-1 → land-25-2).
6. **CONFIRMADA-EN-CÓDIGO (posibilidad): el arreglo se verifica con un gate más débil que el que lo juzga.** El parche pasa G1 light (RB/land/harvest.mjs:135-150; RB/report.mjs:166-193) y la siguiente prueba real es otro full G3. Predice que reparaciones "verdes" vuelvan rojas.
7. **CONFIRMADA-EN-CÓDIGO (posibilidad): el orden aleatorio sin cuarentena convierte la inestabilidad en rojos de cola.** Semilla nueva por corrida (VS:421-423), cero reintentos, `testTimeout` 20 s en funko. Que los dos rojos de funko fueran inestabilidad y no un defecto real es NO-DECIDIBLE-SIN-DATOS: lo resolvería re-ejecutar las semillas 763470787 y 391584655 sobre los mismos árboles, y la carga del host en esos minutos.
8. **CONFIRMADA-EN-CÓDIGO (posibilidad): esperas sin presupuesto antes de poder gatear.**
   - lock de merge hasta 10 min → exit 20 (MQ:66);
   - slot de host **sin límite** (MQ:131-151) compartido con los G2 de cualquier build (RB/jobs.mjs:79), con H_max = 2;
   - lease de la BD `ft_gate` en funko (`globalSetup.ts:27`).

   Cuánto suman es NO-DECIDIBLE-SIN-DATOS: la cola no registra tiempos. Harían falta las marcas de "waiting for a host heavy-job slot" en stderr y el `owner.json` histórico.
9. **CONFIRMADA-EN-CÓDIGO (MC): "main ocupado" mira toda la fábrica** (MQ:183, 273). Cualquier WIP sin commit en el checkout de la fábrica (otras sesiones, rutinas) da exit 12. El motor reintenta cada 60 s (RB/next/landing.mjs:15); una sesión manual devuelve el control. Frecuencia: NO-DECIDIBLE-SIN-DATOS (contar exits 12 en job logs del motor y en transcripciones).
10. **CONFIRMADA-EN-CÓDIGO (posibilidad): el hash de entorno incluye variables por sesión.** `TMPDIR`, `npm_config_cache` y `PANDACORP_CLEANUP_SESSION` del wrapper (`session-cleanup.mjs:148`) entran en el hash (GS:83-87) → un reintento lanzado desde otra sesión, o desde drive frente a CLI, no reutiliza el sello. NO-DECIDIBLE si ocurre en la práctica: requiere el stderr de `check` en un reintento tras exit 21.
11. **CONFIRMADA-EN-CÓDIGO (lanzados): exit 21 llega después de un full.** Si la orden tarda más de 12 h o main avanza, hay otro full completo (GS:166-167; MQ:255-268). Explica "una mañana" en funko y ppv2.
12. **DESCARTADA: que el puerto de la cola choque con el del worktree.** La cola restaura el comprometido y hace una sonda antes del gate (MQ:194-201, 232-238); un choque da exit 14 (reintento), no un rojo falso. **Sí es posible** un exit 14 si hay un dev/gate en 3900/4037/4010.
13. **DESCARTADA: que reconcile o el push sean lentos o fallen el merge.** reconcile es best-effort y solo lee (MQ:313-316); el pre-push solo comprueba el flag (cabecera del hook).
14. **DESCARTADA: deriva de los scripts de cola o sello entre proyectos.** Las tres copias son idénticas a la plantilla (sección 0).

## 9. Palancas baratas (sin diseñar la solución completa)

1. **Que el bootstrap no reescriba ficheros trackeados.** Inyectar el puerto del worktree por entorno o por un fichero ignorado (p. ej. `.pandacorp/run/lane.env`, que `playwright.config.ts:52-62` ya lee) en lugar de modificar `e2e/server-env.json` con skip-worktree (WB:177-223). Así un full en el worktree podría certificar. Lo impide hoy: `server-env.PORT` tiene precedencia sobre `lane.env` (`playwright.config.ts:64`, `serverEnv.PORT ?? laneEnv.PORT`), y `lane.env` entra en el hash (GS:66), así que el puerto del worktree seguiría difiriendo del de la cola → habría que excluirlo del hash o igualar el puerto.
2. **Rebase antes de certificar.** Que el "listo" haga `git rebase main` y luego el full, de modo que el rebase de la cola sea nulo (MQ:202). Lo impide hoy: la carrera con main (en MC, las rutinas de la fábrica) y la palanca 1.
3. **Que la cola no repita el trabajo del "listo".** Hoy la receta "commit → verify.sh → queue" (BO:326-327) paga dos fulls en los tres proyectos. Palanca mínima: avisar o abstenerse del full previo cuando hay entradas skip-worktree, o dejar que solo la cola corra el full (como ya hace el motor).
4. **Fijar el entorno hasheado a una lista de permitidas.** O añadir a `controls` (GS:75-82) `TMPDIR`, `npm_config_cache`, `PANDACORP_CLEANUP_SESSION`, `PANDACORP_SESSION_TEMP_BASE` y las variables de sesión del runtime. Lo impide: la decisión DR-158 de hashear "all ambient environment inputs" (REG DR-158; GS:84-85).
5. **Sacar del hash los ignorados que escribe la corrida e2e en MC** (fixture del ledger y `HOME/Library`), o hacer que el servidor e2e use una copia temporal del fixture. Lo impide: `add(Path('e2e'))` recorre todo `e2e/` (GS:65-71).
6. **Para proyectos anidados (MC), ligar el sello al subárbol del proyecto** (`HEAD:mission-control`) y no al árbol raíz. Lo impide (red team): los tests de MC pueden leer la fábrica real (`resolveFactoryRoot` usa `cwd/..`; AGENTS.md de MC), así que un commit de la fábrica **puede** cambiar el veredicto. Habría que probar primero que el gate no lee fuera de `mission-control/`.
7. **Ante un G3 rojo, un único diagnóstico `--no-bail --report-all`** (VS:197-231) que entregue todos los fallos al parche, para no descubrirlos de uno en uno. Coste: una corrida roja más larga. Lo impide: MQ:242 llama a verify.sh sin flags.
8. **Medir.** Que MQ escriba un log con marcas de tiempo (lock, slot, rebase, gate, ff) y el motivo de `green-stamp check`. Hoy no hay ninguno (sección 2), lo que deja NO-DECIDIBLES las hipótesis 4, 7, 8, 9 y 10.
9. **Preflight de "main ocupado" acotado al prefijo del proyecto en MC** (`git status --porcelain -- mission-control`), dejando que el `merge --ff-only` siga siendo el juez real (MQ:273). Lo impide: MQ:183 mira todo el checkout.
10. **Poner tope y registro a la espera del slot de host** (MQ:131-151), hoy infinita y silenciosa salvo stderr.

Script auxiliar usado (solo lectura): `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/out/find_stamps.py`.
