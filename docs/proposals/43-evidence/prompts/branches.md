Lee primero `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/prompts/common.md` y cúmplelo.

# Tarea: qué trabajo ya existe (en ramas o recién aterrizado) que toca la velocidad del gate o de la cola

Repositorio de la fábrica: `/Users/Shared/Proyectos/panda-corp`. Produce `branches.md` en tu directorio de trabajo.

1. **Ramas en curso.** Hay worktrees con las ramas `feat/verify-affected-browser-gates` (en
   `/Users/Shared/Proyectos/panda-corp-wt-verify-affected`) y `fix/engine-tests-ci` (en
   `/Users/Shared/Proyectos/panda-corp-wt-ci`). Para cada una: `git log --date=iso main..<rama>`, `git diff --stat main...<rama>`,
   si tiene cambios sin commitear (`git -C <wt> status --porcelain`), fecha del último commit, y un resumen fiel de QUÉ
   cambia en el gate (`verify.sh`/plantilla, selección de tests de navegador por impacto, CI, etc.), cómo decide qué
   specs correr, qué pasa cuando no puede decidir (¿corre todo?), y en qué estado está (¿terminada?, ¿mergeada en parte?).
   Lista también cualquier otra rama local no mergeada de las últimas 3 semanas cuyo nombre o diff toque
   `verify.sh`, `merge-queue.sh`, `green-stamp.sh` o `plugin/runtime/build/` (`git branch --no-merged main --sort=-committerdate`).
2. **Modos de selección que YA existen en `verify.sh`** (lee `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/verify.sh`
   y su plantilla en `plugin/`): para cada flag (`--light`, `--since`, `--only`, `--files`, `--tests`, `--no-bail` o equivalentes,
   variables `PANDACORP_*`), qué etapas corre, cómo selecciona tests de Vitest y de Playwright, si escribe sello de árbol
   certificado, y qué `scope` deja en `gate-report.json`. Cita archivo:línea.
3. **DR-158 y DR-159** en `factory/decisions/registry.yaml`: resumen fiel de qué cambiaron, las cifras que citan (marca
   que son cifras citadas por el registro, no medidas por ti) y qué dejaron explícitamente fuera o pendiente. Busca también
   en `factory/backlog/` ítems abiertos (`status: open|doing`) sobre velocidad del gate, la cola, tests inestables o el
   sello, y lístalos con id, título y estado.
4. **Playwright**: en los tres proyectos (`mission-control`, funko-tracker, personal-page-v2; rutas en `factory/portfolio.md`),
   de `playwright.config.ts`: nº de workers, reintentos, `maxFailures`, proyectos/navegadores, `fullyParallel`, si arranca
   `next build` + `next start` o `next dev`, y cuántos archivos de spec y cuántos tests hay (`rg -c "test\\(" e2e` como
   aproximación, márcalo como estimado). Igual para Vitest: nº de archivos de test y configuración de pool/workers.

Criterio de aceptación: cada afirmación cita archivo:línea o comando git con su salida. Mensaje final ≤ 40 líneas.
