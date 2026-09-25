---
type: change
class: standard
status: done
note: "3 of 4 WOs VERIFIED at the gate; WO-02-014 IN_REVIEW (whole-FRD oracle blocked on pre-existing FRD-02 drift, reconciled in main c34ba57c — see docs/decision-log.md 2026-09-25)"
affected_frds: [frd-02-ideas-board, frd-03-portfolio, frd-04-project-workspace, frd-05-work-orders]
date: 2026-09-24
frd:
implemented_sha: 9b7bde44fbc6026dcb09276b8ce3b31bcf6fb957
rebuilds_verified: false
shipped_at: "2026-09-25T13:37:51Z"
shipped_note: "canary D parallelism run (wf_faf48b18-881), rebased onto main and fast-forward merged; WO-02-014 left IN_REVIEW pending a fresh FRD-02 gate"
depends_on:
supersedes:
---

# Paquete de 4 mejoras pequeñas e independientes (portafolio, tablero de ideas, cola de cambios, work orders)

## Qué se quiere

**Nota para `iterate` (PM): esta card pide EXPLÍCITAMENTE ≥3 work orders INDEPENDIENTES** —
artefactos disjuntos, sin `dependsOn` entre ellas (DR-060) — para que el motor `powerful` pueda
construirlas en la MISMA oleada. Es el propósito del canario que originó esta card: medir el
paralelismo real del build. Abajo van 4 candidatas ya acotadas por archivo; el PM decide el scope
final (agrupar/ajustar), pero debe preservar la independencia de artefactos entre al menos 3 de
ellas. Cada una cabe en ~30-80 líneas de producción + su test propio.

### 1. Portafolio — chip de "última sincronización" relativa

`PortfolioEntry.lastSync` (`src/lib/portfolio/portfolio.ts`) se PARSEA desde la tabla markdown del
portafolio pero **nunca se renderiza** en ningún componente (verificado: único uso de `lastSync` en
todo `src/` son las 4 líneas del propio parser). Añadir:
- Un helper puro `src/lib/portfolio/formatLastSync.ts` que formatee la fecha a texto relativo en
  español ("hace 3 días", "hoy", "hace 2 meses") — usar `Date.parse` en el punto de comparación
  (nunca comparación lexicográfica de strings ISO, trampa verificada en `code-conventions.md`).
- Su test propio `src/lib/portfolio/_tests/formatLastSync.test.ts` (casos: hoy, ayer, hace N días,
  hace N meses, fecha inválida → manejo explícito, nunca `null`/`""` silencioso).
- Uso del helper en `src/components/modules/PortfolioTable/PortfolioTable.tsx` (`ProjectRow`):
  un chip adicional junto a los existentes (fase / construyendo-parado), solo cuando
  `entry.lastSync` está presente — reutilizar `CHIP_STYLE`, no inventar un estilo nuevo (DR-057).
- Artefactos: `src/lib/portfolio/formatLastSync.ts`, `src/lib/portfolio/_tests/formatLastSync.test.ts`,
  `src/components/modules/PortfolioTable/PortfolioTable.tsx` (+ su test existente si hace falta un
  caso nuevo). FRD candidato: FRD-03.

### 2. Tablero de ideas — estado vacío de columna accesible

En `IdeaBoardView.tsx`, una columna sin tarjetas hoy renderiza un `<div style={EMPTY_COLUMN_STYLE}
title="Columna vacía">—</div>`: el guion es puramente decorativo, sin `role` ni texto para lector de
pantalla — el `title` no es anunciado de forma fiable por todos los AT y el guion solo no transmite
significado (accessibility.md: "Never convey meaning by color/shape/position alone"). Cambiar a un
marcador con `role="status"` (o `aria-live="polite"`) y texto real ("Sin ideas en esta columna"),
visualmente discreto (puede seguir siendo el guion como contenido decorativo con
`aria-hidden="true"` + un `<span>` con clase visualmente oculta para el texto accesible, patrón ya
usado en otros estados vacíos del proyecto).
- Artefactos: solo `src/app/board/IdeaBoardView/IdeaBoardView.tsx` (+ su test en
  `src/app/board/IdeaBoardView/_tests/`). FRD candidato: FRD-02.

### 3. Cola de cambios del proyecto — fecha relativa en la tarjeta

`ChangeCard.tsx` (`src/app/projects/[slug]/_components/tab-changes/`) arma la línea de metadatos
con `[item.date, item.frd].filter(...).join(" · ")` mostrando `item.date` en crudo (ISO). Añadir un
helper propio (NO reusar/importar el de portafolio — dominio distinto, evita acoplar dos features
para mantener independencia de artefactos) `src/lib/changes/formatChangeDate.ts` con la misma
disciplina (relativo en español, `Date.parse`, fallo explícito ante fecha inválida) y su test
`src/lib/changes/_tests/formatChangeDate.test.ts`; usarlo en `ChangeCard.tsx` en lugar de la fecha
cruda.
- Artefactos: `src/lib/changes/formatChangeDate.ts`, `src/lib/changes/_tests/formatChangeDate.test.ts`,
  `src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx` (+ su test). FRD candidato: el
  que documente la vista de cola de cambios del proyecto (revisar índice de FRDs).

### 4. Kanban de work orders — filtro secundario por estado

`WoFrdFilter` (`src/app/projects/[slug]/_components/wo-frd-filter/wo-frd-filter.tsx`) solo filtra
por FRD; no hay forma de aislar, por ejemplo, solo las WO `in_progress` o `fail` dentro de un
proyecto con muchas FRDs. Añadir un control hermano `wo-state-filter` (mismo patrón: pills con
`Chip`, `aria-pressed`, client component) que filtre por `WorkOrderState` y se componga en
`WoFrdFilteredBoard` junto al filtro de FRD existente (combinables, AND lógico).
- Artefactos: nuevo `src/app/projects/[slug]/_components/wo-state-filter/wo-state-filter.tsx` (+ su
  test), edición de `src/app/projects/[slug]/_components/wo-frd-filtered-board/wo-frd-filtered-board.tsx`
  (+ su test). FRD candidato: FRD-05.

## Verificación de independencia (DR-060)

Artefactos por candidata, sin solapamiento entre sí:
- (1) `src/lib/portfolio/**`, `src/components/modules/PortfolioTable/**`
- (2) `src/app/board/IdeaBoardView/**`
- (3) `src/lib/changes/**`, `src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx`
- (4) `src/app/projects/[slug]/_components/wo-state-filter/**`,
      `src/app/projects/[slug]/_components/wo-frd-filtered-board/**`

Ninguna toca el floor (auth, dinero, PII, persistencia, irreversible, secretos/CI, los oráculos, la
maquinaria de la fábrica, `.pandacorp/`, `plugin/`) — todas son UI/lib de solo lectura sobre datos
que Mission Control ya lee. Se espera rigor `normal`.

## Contexto

Origen: preparación del **canario D** (medición de paralelismo real del motor de build). Los
canarios anteriores (A "speed sprint", B/B2 "digested gate", C "portada seal") nunca midieron
`concurrency_max` porque su change tenía una sola WO — no había nada que paralelizar. Esta card
existe para dar al motor `powerful` ≥3 WOs independientes en la misma FRD/oleada y así poder leer
`concurrency_max` real vs. tiempo secuencial en el próximo `/pandacorp:implement` de este worktree
(`canary-d-parallelism`, worktree `/Users/Shared/Proyectos/panda-corp-canary-d/mission-control`).
No se ha lanzado el build desde esta preparación — queda para la sesión principal.
