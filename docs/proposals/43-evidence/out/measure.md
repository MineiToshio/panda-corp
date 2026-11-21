# Medición del gate completo y del sello green-stamp (2026-11-20)

Todos los logs y salidas citados están en este mismo directorio (`out/`).

## 1. Comprobaciones previas

### personal-page-v2: NO MEDIDO (regla de árbol limpio) — `pre-ppv2.txt`
- `git status --porcelain --untracked-files=all` devolvió `?? .pandacorp/navigation-identity.json` (árbol sucio; rama `main`). Contenido: `{"schemaVersion":1,"projectId":"project_f4c634bd-..."}`.
- Sin builds vivos: `build.lock` vacío (0 bytes, 6 oct), sin pid. Un worktree extra: `.claude/worktrees/gallant-sanderson-f04745`.
- Por la regla "árbol no limpio => no medir" se omite y se pasa a MC.

### mission-control: medido — `pre-mc.txt`
- Árbol limpio (factoría entera y MC), rama `main`, HEAD 494ec4f8.
- `build.lock` vacío (30 oct). `verify.lock` contiene `pid=95664` (creado 18:48): `ps -p 95664` no devuelve nada (proceso muerto, resto de un gate ligero previo). Sin procesos verify/merge-queue/vitest/next vivos; solo `playwright-mcp` (herramienta del navegador de esta sesión, no un gate).
- `~/.pandacorp/host/h-slots/` vacío: ningún gate pesado de otro proyecto. Worktrees de la fábrica: 3 adicionales, ninguno con build vivo.
- Carga: al empezar (18:54) `load averages: 6.04 6.83 8.34` (`uptime-mc-start.txt`); al terminar (19:03) `7.85 13.50 12.25` (`uptime-mc-end.txt`). La máquina no estaba ociosa.
- Evidencia previa copiada a `before-mc/`: solo existía `gate-report.json` (scope=partial, gate ligero 18:48); no había `green-stamp`.

## 2. Gate completo: mission-control (rc=0, verde)

Tiempo de pared total: **523,3 s (8 min 43 s), medido** (`real 523.34`, user 700,35 s, sys 158,13 s; `verify-mission-control.log`). Reloj externo: 523 s. scope=full, green=true, vitest_seed=347387652.

| Etapa | s (medida) | % del pared |
|---|---|---|
| playwright | 446,67 | 85,3 % |
| vitest | 54,48 | 10,4 % |
| doc-lint | 9,55 | 1,8 % |
| residual-ambiguity | 2,75 | 0,5 % |
| madge | 2,44 | 0,5 % |
| tsc | 1,75 | 0,3 % |
| knip | 1,60 | 0,3 % |
| biome | 0,93 | 0,2 % |
| live-data-asserts | 0,14 | 0,03 % |
| structure-guard / data-layer / api-error-contract | 0,019 / 0,004 / 0,007 | ~0 % |
| Suma de etapas | 520,32 | 99,4 % |
| Overhead (pared menos suma) | 3,0 | 0,6 % |

- Vitest: 540 archivos, 5544 tests pasados (2 todo); `Duration 53.15s` (transform 22,6 s, setup 62,4 s, import 66,5 s, tests 165 s, environment 119,8 s, acumulados entre hilos).
- Playwright: 890 tests, 890 passed, 7,2 min, 3 workers. Sin flaky ni reintentos (el grep de `flaky|retry|failed` no encuentra nada).
- Al final el log imprime: `green-stamp: inputs changed during the run — nothing certified`.

### personal-page-v2: sin medir (ver sección 1).

## 3. Experimento del sello (mission-control) — `stamp-mc.txt`, `why-mc.txt`, `funko-wt.txt`

1. `ls -la .pandacorp/run/green-stamp`: `No such file or directory`. El gate verde NO dejó sello.
2. `git status --porcelain --untracked-files=all`: vacío. `git ls-files -v | grep -E '^(S|[a-z]) '`: vacío (sin skip-worktree). El árbol quedó limpio.
3. `green-stamp.sh check` inmediato: `green-stamp: no certified-tree stamp`, rc=1.
4. `TMPDIR=/private/tmp/otro-tmp ... check`: `green-stamp: no certified-tree stamp`, rc=1. `FOO_PRUEBA=1 ... check`: igual, rc=1.
5. Worktrees de funko-tracker (solo lectura): los 4 worktrees bajo `.claude/worktrees/eloquent-nash-b37282` (raíz, integration y 2 de `build/wt`) tienen `S .claude/launch.json` y `S e2e/server-env.json` (skip-worktree activo) y ninguno tiene `green-stamp`. El checkout principal de funko no tiene entradas ocultas y SÍ tiene un `green-stamp` (234 bytes, 18:52 de hoy; no ejecuté nada ahí).

Causa de que no haya sello (lectura de `.pandacorp/green-stamp.sh`, rama `record`): la huella de entradas (`inputs_sha256`) se calcula al inicio y se recalcula al final; incluye el directorio `e2e` completo y recursivo. Una búsqueda de archivos más nuevos que el inicio del gate muestra que `e2e/fixtures/factory-root/**` (events.ndjson, .pandacorp, factory/memory, backlog...) fue modificado durante el run. Los tests Playwright escriben ahí, la huella cambia y `record` se niega.

Veredictos:
- "El sello queda utilizable justo después de un gate completo verde": REFUTADA en MC (no hubo sello; el gate lo descartó por "inputs changed during the run"). Causa probable: `e2e/` se hashea y el propio gate lo muta (inferida de código + mtimes).
- "El sello incluye todas las variables de entorno, así que otra sesión no puede aprovecharlo": NO CONCLUYENTE por experimento (sin sello, TMPDIR y FOO_PRUEBA dan el mismo rc=1 que el check sin variables). Confirmada por lectura de código: `inputs_sha256` hashea `os.environ` entero salvo una lista de controles (algunos `PANDACORP_*`, `_`, `SHLVL`, `PWD`, `OLDPWD`, `PS1`, `PS2`, `TERM`, `COLUMNS`, `LINES`); `TMPDIR` y cualquier `FOO_*` entran en la huella.
- "Worktrees de funko con `e2e/server-env.json` oculto": CONFIRMADA (4/4 listados). Además `tree_is_clean` rechaza todo árbol con entradas `S`, así que esos worktrees nunca certifican ni coinciden.

## 4. Incidencias y límites

- ppv2 no medido por árbol sucio (archivo sin seguimiento `.pandacorp/navigation-identity.json`); no lo toqué, mis límites lo prohíben.
- Carga de fondo en la máquina (load 6,0 al inicio, 7,9 al final) con actividad no atribuible; las cifras podrían estar algo sesgadas al alza. No había gate pesado de otro proyecto (h-slots vacío), por eso no se esperó.
- No se comparó la huella antes/después en `e2e/`; la causa de "inputs changed" es inferencia sólida (código + mtimes), no prueba aislada.
- El `verify.lock` obsoleto (pid 95664 muerto) no bloqueó el gate.
