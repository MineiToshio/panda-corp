# Bitácora — Cockpit (Mission Control)

Decisiones de producto, diseño y técnicas del cockpit (la app Next.js). Lo más reciente arriba. Ver índice y formato en [BITACORA.md](../../BITACORA.md).

> El estado vivo del proyecto está en [docs/estado.yaml](estado.yaml); el PRD en [docs/prd.md](prd.md) y los FRDs en [docs/frds/](frds/). Aquí va el **porqué** de las decisiones, no el estado.

## 2026-06-15 — Gate de onboarding + tags del tablero (categoría + retorno)
**Qué:** El cockpit gana un **gate de onboarding**: si no encuentra `fabrica/perfil.md`, muestra —antes que nada— un banner que pide correr `/pandacorp:onboarding` (FRD-01). En el tablero, cada tarjeta pasa de un solo tag (monetizable/personal/ambas) a **dos**: **categoría** (tipo de solución: web/mobile/desktop/IA/claude-code/prompts/automatización/CLI/rework) con icono, y **retorno** (monetario/oportunidad/personal/mixto) con color; el filtro ahora es por categoría (FRD-02). Prototipo HTML actualizado y verificado en preview.
**Por qué:** Sin perfil la fábrica no puede recomendar alineado (de ahí el gate). Un solo tag binario no capturaba ni el tipo de proyecto ni el modelo de retorno (dinero u oportunidad); dos ejes ortogonales lo hacen claro en el board.
**Impacto:** `cockpit/docs/frds/frd-01-lectura-de-datos.md`, `cockpit/docs/frds/frd-02-tablero-ideas.md`, `cockpit/prototype/index.html`. Relacionado: `fabrica/ideas/_plantilla-ficha.md`, DR-039.

## 2026-06-14 — Bitácora del cockpit creada
**Qué:** Arranca la bitácora de decisiones del cockpit.
**Por qué:** Parte de la disciplina "documentar todo" de la fábrica — ver [fabrica/bitacora.md](../../fabrica/bitacora.md).
