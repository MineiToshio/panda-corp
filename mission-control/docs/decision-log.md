# Bitácora — Mission Control

Decisiones de producto, diseño y técnicas de Mission Control (la app Next.js). Lo más reciente arriba. Ver índice y formato en [BITACORA.md](../../BITACORA.md).

> El estado vivo del proyecto está en [docs/estado.yaml](estado.yaml); el PRD en [docs/prd.md](prd.md) y los FRDs en [docs/frds/](frds/). Aquí va el **porqué** de las decisiones, no el estado.

## 2026-06-15 — Configuración refleja servicios-externos + DR-032..039
**Qué:** El prototipo (Configuración → Estándares y Reglas) se sincronizó con la fábrica: se agregó la tarjeta del estándar **servicios-externos** (dominio Operación) al "Códice de artesanía", y el registro de decisiones —que se cortaba en DR-031— ahora incluye **DR-032..039** (iterar sin avanzar, datos personales, versionado del plugin, Vercel/pagos, servicios externos + cuentas, secretos/aprovisionamiento, push en gates, recomendaciones según el perfil). El resumen del stack ahora nombra los servicios (R2, Resend, Kit, Sentry, PostHog, Polar).
**Por qué:** La Configuración es la fuente de contexto para entender la fábrica; debía reflejar el estándar y las decisiones nuevas, no quedarse desactualizada.
**Impacto:** `mission-control/prototype/index.html` (arrays `CONFIG.estandares` y `decisiones` + resumen del stack).

## 2026-06-15 — Título "Pandacorp Mission Control" + se codifica Gremio vs Party
**Qué:** (1) El título visible de la app queda **"Pandacorp Mission Control"** (topbar + `<title>`): Pandacorp (marca) + Mission Control (la app). (2) Se aclaró que **Gremio (guild)** y **Party** son dos capas RPG **distintas** —no sinónimos— y se **codificó el límite** en [FRD-09](frds/frd-09-gamificacion.md): gremio = capa meta del operador/fábrica (nivel/XP, Salón/Códice/Comandos del gremio); party = los agentes de un proyecto concreto (panel RPG, FRD-06). Se limpiaron las frases donde se mezclaban ("El party trabaja en el gremio…" → "…en su sala…"; PARTY.md "por un gremio" → "por la sala del gremio").
**Por qué:** El dueño notó "guild" en varias partes y dudó si era lo mismo que Party. No lo es (un gremio tiene muchas parties); ambas capas son intencionales. Dejar el límite escrito evita confundirlas a futuro.
**Impacto:** `mission-control/docs/frds/frd-09-gamificacion.md` (sección nueva "Vocabulario: Gremio vs Party"), `mission-control/PARTY.md`, `mission-control/prototype/index.html` (título + feed).

## 2026-06-15 — Renombre: la app es "Mission Control"; el panel RPG es "Party"
**Qué:** Reasignamos los nombres. La **app completa** (antes "cockpit") pasa a llamarse **Mission Control** — el centro desde donde se controla toda la fábrica. El **panel RPG por proyecto** (antes "Mission Control") pasa a **Party**: el subtab donde ves a tu party de agentes trabajando en vivo. "Pandacorp" sigue siendo la fábrica/marca. Se renombró la carpeta `cockpit/` → `mission-control/`, los docs canónicos del panel (`MISSION-CONTROL.md` → `PARTY.md`, `frd-06-mission-control.md` → `frd-06-party.md`), el prototipo (topbar, `<title>`, subtab "Party", textos del manual) y `.claude/launch.json`. Verificado en preview: topbar "Mission Control", subtab "Party", mapa RPG y KPIs intactos, sin errores de consola.
**Por qué:** Por convención (NASA, macOS), "Mission Control" nombra el centro que supervisa y comanda TODA la operación, no un sub-panel; tenerlo en el panelito invertía el significado y a veces se usaba como sinónimo de la app. El analógico queda limpio: Pandacorp (organización) → Mission Control (su centro de control = la app) → Party (la tripulación de agentes de cada misión, en línea con el lenguaje "party" que el prototipo ya usaba).
**Impacto:** carpeta `mission-control/` (antes `cockpit/`), `mission-control/PARTY.md`, `mission-control/docs/frds/frd-06-party.md`, `mission-control/prototype/index.html`, `.claude/launch.json`. Cambio repo-wide (CLAUDE.md, README, plugin/skills, estándares, registro.yaml, hook): ver entrada gemela en [fabrica/bitacora.md](../../fabrica/bitacora.md).

## 2026-06-15 — Gate de onboarding + tags del tablero (categoría + retorno)
**Qué:** Mission Control gana un **gate de onboarding**: si no encuentra `fabrica/perfil.md`, muestra —antes que nada— un banner que pide correr `/pandacorp:onboarding` (FRD-01). En el tablero, cada tarjeta pasa de un solo tag (monetizable/personal/ambas) a **dos**: **categoría** (tipo de solución: web/mobile/desktop/IA/claude-code/prompts/automatización/CLI/rework) con icono, y **retorno** (monetario/oportunidad/personal/mixto) con color; el filtro ahora es por categoría (FRD-02). Prototipo HTML actualizado y verificado en preview.
**Por qué:** Sin perfil la fábrica no puede recomendar alineado (de ahí el gate). Un solo tag binario no capturaba ni el tipo de proyecto ni el modelo de retorno (dinero u oportunidad); dos ejes ortogonales lo hacen claro en el board.
**Impacto:** `mission-control/docs/frds/frd-01-lectura-de-datos.md`, `mission-control/docs/frds/frd-02-tablero-ideas.md`, `mission-control/prototype/index.html`. Relacionado: `fabrica/ideas/_plantilla-ficha.md`, DR-039.

## 2026-06-14 — Bitácora de Mission Control creada
**Qué:** Arranca la bitácora de decisiones de Mission Control.
**Por qué:** Parte de la disciplina "documentar todo" de la fábrica — ver [fabrica/bitacora.md](../../fabrica/bitacora.md).
