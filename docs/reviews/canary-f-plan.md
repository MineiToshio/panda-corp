# Canarios F1 y F2 — plan de lanzamiento

Preparado por el agente preparador de F1/F2. Fuente de diseño: `factory/backlog/BL-0201-canary-f1-f2-cost-lever-without-lost-findings.md`,
`docs/reviews/canary-e2-report.md` §3.2/§5/§6, `docs/reviews/canary-e-plan.md`. Toda cifra está anclada a lectura en vivo
(CONV-13); se marca "NO PUDE VERIFICAR" donde corresponde.

## 0. Worktrees preparados

| Canario | Ruta | Rama | Puerto e2e | Base |
|---|---|---|---|---|
| F1 | `/Users/Shared/Proyectos/panda-corp-canary-f1` | `canary-f1` | **3970** (forzado con `PANDACORP_E2E_PORT`; el hash de la ruta derivaba **3962**, colisión directa con el puerto ya reservado de canario E) | `e045b293` |
| F2 | `/Users/Shared/Proyectos/panda-corp-canary-f2` | `canary-f2` | **3988** (derivado por hash, sin colisión) | `e045b293` |

Verificado en ambos worktrees tras `bash .pandacorp/worktree-bootstrap.sh`:
- `node .../scripts/pandacorp-build-state.mjs status` → `{"lease":null,"fresh":false}` (sin lease vivo) en los dos.
- `mission-control/.pandacorp/status.yaml` (heredado de `e045b293`): `last_green_sha: "d9addc89"`, `running: false`,
  `overlay_version: "8.89.0"`.
- Las 4 WOs `IN_REVIEW` / `ACTIVE` en `e045b293` (releídas del árbol, no de memoria):

  | WO | Ruta | `status` | `implementation_status` |
  |---|---|---|---|
  | WO-02-014 | `mission-control/docs/frds/frd-02-ideas-board/work-orders/wo-02-014-empty-column-a11y.md` | `ACTIVE` | `IN_REVIEW` |
  | WO-03-006 | `mission-control/docs/frds/frd-03-portfolio/work-orders/wo-03-006-last-sync-chip.md` | `ACTIVE` | `IN_REVIEW` |
  | WO-04-008 | `mission-control/docs/frds/frd-04-project-workspace/work-orders/wo-04-008-change-card-relative-date.md` | `ACTIVE` | `IN_REVIEW` |
  | WO-05-007 | `mission-control/docs/frds/frd-05-work-orders/work-orders/wo-05-007-wo-state-filter.md` | `ACTIVE` | `IN_REVIEW` |

- FRD-02 AC-02-010.8 sigue con la deriva viva, sin reconstruir: `frd.md` (línea 97-100) exige que la ficha "Design"
  mencione **Claude Design** + `components.md` + tokens, y la ficha "Architecture" mencione **foundation**; el
  `phases.ts` real (`mission-control/src/components/modules/CampaignPipeline/phases.ts`, bloque `design`/`architecture`
  líneas 135-166) no contiene ninguna de esas tres palabras (`grep -i "claude design\|components.md\|foundation"` → 0
  resultados). Confirma que F1/F2 miden sobre el mismo terreno de deriva que D2/E1/E2.
- **Overlay NO subido** en ninguno de los dos worktrees (permanece `8.89.0`, motor idéntico al de canario E) — a
  propósito, por instrucción de esta preparación. Lista de ficheros que el cierre 9.115.0 debe copiar antes de lanzar
  (mismo patrón que canario E §5 de `canary-e-plan.md`):
  - `.claude/engines/pandacorp-build.js` (motor candidato — ya trae `gateContextScope`/`GATE_CONTEXT_SCOPE` en
    9.114.0, ver §3 abajo; el `driftFinder` de F2 aún no existe en ningún motor publicado, ver §3.2)
  - `.pandacorp/verify.sh`
  - `.pandacorp/worktree-bootstrap.sh`
  - el campo `overlay_version` en `mission-control/.pandacorp/status.yaml` (a la versión del overlay que acompañe a
    ese motor; hoy en main es `8.91.0`, plugin `9.114.0`)

## 1. Tabla de referencia — los 5 defectos conocidos del replay (ground truth, canary-e2-report.md §3.2)

| # | Defecto | Fichero:línea | Clase | Quién lo encontró |
|---|---|---|---|---|
| 1 | AC-02-010.8: las fichas Campaign no reflejan el contenido actual de la fábrica (Claude Design / `components.md` / foundation) | `mission-control/src/components/modules/CampaignPipeline/phases.ts:136-166` (bloque `design`/`architecture`) | deriva preexistente, fuera del diff | D2 explore: **encontrado**. E1 digested: perdido. E2 digested: **perdido** (2/2) |
| 2 | REQ-03-001: `ACTIVE_PHASES` sigue incluyendo `"architecture"` | `mission-control/src/lib/portfolio/portfolio.ts:329` (`ACTIVE_PHASES`, usado en línea 406) | deriva preexistente, fuera del diff | D2 explore: encontrado (reportado). E1 digested: encontrado (probado DR-122). E2 digested: **perdido** ("pass, foundation, no re-revisado") |
| 3 | FRD-03 `formatLastSync`: `Date.parse` laxo de V8 fabrica edades (`"N/A 3"` → 2001-03-01, `"2026-02-30"` → 2026-03-02) | `mission-control/src/lib/portfolio/formatLastSync.ts:41-42` (`Date.parse(date)` + `Number.isNaN(parsedMs)`, sin validación adicional) | CORRECTION, dentro del diff | D2 explore: encontrado. E1 digested: encontrado. E2 digested: **perdido** (solo probó strings que V8 ya rechaza) |
| 4 | REQ-03-007: el chip de última sincronización solo existe en `PortfolioTable`, que **no está montado** en ninguna ruta de la app | `mission-control/src/components/modules/PortfolioTable/PortfolioTable.tsx:341-388` (`LastSyncChip`); 0 imports desde `mission-control/src/app/**` (verificado, `grep -rn "from .*PortfolioTable" src/app` → vacío) | CORRECTION, dentro del diff | D2 explore: perdido. E1 digested: **encontrado**. E2 digested: **encontrado** |
| 5 | FRD-04 `formatChangeDate`: día calendario en UTC + `Date.parse` laxo | `mission-control/src/lib/changes/formatChangeDate.ts:32` (`Date.UTC(...)`) y `:50` (`Date.parse(trimmed)`) | CORRECTION, dentro del diff | D2 explore: encontrado. E1 digested: no gateado. E2 digested: **encontrado** |

**Recall base:** D2 explore 4/5 (perdió #4) a 24.61 $ Σ gate / 52.6 min. E2 digested 2/5 (perdió #1, #2, #3) a 9.26 $ / 47.4 min.
Cifras reales BL-0181-dedupe, `canary-e2-report.md` §2.3.

## 2. Qué mide cada canario y contra qué se compara

Ambos son réplicas de los gates de D2 desde el mismo `c575adfc` (worktrees `panda-corp-canary-f1`/`f2`, base `e045b293`),
motor ≥ 9.114.0, sin fase de build ni plan (las 4 WOs ya `IN_REVIEW`). Corren en **serie** (RAM 16 GB del canario E, X6
del addendum 38): primero F1, después F2.

### F1 — `explore` + `gateContextScope` (+ `parallelGates` con la corrección BL-0194)

- **Args:** `mode:powerful, maxAgents:60, parallelGates:true, gateSlots:2, gateEvidence:'explore', gateContextScope:true`,
  frds `frd-02-ideas-board,frd-03-portfolio,frd-04-project-workspace,frd-05-work-orders`.
- **Mide:** (a) paridad de hallazgos contra los 5 defectos de §1 (`gateContextScope` deja los docs de las demás WOs
  VERIFIED solo con cabecera, así que #1 y #2 deben verificarse explícitamente — ¿el gate tocó `phases.ts` /
  `ACTIVE_PHASES` en su transcript?); (b) coste por gate vs D2 explore (24.61 $ / 52.6 min); (c) tiempo total del
  segmento de gates con FRD-05 (dependiente) gateado en paralelo gracias a BL-0194 (el fix de "dependency orders
  landing only" ya aterrizado en main, commit `7c741f90` — **no está en el motor de e045b293**, es una de las razones
  por las que el overlay debe subirse antes de lanzar, ver §0).
- **Compara contra:** D2 (gate en serie, `explore`, sin `gateContextScope`) por fase — tabla §2.3 de `canary-e2-report.md`
  — y E2 (`digested` + `parallelGates`, sin `gateContextScope`) por el efecto aislado de `gateContextScope` sobre el
  mismo `explore`.
- **Criterios de éxito:** paridad ≥ 4/5 (BL-0201: "recall ≥ 4/5 with both drifts found or proven (DR-122)" — es decir,
  #1 y #2 concretamente, no cualquier par) **y** Σ coste de gate ≤ 18.5 $ (−25 % vs 24.61 $, el bar A6 #4 del addendum 38)
  **y** segmento de gate ≤ 40.1 min (60 % de 66.9 min, el "serial-equivalent" de D2) **y** tiempo total menor que E2 con
  FRD-05 en paralelo real (no el falso paralelismo de E2, §4.2 de `canary-e2-report.md`: 23.2 min perdidos esperando el
  lanzamiento del gate dependiente). Pasa → se activa `parallelGates` por defecto (y `gateContextScope` si cargó con el
  recorte de coste).
- **Coste estimado (PROYECCIÓN, no medido):** gates ≈ 17-20 $ (explore a 125-143 k de contexto menos el recorte de scope),
  slots + aterrizajes + 2 escaleras de parche ≈ 5 $, close-out + visual-qa ≈ 3 $ → **≈ 25-30 $ real, ≈ 55-70 min**.

### F2 — `digested` + buscador de deriva sonnet de FRD completa

- **Args:** `mode:powerful, maxAgents:60, parallelGates:true, gateSlots:2, gateEvidence:'digested'`, mismos 4 FRDs, más
  el flag nuevo del buscador de deriva (`driftFinder`, nombre provisional — **no existe en ningún motor publicado hoy**,
  ver §3.2).
- **Mide:** si el buscador de deriva sonnet (lente `find:drift`, lecturas sin límite, acotado a los ACs NO propiedad de
  una WO revisada, con sus reclamos pasados por la prueba diferencial DR-122 existente) recupera los 3 hallazgos que
  `digested` perdió en E2 (#1, #2, #3 de §1) manteniendo el ahorro de coste de `digested`.
- **Compara contra:** E2 (`digested` sin buscador, 9.26 $ / 2-5 recall) y D2 (`explore`, 24.61 $ / 4/5 recall) como techo
  de paridad.
- **Criterios de éxito:** paridad ≥ 4/5 incluyendo #1 y #2 **y** Σ evidencia + gate + buscador ≤ 18.5 $ **y** coste ≤
  E2 + 25 % (E2 fue 9.26 $ de Σ evidencia+gate → tope ≈ 11.6 $ solo en esa partida, sin contar el buscador; BL-0201 fija
  el tope compuesto en 18.5 $ igual que F1, así que ambos criterios deben leerse juntos: el tope duro es 18.5 $ Σ
  evidencia+gate+buscador).
- **Coste estimado (PROYECCIÓN, no medido):** E2 (15.2 $) + 4 buscadores × ≈ 0.4-0.8 $ + pruebas DR-122 ≈ 0.1 $ →
  **≈ 17-19 $ real, ≈ 65 min**, más ≈ 3-5 $ de trabajo de agente para construir y probar el buscador (ese coste de
  construcción NO cuenta contra el criterio de éxito del canario, es coste de ingeniería previo).

### Límite honesto (ambos)

n = 1 por FRD por modo. Los fallos dentro-de-diff de E2/D2 (#3 en E2, #4 en D2) parecen varianza del juez, no señal —
un pase en una sola corrida es evidencia, no prueba; el `flip` a default debería esperar una segunda corrida
consistente si el presupuesto alcanza (≈ 2× el coste de arriba).

## 3. Flags que faltan en el launcher (9.114.0) — hallazgo de esta preparación

Inspección directa de `~/.claude/plugins/cache/panda-corp/pandacorp/9.114.0/scripts/launch-implement.sh` (grep del
parseo de argumentos, líneas 10-59):

```
[--parallel-gates [--gate-slots <1-8>]] [--gate-evidence explore|digested]
```

Son los **únicos** flags de esta familia que el launcher acepta hoy. Confirmado por grep exhaustivo (`case "$1"` /
`case "$GATE_EVIDENCE"`): **no existen** `--gate-context-scope` ni ningún flag para el buscador de deriva de F2.

- **`gateContextScope`:** el MOTOR (`templates/shared/.claude/engines/pandacorp-build.js` de 9.114.0, líneas 108,
  260, 2025-2032, 2189, 2239, 2309) **ya lo implementa** como `args.gateContextScope` (`GATE_CONTEXT_SCOPE =
  argBool(args, 'gateContextScope', true)` — nombre de constante engañoso, el default real de `argBool` con ese
  tercer parámetro es **true**, pero el comentario de línea 108 y la entrada de `test-pandacorp-build.mjs:5615`
  documentan que el default pretendido es **off** hasta que un canario lo mida; quien lance F1 debe pasar
  `gateContextScope: true` explícito en el JSON de `args` del `Workflow()` en vez de confiar en el default de
  `argBool`, y confirmarlo releyendo esa línea en el motor que finalmente se copie). Solo falta el flag de CLI
  (`--gate-context-scope`) para no tener que editar `args` a mano.
- **`driftFinder` (F2):** cero menciones en `9.114.0` completo (motor, scripts, skills, docs) fuera de este plan y de
  `BL-0201`. El worktree `/Users/Shared/Proyectos/panda-corp-f2` (rama `f2-drift-finder`) —el que BL-0201 describe
  como "en construcción por otro agente"— está hoy (verificado en vivo) al mismo HEAD que `main` (`7284ada5`), `git
  diff --stat main..HEAD` vacío y `git status --porcelain` limpio: **no hay trabajo todavía visible en esa rama**. Se
  deja anotado sin tocar ese worktree (no es responsabilidad de esta preparación).
- **Conclusión para el cierre 9.115.0:** debe (a) añadir `--gate-context-scope` a `launch-implement.sh` (mecánico,
  el motor ya soporta el arg) y (b) esperar a que el buscador de deriva de F2 exista y tenga su propio flag antes de
  que F2 pueda lanzarse tal cual está diseñado en BL-0201. La skill de `implement` prohíbe construir el `Workflow()`
  a mano, así que ningún agente de esta preparación debe intentar pasar `gateContextScope`/`driftFinder` sin que el
  launcher los soporte.

## 4. Comandos de preflight/launch (patrón `canary-e-plan.md` §10, adaptado)

### F1

```bash
cd /Users/Shared/Proyectos/panda-corp-canary-f1/mission-control
bash "$HOME/.claude/plugins/cache/panda-corp/pandacorp/<VER>/scripts/preflight-implement.sh" \
  /Users/Shared/Proyectos/panda-corp-canary-f1/mission-control --target-runtime claude --run-mode auto
bash "$HOME/.claude/plugins/cache/panda-corp/pandacorp/<VER>/scripts/launch-implement.sh" \
  /Users/Shared/Proyectos/panda-corp-canary-f1/mission-control \
  powerful 60 auto \
  --frds frd-02-ideas-board,frd-03-portfolio,frd-04-project-workspace,frd-05-work-orders \
  --parallel-gates --gate-slots 2 --gate-evidence explore \
  --gate-context-scope \
  --ttl 3600
```

`--gate-context-scope` **no existe en 9.114.0** (§3) — este comando asume que `<VER>` (el cierre 9.115.0) lo añadió.
Si `<VER>` sigue sin el flag, quien lance debe releer §3 y decidir si edita el `args` JSON por otra vía permitida por
la skill, o si espera al cierre siguiente.

### F2

```bash
cd /Users/Shared/Proyectos/panda-corp-canary-f2/mission-control
bash "$HOME/.claude/plugins/cache/panda-corp/pandacorp/<VER>/scripts/preflight-implement.sh" \
  /Users/Shared/Proyectos/panda-corp-canary-f2/mission-control --target-runtime claude --run-mode auto
bash "$HOME/.claude/plugins/cache/panda-corp/pandacorp/<VER>/scripts/launch-implement.sh" \
  /Users/Shared/Proyectos/panda-corp-canary-f2/mission-control \
  powerful 60 auto \
  --frds frd-02-ideas-board,frd-03-portfolio,frd-04-project-workspace,frd-05-work-orders \
  --parallel-gates --gate-slots 2 --gate-evidence digested \
  --drift-finder \
  --ttl 3600
```

`--drift-finder` es un nombre PROPUESTO, no confirmado — el buscador ni su flag existen todavía (§3). **No lanzar F2**
hasta que ambos existan y hayan pasado su propio TDD (la skill de `implement` prohíbe construir el `Workflow()` a
mano cuando el launcher no lo soporta).

## 5. NO PUDE VERIFICAR

- Si la máquina que ejecutará F1/F2 sigue siendo la de 16 GB / Apple M5 medida por el addendum 38 (X6) — no se
  reverificó `sysctl` en esta preparación; `gateSlots: 2` asume que sigue siéndolo.
- El contenido real del buscador de deriva de F2 (no existe código que auditar todavía).
- Si `--gate-context-scope`/`--drift-finder` llegarán al launcher exactamente con esos nombres en 9.115.0.
- Si hay contención de RAM real corriendo F1 y F2 en serie en esta máquina (no medido, igual que en canario E).
