---
description: Codifica un estándar de ingeniería nuevo o una regla de decisión nueva en la fábrica Pandacorp. Usar cuando Sergio quiere agregar/ajustar una convención que se inyectará en los proyectos, o una decisión recurrente con default pre-aprobado. Se ejecuta EN la fábrica (panda-corp).
---

# /pandacorp:codify

Agrega o ajusta el **know-how durable** de la fábrica: un **estándar** (`fabrica/estandares/`) o una **regla de decisión** (`fabrica/decisiones/registro.yaml`). Es lo que disparan los botones "Nuevo estándar" / "Nueva regla de decisión" del cockpit. Se ejecuta EN la fábrica.

`$ARGUMENTS` (o la conversación): qué quieres codificar, en lenguaje normal (ej.: `/pandacorp:codify "todo formulario debe tener protección anti-spam"`).

## Pasos

1. **Clasifica** lo que pide Sergio: ¿es un **estándar** (una regla de cómo se construye, que se inyecta en los proyectos) o una **regla de decisión** (un default pre-aprobado para que la IA no pregunte cada vez)? Si es ambiguo, pregunta.
2. **Investiga lo mínimo** (delega al `researcher` si hace falta): valores concretos, mejores prácticas, cómo se verifica. Lo que Sergio dice es de alto nivel; aterrízalo.
3. **Si es ESTÁNDAR:**
   - Decide el **dominio** (Programación, Arquitectura, Diseño, Tecnología, Calidad, Seguridad, Operación, Datos/Privacidad, Producto/Docs) y si va en un archivo existente o uno nuevo (`fabrica/estandares/<slug>.md`).
   - Escríbelo en la forma **"estándar ejecutable"**: **Regla** (taxativa) · **Cómo se verifica** (check binario, enchufable a `verify.sh`/CI) · **Por qué** (rationale). Marca **severidad** (MUST/SHOULD/MAY) y **enforcement** (lint/CI/checklist/gate humano).
   - Si introduce algo verificable, di cómo entra al gate (lint rule, test, paso de CI).
   - Actualiza `fabrica/estandares/README.md` (índice + categoría).
4. **Si es REGLA DE DECISIÓN:**
   - Agrega `DR-NNN` al `registro.yaml` con `patron`, `default` (el comportamiento pre-aprobado), `requiere_humano` (true/false) y `nota` si hace falta. Si los valores viven en un estándar, **apunta a él** (no los dupliques).
5. **Confirma a Sergio** qué se creó/cambió y dónde. Recuerda el paso de activación: **commit + `claude plugin update pandacorp@panda-corp` + reiniciar** (si tocaste el plugin) — el cockpit avisa del desfase (FRD-15).

## Reglas

- **No inventes valores**: si no sabes el umbral/valor correcto, investígalo o pregúntalo. Un estándar sin verificador concreto es prosa, no un contrato.
- Reusa antes de crear: si encaja en un archivo existente (`calidad.md`, `patrones.md`…), amplíalo en vez de crear uno nuevo.
- Nuevos `MUST` que puedan romper proyectos en vuelo (CSP estricta, a11y-gate): introdúcelos primero como `SHOULD`/aviso y promuévelos cuando maduren.
- Las decisiones de PRODUCTO (qué construir) no van aquí — eso es `iterate`/`spec`. `codify` es solo para el CÓMO (estándares) y la gobernanza (reglas de decisión).
