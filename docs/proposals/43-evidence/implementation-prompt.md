# Implementar la propuesta 43: "listo" = la cola salió verde

## Objetivo y por qué
Implementa por completo la propuesta aprobada `docs/proposals/43-done-means-queue-green.md` en esta fábrica y en sus tres proyectos. El dolor medido es la duración del gate por el número de vueltas. En funko-tracker, desde el 13-nov, llevar un cambio de la primera pasada por la cola a `main` tarda una mediana de 25,5 min y un p90 de 209 min (n = 22). Una pasada verde dura una mediana de 17,6 min (n = 20), y 9 de 22 cambios necesitaron 3 vueltas o más. Mission Control tarda 523 s, el 85 % en el navegador. Además, hay un camino a producción sin gate: dos push directos a funko. Y la cola tiene defectos reales: un proceso que se cansa de esperar borra el candado ajeno, y `verify.sh` dice verde aunque el sello se rechace.

**Terminado** significa que se cumplen las cuatro condiciones:
- Las fases 0, 0.5, 1 y 2, más lo decidido de la 3, están en `main` de la fábrica y empujadas.
- Cada fase lleva su versión de plugin y overlay, su DR, su entrada de decision log y sus pruebas de maquinaria en verde.
- Mission Control, funko-tracker y personal-page-v2 tienen cada overlay. Los lanzados, solo con la orden del dueño; sin ella, quedan en "certificado, espera tu orden".
- Hay un reporte del antes y el después con cifras medidas.

Si el memo y su evidencia siguen sin commitear, empieza con un commit solo de docs y marca el memo como aprobado, con sus decisiones.

## Lee primero (no re-investigues ni re-decidas)
- **El memo entero.** Sus rutas `S/...` corresponden a `docs/proposals/43-evidence/...` (por ejemplo, `S/out/rules.md` es `docs/proposals/43-evidence/out/rules.md`). Lo clave: §2, §8 (fases, pruebas y decisiones que se enmiendan) y §10-11.
- **En `docs/proposals/43-evidence/out/`:**
  - `final-verification.md`: las correcciones obligatorias. Confirma que el memo las aplica.
  - `dispositions.md` y `decisions-es.md`.
- **Skills y estándares:** `plugin/skills/learn/SKILL.md`, `plugin/skills/upgrade/SKILL.md`, `plugin/skills/implement-backlog/SKILL.md`, `factory/standards/build-orchestration.md` (sesiones paralelas, DR-158, DR-159) y `plugin/docs/engine-tests.md`.

El diagnóstico ya pasó dos red-teams y un verificador. Lo que sí debes hacer es contrastar con el código vivo cada línea que el memo cita antes de tocarla.

## Decisiones tomadas (2026-11-20, criterio: "lo más fácil y rápido sin perder fiabilidad")
- **1 = A:** fases 0, 0.5 y 1, y luego la 2.
- **2 = A:** en los proyectos lanzados, el pre-push exige que el commit empujado haya pasado el gate completo. Hay un bypass, `PANDACORP_OWNER_UNGATED_PUSH=1`, que queda registrado.
- **3 = A:** la orden de aterrizar se pide al empezar. DR-138 no cambia.
- **4 = A:** el navegador de Mission Control sigue siendo bloqueante y se acelera con datos de prueba por proceso.
- **5 = B:** registro de tests sospechosos. Exclusiones solo en Mission Control, autorizadas por el dueño una a una, con caducidad de 14 días como máximo y corrida nocturna.
- **6 = C:** el gate falla cuando los tests nuevos de un cambio superan un tope propio, con línea base y avisos generales.

Estas decisiones ya cubren la puerta del dueño que `learn` exige.

## Cómo se cambia esta fábrica
**Plantilla primero (DR-076).** La maquinaria vive en tres sitios:
- `plugin/templates/shared/.pandacorp/`: `merge-queue.sh`, `green-stamp.sh`, `worktree-bootstrap.sh`, `change-reconcile.mjs`, `guide.md.tpl` y `hooks/pre-push`, que instala `plugin/scripts/install-pre-push.mjs`.
- `plugin/templates/stack-a-nextjs/`: `verify.sh` y `e2e/playwright.config.ts`.
- `plugin/templates/shared/AGENTS.md.tpl`.

`/pandacorp:upgrade` regenera las copias de los proyectos, así que el cambio se hace en la plantilla. El Stop hook es `plugin/scripts/verify-before-stop.sh`. El motor está en `plugin/runtime/build/` (`land/harvest.mjs`, `land/command.mjs`, `jobs.mjs`, `admission/hostSlots.mjs`).

**Cierre de cada fase.** Haz en este orden:
1. Sube la versión en `plugin/runtime/plugin-metadata.json` (hoy 10.14.3) y en `plugin/templates/OVERLAY_VERSION` (hoy 9.4.2). Luego ejecuta `node plugin/scripts/generate-plugin-manifests.mjs`.
2. Añade una entrada en `plugin/docs/decision-log.md`. Si tocaste estándares o el registro, añade otra en `factory/decision-log.md`. Si cambiaste reglas que llegan a los proyectos, actualiza `plugin/templates/rules/` (por ejemplo, `quality-and-testing.md`).
3. Ejecuta `claude plugin validate plugin/`. Si tocaste `factory/standards/`, ejecuta también `bash factory/standards/check-standards.sh`.
4. Fusiona a `main` (la fábrica no tiene cola), haz push y ejecuta `claude plugin update pandacorp@panda-corp`.
5. Actualiza los proyectos: primero Mission Control (interno, por su cola), luego `../funko-tracker` y `../personal-page-v2`.

**Registro de decisiones.** Crea un DR nuevo para "listo = cola verde". Hoy el siguiente es DR-165, pero relee `factory/decisions/registry.yaml` justo antes de escribir. Declara las enmiendas a DR-096, DR-141, DR-146, DR-153, DR-158 y DR-159. Declara también la de la regla "captura ausente = bendecir" (DR-056/080), que solo cambia en el gate completo. DR-138 no se toca.

**Pruebas de maquinaria.** Se corren con `bash plugin/scripts/run-engine-tests.sh`. Cada suite `.sh` nueva se añade a `EXPLICIT_SH_SUITES` en ese mismo script.

**Cambios en un proyecto.** Lo que cambie la app de Mission Control (mostrar los sospechosos, el Manual según DR-046) va por `/pandacorp:implement` dentro de `mission-control/`. Los archivos propios de un proyecto se commitean en él y aterrizan por su cola.

**No mezcles versiones.** Tu sesión cargó el plugin viejo. Para cada upgrade, comprueba que la versión instalada coincide con este checkout y sigue el `plugin/skills/upgrade/SKILL.md` del checkout con `CLAUDE_PLUGIN_ROOT=/Users/Shared/Proyectos/panda-corp/plugin`.

## Fases (cada una se entrega sola antes de empezar la siguiente)
El alcance, las pruebas y el criterio de éxito de cada fase están en su fila de §8. Aquí solo va lo que no se puede perder.

**Fase 0. Medir sin cambiar el comportamiento.**
- `.pandacorp/run/queue-log.jsonl` (nuevo), resuelto desde el proyecto, con un UUID por intento y los eventos de §8.
- Informes del gate archivados como inmutables.
- Métricas Q y R de "terminado a main" y vueltas por episodio.
- Aceptación: pasan `test-queue-log-events.sh` y `test-gate-report-archive-unique.sh` (nuevos) y los `test-merge-queue-*.sh` existentes, y cada evento ff coincide con el reflog.

**Fase 0.5. Arreglos baratos.**
- Toda la fila 0.5 del memo, más `with-merge-lock.sh` (nuevo) para la rutina de memoria, upgrade, sync, implement-backlog y `.claude/engines/pandacorp-backlog.js` si fusiona a `main`.
- Lo que exigió el verificador:
  - El paso de entorno tras el rebase solo toca dependencias, `next typegen` y herramientas. Nunca reescribe `e2e/server-env.json` ni `.claude/launch.json`, ni marca skip-worktree. Lo prueba `test-merge-queue-env-step-keeps-committed-config.sh` (nuevo).
  - `verify.sh` hereda la plaza pesada de la cola, que nunca ocupa dos.
  - `updateSnapshots: "none"` solo aplica con `GATE_SCOPE=full`.
- Éxito:
  - 0 rojos de entorno con arreglo mecánico (hoy, 5 de 22).
  - `[certified-tree]` en al menos el 90 % de las re-corridas con orden cuya base no se movió.
  - Mission Control graba sello.

**Fase 1. Un solo "listo".**
- Los estados de la cola y `merge-queue.sh --status` (sello con `base=`).
- El motor registra 21/0.
- Aviso del Stop hook en los worktrees.
- La receta "commit → merge-queue.sh" en `implement`, `worktrees`, `sync`, `implement-backlog`, los estándares y las plantillas.
- `record` obligatorio antes del ff, solo cuando ya funcione el arreglo de salidas de Mission Control.
- Pre-push con prueba de gate, `--diagnose-unit`, comprobación previa a re-encolar y `.pandacorp/run/test-outcomes.jsonl` (nuevo).
- Pruebas: las de la fila 1 más `test-pre-push.sh`.
- Éxito:
  - Ningún "en main" ni "certificado" sin su evento en el log.
  - Mediana, p90 y porcentaje con 3 vueltas o más, comparados con la línea base y con su n.

**Fase 2. Gate más rápido.**
- Fixtures por worker y revisión del tier serie de Mission Control (`mission-control/e2e/serial-specs.json`, `mission-control/e2e/parallel-safe.json`, `mission-control/playwright.config.ts`).
- El puerto del worktree sale del archivo versionado en los tres proyectos.
- funko: primero el perfil de §2.5 y después las palancas que justifique.
- Pruebas: `test-e2e-tiers.mjs` ampliado y `test-playwright-port-precedence.sh` (nuevo).
- Éxito: Mission Control a 6,5 min o menos en 3 verdes seguidos (hoy 8,7), y el perfil de funko con cifras.

**Fase 3. Solo lo decidido.**
- 5 B:
  - Exclusiones por id exacto, con motivo, autorización del dueño y caducidad de 14 días como máximo.
  - El sello caduca con la exclusión más próxima.
  - Los proyectos lanzados las rechazan.
  - Una prueba demuestra que ningún agente puede excluir por su cuenta.
  - Corrida nocturna en un worktree desechable sobre `main`, documentada en `plugin/docs/routines.md`.
- 6 C: tope al tiempo de los tests que añade cada cambio, con la línea base revisada en `.pandacorp/gate-budget.json` (nuevo en los proyectos, DR-159).

## Riesgos que debes probar antes de activar
- **Pre-push.** No está verificado que el sello coincida en el checkout principal (prueba 2). La prueba 1, el evento de la cola, va primero. No actives la regla hasta que `test-pre-push-requires-stamp.sh` (nuevo) cubra un aterrizaje con las dependencias, `e2e/` y `.env*` del checkout principal.
- **`record` obligatorio.** Si se activa antes que el arreglo de salidas, Mission Control deja de aterrizar.
- **Sin verificar:**
  - Si `next build` reescribe `AGENTS.md` durante el gate. Compara `git status` antes y después.
  - Cuánto tarda el paso de entorno cuando no tiene nada que hacer, que debe caber en los 2 min.
  - Qué hace `updateSnapshots: "missing"`.
- **Salidas declaradas.** Si son demasiado amplias, esconden residuos. Lo que no esté en la lista sigue invalidando.
- **Fuera de alcance:** frenar los tests ad hoc de otras sesiones y el sandbox completo de fixtures.
- **Orden del dueño.** Ningún trabajo en segundo plano hereda `PANDACORP_OWNER_RELEASE_OK`.

## Límites
- **Producción.** El `main` de funko-tracker y de personal-page-v2 es producción (DR-138): sin la orden del dueño no empujes ni aterrices. Nunca pongas tú `PANDACORP_OWNER_UNGATED_PUSH`.
- **Probar la cola.** La cola de un proyecto lanzado publica. Pruébala con repos sintéticos, como hace `plugin/scripts/test-merge-queue-certified-tree.sh`.
- **Comprobación previa.** Antes de un gate, una cola o un upgrade, comprueba que no hay nada vivo: `node plugin/scripts/pandacorp-build.mjs status --project <p>`, `bash plugin/scripts/check-build-liveness.sh <p>/.pandacorp/status.yaml` y `git status`. Si lo hay, sigue con otra cosa.
- **Protecciones.** Ni `--no-verify` ni borrar candados ajenos: es la protección que estás reforzando.
- **Sesiones paralelas.** Es normal que otras sesiones cambien `plugin/` y `factory/`. Haz `git add` solo de tus archivos y no reviertas lo ajeno. Si chocan versiones en `plugin-metadata.json`, conserva la más alta y regenera.
- **Datos sin historial.** `.pandacorp/` y `factory/{ideas,memory,profile.md,portfolio.md}` no tienen historial: no los borres en bloque.
- **Al cerrar.** Limpia tus worktrees y temporales (CONV-21, DR-145). Anota las lecciones en el momento en `factory/memory/_inbox.md`.
- **Cupo.** Si se agota, deja cada fase en `main` o en su rama con commits, para poder retomarla.

## Primer minuto (después no te bloquees)
El dueño se va 2-3 h. Antes de empezar, envía un solo mensaje con una ficha CONV-20:
1. **Orden de aterrizar por adelantado (3 A)** para cada aterrizaje en producción: el upgrade de cada fase en funko-tracker y en personal-page-v2, y la fase 2 de funko. Si no responde, avanza con lo demás y deja esos aterrizajes en exit 21.

Ya decidido, no lo preguntes: **no se espera la semana de línea base** que el memo pide entre la fase 0 y la 0.5. La línea base son las transcripciones (n = 22, en `docs/proposals/43-evidence/out/v3counts.py`) más lo que acumule el registro nuevo; dilo al principio del reporte.

Si te surge una duda después, resuélvela con evidencia. Si sigues inseguro, consulta a otro agente de otro modelo. Si nadie la resuelve, déjala arriba en el reporte y sigue trabajando.

## Reporte final (en español, para quien no vio el trabajo)
Empieza con `---` y una etiqueta en negrita. Después:
- **Por fase:** qué quedó en `main` (con commits), las versiones y qué proyectos se actualizaron o esperan orden.
- **Medición:** el antes y el después, marcando cada cifra como medida o estimada y con su n.
- **Verificación:** qué no se pudo verificar y por qué, y qué afirmaciones del memo desmintieron tus pruebas.
- **Decisiones nuevas:** como ficha (Contexto de un párrafo, Opciones A/B/C, Recomendada).
- **Limpieza:** qué limpiaste.
