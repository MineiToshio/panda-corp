---
description: Reporta un bug encontrado al probar un proyecto Pandacorp. Le describes el bug en lenguaje normal y el skill lo documenta en la bandeja docs/bugs/ del proyecto; la construcción en curso (/pandacorp:implement) lo recoge en su próximo punto seguro. No arregla nada — solo documenta. Se ejecuta DENTRO del proyecto.
---

# /pandacorp:bug

El canal para **reportar un bug** sin parar la construcción ni armar nada en Mission Control. Lo corres en la carpeta del proyecto, le dices el bug en lenguaje normal, y el skill lo deja anotado en la **bandeja** `docs/bugs/`. El `/pandacorp:implement` que está corriendo lo recoge en su próximo punto seguro (fin de work order) y lo arregla con un test de regresión.

`$ARGUMENTS` (o la conversación): la descripción del bug (ej.: `/pandacorp:bug "el botón de guardar no hace nada al darle enter"`).

## Pasos

1. **Captura** la descripción. Si falta algo clave para reproducirlo, pregunta lo MÍNIMO (pasos, qué esperabas vs. qué pasó, en qué pantalla/flujo). No investigues a fondo ni intentes arreglarlo — esto es solo documentar.
2. **Escribe** `docs/bugs/<slug>.md` (slug corto en inglés derivado del título), con:
   - `título`, `fecha`, `severidad` estimada (`crítico` bloquea un flujo / `normal` / `menor`)
   - **pasos para reproducir**, **resultado esperado**, **resultado actual**
   - en qué FRD/pantalla cae, si se sabe
   - `estado: pendiente`
3. **Incrementa** `bugs_pendientes` en `docs/status.yaml` (Mission Control lo muestra como chip por proyecto).
4. **Confirma** al dueño: "anotado en la bandeja; `/implement` lo tomará en su próximo punto seguro". Si NO hay construcción corriendo y quiere arreglarlo ya, dile que corra `/pandacorp:implement` (que vacía la bandeja).

## Reglas

- **No arregla** el bug ni toca código. Solo documenta. (Quien arregla es el loop de `implement`, que crea el test de regresión primero — DR-015.)
- Un bug en la bandeja nunca se borra a mano: al cerrarse, `implement` lo marca `resuelto` con el commit del fix.
- Si lo que describe el dueño NO es un bug sino un cambio/funcionalidad ("quiero que además haga X"), redirígelo a `/pandacorp:iterate`. Si es responder algo que la IA preguntó, a `/pandacorp:decide`.
