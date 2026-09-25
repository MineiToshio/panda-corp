# Plan de lanzamiento — Canario E (gates en paralelo + digested + DR-122)

Preparado por el agente preparador del canario E. Fuente de diseño: `docs/proposals/38-parallel-frd-gates-and-drift-policy.md`, sección **"Red-team addendum (2026-09-25)"**, específicamente **A5 · Q4 — Canario E**. Toda cifra de este documento está anclada a una lectura en vivo (CONV-13); se marca "NO PUDE VERIFICAR" donde corresponde.

## 1. SHA elegido y por qué

**`c575adfcb44e129fe712f7b922fbbf1472376180`** — `feat(frd-05-work-orders): WO-05-007 — add state filter to work-orders kanban`.

Verificado en vivo:
- `git merge-base --is-ancestor c575adfc main` → **es ancestro de `main`** (HEAD actual `4a15f4cc`).
- Es el commit citado como evidencia **e11** del propio addendum: *"`c575adfc` is a perfect replay base for the gate segment: WO-02-014/03-006/04-008/05-007 all `IN_REVIEW`, `last_green_sha: d9addc89` (the base D2's gates used)"*. No hizo falta buscar en `git log 3b820278..83c32888` — el addendum ya identificó y verificó este commit como la base exacta que revisaron los gates de D2; mi propia relectura de los 4 work orders y de `status.yaml` en ese commit (tabla §2) reproduce exactamente lo que e11 afirma.
- `git show --stat c575adfc` — toca solo los ficheros de WO-05-007 (componente `WoStateFilter`, tests, `wo-frd-filtered-board.tsx`, el WO doc y `track.jsonl`); es el último commit de construcción de las 4 WOs, ANTES de cualquier `apply-gate`/veredicto de D2 (los primeros eventos de gate de D2 aparecen en el `usage_summary` de `wf_faf48b18-881`, con el primer gate arrancando después de este commit).

## 2. Estado inicial verificado de las 4 WOs (en `c575adfc`)

| Work order | Ruta | `status` | `implementation_status` |
|---|---|---|---|
| WO-02-014 | `mission-control/docs/frds/frd-02-ideas-board/work-orders/wo-02-014-empty-column-a11y.md` | `ACTIVE` | `IN_REVIEW` |
| WO-03-006 | `mission-control/docs/frds/frd-03-portfolio/work-orders/wo-03-006-last-sync-chip.md` | `ACTIVE` | `IN_REVIEW` |
| WO-04-008 | `mission-control/docs/frds/frd-04-project-workspace/work-orders/wo-04-008-change-card-relative-date.md` | `ACTIVE` | `IN_REVIEW` |
| WO-05-007 | `mission-control/docs/frds/frd-05-work-orders/work-orders/wo-05-007-wo-state-filter.md` | `ACTIVE` | `IN_REVIEW` |

Las 4 confirmadas `IN_REVIEW`/`ACTIVE` mediante `git show c575adfc:<ruta> | grep -E 'implementation_status|^status:'`.

**FRD-02 — deriva AC-02-010.4/.8 intacta (sin reconciliar):** leí `frd.md` en ese commit; AC-02-010.4 y AC-02-010.8 están presentes en la sección REQ-02-010 tal cual el addendum las describe (fichas de fase — incluida la mención textual de "Claude Design" / arquitectura / build en AC-02-010.8), sin ningún marcador de reconciliación posterior. Esto coincide con e11 y con la frase explícita del Setup de A5: *"AC-02-010.4/.8 and REQ-03-001 drift intact"*. La reconciliación real de AC-02-010.4 (commit `c34ba57c`) ocurrió **después** de D2, fuera de este commit — así que el canario E debe reproducir la detección de esa deriva, no verla ya resuelta.

## 3. `last_green_sha`

`status.yaml` en `c575adfc`: **`last_green_sha: "d9addc89"`**. Verificado ancestro: `git merge-base --is-ancestor d9addc89 c575adfc` → **sí**. `d9addc89` = `fix(decision-id-emitter): independently verify FRD-24 patch, mark WO-24-001/002 VERIFIED` — es el sha que la prueba diferencial DR-122 (a\*) usa como `base` para cada `probe(C)`.

`overlay_version` en `c575adfc`: **`8.86.0`** (dato observado; la tarea original citaba 8.85.0 — diferencia de una versión, marcada aquí para que quien instale el motor candidato lo tenga en cuenta).

## 4. Puerto e2e del worktree

`.pandacorp/worktree-bootstrap.sh` derivó **puerto `3962`** (hash de la rama `canary-e-parallel-gates`), confirmado en `mission-control/e2e/server-env.json`. No coincide con el puerto reservado de `main` (3900, el caso límite documentado en X7/e8 del addendum) ni con los slots 0-2 (3957/3988/3902) citados en e8.

## 5. Ruta del worktree y estado de aislamiento

- Worktree: `/Users/Shared/Proyectos/panda-corp-canary-e` (rama nueva `canary-e-parallel-gates`, creada con `git worktree add -b canary-e-parallel-gates ... c575adfc`).
- `mission-control/.pandacorp/worktree-bootstrap.sh` corrido con éxito (pnpm hardlink install, `launch.json` con sufijo `-canary-e-parallel-gates`, `PANDACORP_FACTORY_ROOT` apuntando al propio worktree anidado).
- **Gate-worktrees limpios (precondición del red-team X1/X2):** `mission-control/.pandacorp/run/` **no existe** en el canario — no hay ningún `gate-worktree` previo que limpiar. Precondición cumplida sin necesidad de `git worktree remove --force` / `prune`.
- **Lease/`running` quiesciado:** el `status.yaml` heredado del commit traía `running: true`, `supervisor_heartbeat` y `build_run_id`/`build_lease_epoch` residuales de la corrida real de D2 (el lease que murió sin cerrar limpio — consistente con e9, el kill por límite de sesión). `node .../pandacorp-build-state.mjs status --project .../panda-corp-canary-e/mission-control` devolvió `{"lease":null,"fresh":false}` **antes y después** del cambio: no existe fichero de lease vivo en este worktree (no se puede invocar `quiesce` del CLI porque exige un lease activo que fence-ar). Por tanto corregí a mano, solo en el worktree del canario, `running: true → false` y `supervisor_heartbeat: "..." → ""` (los dos únicos campos que `reassertActiveProjection(..., {running:false})` tocaría al quiesciar un lease real; `run_started_at`/`build_run_id`/`build_lease_epoch` se dejan como rastro histórico, igual que haría esa función). Único cambio sin commitear en el worktree del canario: `mission-control/.pandacorp/status.yaml` (`git status --porcelain` → ` M mission-control/.pandacorp/status.yaml`). **No se tocó nada en `main`, en `local-deployments` ni en `mission-control/.pandacorp/run/gate-worktree` de main.**
- **Verificación adicional (fuera de contrato, informativa):** inspeccioné (solo lectura) `mission-control/.pandacorp/run/gate-worktree` de `main` — hoy está **limpio** (`git status --porcelain` vacío), lo que contradice el estado que el propio addendum registró como evidencia `e12` ("MC's real gate worktree is dirty right now"). Alguien lo limpió entre el 2026-09-25 de la redacción del addendum y ahora; lo dejo anotado como discrepancia, no lo toqué.
- **No instalé el motor candidato.** El overlay de `c575adfc` es `8.86.0`; `parallelGates`/`maxParallelGates`/`gateEvidence` **no existen** en el plugin instalado (9.111.0: confirmado por `grep -rl "parallelGates\|maxParallelGates"` en `plugin/` y `factory/` → cero resultados de código, solo la mención en `plugin/docs/decision-log.md`). Otro agente debe copiar, DESPUÉS de esta preparación, al worktree del canario:
  - `.claude/engines/pandacorp-build.js` (el motor con `parallelGates` — versión candidata, previsiblemente 9.112.0)
  - `.pandacorp/verify.sh`
  - `.pandacorp/worktree-bootstrap.sh`
  - el campo `overlay_version` en `mission-control/.pandacorp/status.yaml` (a la versión del overlay que acompañe a ese motor)

## 6. `pandacorp:mech` y agentes — caché 9.111.0

`~/.claude/plugins/cache/panda-corp/pandacorp/9.111.0/agents/` contiene los 15 agentes con nombre, incluido `mech.md`: `analytics, architect, backend-dev, copywriter, designer, devops, frontend-dev, implementer, librarian, mech, product-manager, researcher, reviewer, security-auditor, test-writer`. Confirmado presente.

## 7. Qué mide el canario E y contra qué se compara

Réplica de un solo tramo de gates (D2, tal como lo corrieron sobre este código exacto), motor candidato = `parallelGates` + `gateEvidence:'digested'` + DR-122 (a\*), motor base = D2 (9.108.0, gates en serie, `gateEvidence` no-digested, sin DR-122).

### 7.1 Baseline D2 real — desglose por fase, en **dólares deduplicados** (corregidos, BL-0181)

Fuente: `mission-control/.pandacorp/track.jsonl`, la línea `usage_summary` de `wf_faf48b18-881` marcada `"corrected":"BL-0181"` (la segunda de las dos entradas para esa corrida; la primera es la agregación sin deduplicar, 58.58 $, superada por A1 del addendum). Cifras leídas directamente del JSON, no recalculadas de memoria:

| Fase | Duración (wall, s / min) | Coste dedup |
|---|---:|---:|
| Baseline | 44.6 s / 0.7 min | 0.06 $ |
| Plan | 142.1 s / 2.4 min | 1.20 $ |
| Build | 1056.5 s / 17.6 min | 3.68 $ |
| Review (gates + patches + visual-qa) | 5109.3 s / 85.2 min | 31.30 $ |
| **Total (`wall_clock_s`)** | **5250.4 s / 87.5 min** | **36.24 $** |

Segmento de gates ("serial-equivalent gate work" del addendum, por FRD, gate + su patch/verify-patch/apply-gate/persist-block asociado):

| FRD | Gate (min / $) | Patch (min / $) | Verify-patch (min / $) | Apply-gate / persist-block (min / $) | Total FRD (min / $) |
|---|---:|---:|---:|---:|---:|
| frd-02 (directo) | 17.6 min / 7.48 $ | — | — | 1.4 min / 0.12 $ (persist-block) | **19.0 min / 7.60 $** |
| frd-03 (parche) | 11.8 min / 5.77 $ | 2.8 min / 0.84 $ | 2.7 min / 0.71 $ | — | **17.3 min / 7.32 $** |
| frd-04 (parche) | 13.5 min / 6.46 $ | 3.0 min / 0.81 $ | 2.1 min / 0.63 $ | — | **18.6 min / 7.90 $** |
| frd-05 (directo) | 9.6 min / 4.89 $ | — | — | 2.4 min / 0.22 $ (apply-gate) | **12.0 min / 5.11 $** |
| **Suma** | **52.6 min / 24.61 $** | | | **0.34 $** | **66.9 min / 27.93 $** |

visual-qa (fuera del segmento de gates, tramo final serial): 12.05 min / 3.01 $.

Estas cifras reproducen exactamente las del addendum (66.9 min de "serial-equivalent gate work", 24.61 $ de las 4 revisiones, 27.95 $ ≈ 27.93 $ del "gate ladder" completo, 36.24 $ del total dedup) — confirmación cruzada entre el análisis del addendum y la relectura directa del `track.jsonl` real.

### 7.2 Qué aísla E en una sola corrida

- **D1 (`parallelGates`)** — por la razón de solape (Σ de los propios tramos de gate de E ÷ el reloj de pared del segmento de gates de E) y contra el "serial-equivalent" de D2 (66.9 min arriba). El uso de `gateEvidence:'digested'` en ambos lados de la comparación cancela ese factor fuera de la medida de D1.
- **`gateEvidence:'digested'` (opción b)** — coste de revisión deduplicado por FRD contra los 24.61 $ de D2 **sobre código byte-idéntico** (mismo commit exacto), más paridad de hallazgos (no perder los `CORRECTION` de validación de fecha en frd-03/frd-04, ni el resultado en verde de frd-05).
- **DR-122 (a\*)** — determinísticamente sobre FRD-02 (ruta directa) y FRD-03 (la que sea que tome el gate): FRD-02 debe aterrizar `VERIFIED` + cards `draft` para AC-02-010.4/.8 con probes en rojo en la base; FRD-03 `VERIFIED` + 1 card para REQ-03-001; 0 cards sobre contratos propios de las WOs.
- **`c` (contención)** — vía `vm_stat` pageouts por gate e inflación de los tramos.

## 8. Criterios de éxito (del addendum, A5)

- **D1:** segmento de gates **≤ 40 min** (≤ 60 % de 66.9 min) con 2 slots; **0** caídas a modo legacy; todos los slots limpios al final; 0 violaciones de auditoría de `last_green_sha`; 0 reds por ruido de entorno (timeout de `webServer`, `Cannot find module`).
- **`gateEvidence:'digested'`:** Σ coste de revisión **≤ 18.5 $ dedup** (−25 % vs 24.61 $) **y** debe re-encontrar los dos `CORRECTION` de validación de fecha (frd-03, frd-04) y el veredicto limpio de frd-05, 0 hallazgos perdidos (si no, revertir a "explore").
- **DR-122:** FRD-02 `VERIFIED` + cards `draft` para AC-02-010.4/.8 con probes rojos en la base; FRD-03 `VERIFIED` + 1 card para REQ-03-001; 0 cards sobre contratos propios.
- **Seguridad:** `verify.sh` completo en verde al close-out.
- Presupuesto esperado: **≈ 22-30 $ dedup** (≈ 36-48 $ en unidades del rollup sin deduplicar), sin fase de build ni de plan (las 4 WOs ya están `IN_REVIEW`).
- Ruido conocido: n = 1 por FRD; el replay elimina el ruido del builder, no el del juez (estocástico) — dejarlo dicho en el informe final de E.

## 9. Args previstos del Workflow (motor candidato, NO lanzado por este agente)

```json
{
  "mode": "powerful",
  "maxAgents": 40,
  "frds": ["frd-02-ideas-board", "frd-03-portfolio", "frd-04-project-workspace", "frd-05-work-orders"],
  "parallelGates": true,
  "maxParallelGates": 2,
  "gateEvidence": "digested",
  "driftPolicy": "record"
}
```

**Nota sobre `maxParallelGates`:** el brief original de esta preparación mencionaba `gateSlots: 3`; el addendum (fuente de diseño canónica de este canario, hallazgo **X6**) fija el valor por defecto en **2 slots para una máquina de 16 GB** ("`maxParallelGates` default derived from `hw.memsize`: 16 GB → 2, ≥32 GB → 3"). La máquina de este checkout **no fue re-verificada por este agente** (e6 del addendum ya midió 16 GB / Apple M5 / 10 núcleos, sysctl en vivo) — si sigue siendo la misma máquina, el valor correcto es 2, no 3. Dejo ambos números explícitos para que quien lance el canario decida con el dato fresco.

`driftPolicy: "record"` es el nombre de flag que el propio addendum recomienda para el rollback de a\* ("Add a rollback switch `args.driftPolicy: 'record' | 'block'`").

## 10. Comando de preflight + launch (motor candidato `<VER>`, a rellenar cuando otro agente instale el engine)

El `launch-implement.sh`/`preflight-implement.sh` instalados hoy (9.111.0) **no tienen** flags para `parallelGates`/`maxParallelGates`/`gateEvidence`/`driftPolicy` (confirmado: cero resultados en `plugin/scripts/preflight-implement.sh` y `plugin/scripts/launch-implement.sh`). El comando de abajo asume que el motor candidato `<VER>` los añade como flags `--parallel-gates`, `--max-parallel-gates`, `--gate-evidence`, `--drift-policy` (o el `args` JSON equivalente si el launcher pasa a aceptar overrides) — **a confirmar contra el script real de `<VER>` antes de ejecutar, no asumir la sintaxis**:

```bash
cd /Users/Shared/Proyectos/panda-corp-canary-e/mission-control

# 1. Preflight (solo lectura) — todas las líneas deben leer PASS
bash "$HOME/.claude/plugins/cache/panda-corp/pandacorp/<VER>/scripts/preflight-implement.sh" \
  /Users/Shared/Proyectos/panda-corp-canary-e/mission-control \
  --target-runtime claude --run-mode auto

# 2. Launch (toma el lease, imprime el Workflow() exacto — ejecutar ese, nunca construirlo a mano)
bash "$HOME/.claude/plugins/cache/panda-corp/pandacorp/<VER>/scripts/launch-implement.sh" \
  /Users/Shared/Proyectos/panda-corp-canary-e/mission-control \
  powerful 40 auto \
  --frds frd-02-ideas-board,frd-03-portfolio,frd-04-project-workspace,frd-05-work-orders \
  --parallel-gates --max-parallel-gates 2 \
  --gate-evidence digested \
  --drift-policy record \
  --ttl 3600
```

## 11. Resumen para la salida del agente

- SHA elegido: `c575adfcb44e129fe712f7b922fbbf1472376180` (ancestro de `main`, e11 del addendum).
- Las 4 WOs: `IN_REVIEW` / `ACTIVE`, verificado en el commit.
- FRD-02: deriva AC-02-010.4/.8 intacta (sin reconciliar) en ese commit — verificado leyendo `frd.md`.
- `last_green_sha`: `d9addc89` (ancestro de `c575adfc`, verificado).
- Puerto e2e: `3962`.
- Worktree: `/Users/Shared/Proyectos/panda-corp-canary-e` (rama `canary-e-parallel-gates`).
- Motor candidato: **NO instalado** por este agente (overlay sigue en `8.86.0`); pendiente de otro agente.
- `status.yaml` del canario: quiesciado a mano (`running:false`, `supervisor_heartbeat:""`) porque no hay lease vivo que quiesciar vía CLI; cambio sin commitear, solo en el worktree del canario.
