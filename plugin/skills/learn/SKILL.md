---
description: Incorpora a la fábrica Pandacorp know-how durable — un estándar de ingeniería, una regla de decisión, o un skill nuevo del plugin (la autoría y evaluación del skill se delegan al skill nativo skill-creator). Usar cuando el dueño quiere agregar/ajustar una convención, un default pre-aprobado, o una capacidad nueva que se inyectará en los proyectos. Se ejecuta EN la fábrica (panda-corp).
---

# /pandacorp:learn

Le enseña a la fábrica algo **durable** (la fábrica lo aprende): un **estándar** (`factory/standards/`), una **regla de decisión** (`factory/decisions/registry.yaml`), o un **skill** nuevo del plugin. Es lo que disparan los botones «Nuevo estándar» / «Nueva regla de decisión» / «Nuevo skill» de Mission Control. Se ejecuta EN la fábrica. (Antes se llamaba `codify`.)

`$ARGUMENTS` (o la conversación): qué quieres que la fábrica aprenda, en lenguaje normal (ej.: `/pandacorp:learn "todo formulario debe tener protección anti-spam"`).

## Pasos

1. **Clasifica** lo que pide el dueño: ¿es un **estándar** (regla de cómo se construye, se inyecta en los proyectos), una **regla de decisión** (default pre-aprobado para que la IA no pregunte cada vez), o un **skill** (una capacidad/comando nuevo)? Si es ambiguo, pregunta.
2. **Investiga lo mínimo** (delega al `researcher` si hace falta): valores concretos, mejores prácticas, cómo se verifica. Lo que el dueño dice es de alto nivel; aterrízalo.
3. **Si es ESTÁNDAR:**
   - Decide el **dominio** (Programación, Arquitectura, Diseño, Tecnología, Calidad, Seguridad, Operación, Datos/Privacidad, Producto/Docs) y si va en un archivo existente o uno nuevo (`factory/standards/<slug>.md`).
   - Escríbelo en la forma **"estándar ejecutable"**: **Regla** (taxativa) · **Cómo se verifica** (check binario, enchufable a `verify.sh`/CI) · **Por qué** (rationale). Marca **severidad** (MUST/SHOULD/MAY) y **enforcement** (lint/CI/checklist/gate humano).
   - Si introduce algo verificable, di cómo entra al gate (lint rule, test, paso de CI).
   - Actualiza `factory/standards/README.md` (índice + categoría).
4. **Si es REGLA DE DECISIÓN:**
   - Agrega `DR-NNN` al `registry.yaml` con `patron`, `default` (el comportamiento pre-aprobado), `requiere_humano` (true/false) y `nota` si hace falta. Si los valores viven en un estándar, **apunta a él** (no los dupliques).
5. **Si es SKILL (crear o mejorar) — NO reinventes: delega a `skill-creator` (nativo):**
   - **Justifica primero.** Un skill se crea desde un **gap medido y recurrente** (desviaciones en `docs/progress.md`, hallazgos del `reviewer`, llamadas repetidas al `researcher`, desviaciones de golden path), no por corazonada. Sin gap recurrente, casi nunca es un skill — reconsidéralo como estándar, o como nada.
   - **Autoría + evaluación con `skill-creator`.** Que el skill nativo cree/edite el `SKILL.md` y corra su eval (baseline-vs-skill con aserciones + optimización de la descripción para triggering, con holdout). **Acepta solo si** el benchmark (delta vs baseline) y la precisión de triggering mejoran. Para mejorar uno existente: preserva su nombre/directorio, snapshot del viejo, baseline-vs-nuevo.
   - **Colócalo en el plugin**, namespaced: `plugin/skills/<slug>/`, comando `pandacorp:<slug>`. Descripción **tight** (caso de uso primero, ≤1.536 chars; incluye qué hace Y cuándo dispararse). `disable-model-invocation: true` si tiene efectos secundarios. Vigila el presupuesto de descripciones con `/doctor`.
   - **Si en vez de crear vas a ADOPTAR un skill externo:** nunca auto-instalar. Audítalo (lente del `security-auditor`: `allowed-tools`, `!`shell``, MCP, variables de entorno), **vendoriza una copia pineada** dentro del plugin, y trátalo como dependencia (DR-001). Primera parte (`anthropic-skills`) = confianza alta; comunidad = referencia + vendorizado, nunca instalación directa.
   - **Es un gate del dueño**: crear o adoptar un skill lo apruebas tú.
6. **Confirma al dueño** qué se creó/cambió y dónde. Recuerda el paso de activación: **commit + `claude plugin update pandacorp@panda-corp` + reiniciar** (si tocaste el plugin) — Mission Control avisa del desfase (FRD-15).

## Reglas

- **No inventes valores**: si no sabes el umbral/valor correcto, investígalo o pregúntalo. Un estándar sin verificador concreto es prosa, no un contrato.
- **Reusa antes de crear**: si encaja en un archivo existente (`quality.md`, `patterns.md`…), amplíalo en vez de crear uno nuevo. Para skills: un skill con variantes internas (`references/`) antes que muchos casi-duplicados — el *sprawl* satura el presupuesto de descripciones y provoca colisiones de triggering.
- **No reinventes lo nativo**: para skills, `skill-creator` hace la autoría y la evaluación; `learn` solo agrega el gate del dueño, la colocación en el plugin, la política de seguridad y el ritual de activación.
- Nuevos `MUST` que puedan romper proyectos en vuelo (CSP estricta, a11y-gate): introdúcelos primero como `SHOULD`/aviso y promuévelos cuando maduren.
- Las decisiones de PRODUCTO (qué construir) no van aquí — eso es `iterate`/`spec`. `learn` es solo para el CÓMO (estándares), la gobernanza (reglas de decisión) y las capacidades (skills).
