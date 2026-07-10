---
title: "Cómo pedir un cambio"
group: guides
order: 0
---

# Cómo pedir un cambio

`/pandacorp:change` es **la puerta única** para pedirle a un proyecto CUALQUIER cambio —una feature nueva, un ajuste o un bug—. No tienes que recordar si es una cosa o la otra: lo describes en lenguaje normal y el skill lo clasifica, le da una clase de urgencia y lo deja en la **cola de cambios** `.pandacorp/inbox/changes/`.

> El cuerpo paso a paso se compone en React (`GuideCambio`); este markdown respalda el índice del Manual.

- **Es seguro por diseño (DR-069).** `change` solo **captura + clasifica + escribe un fichero** a la cola. **No edita docs/work-orders/código y no tiene lógica de detección de build** — así que no puede confundirse sobre si hay un build corriendo y corromperlo. Da igual si sabe o no que hay un build en marcha.
- **El build drena la cola en su punto seguro.** Un build en marcha la vacía en su próximo safe point (entre features, nunca a mitad de una); si no hay build, `/pandacorp:implement` la vacía cuando lo corres. El cambio espera en la cola, durable, hasta que el build lo recoja e integre por el **mismo gate de revisión/test** que el trabajo planificado.
- **Clase de servicio (urgencia):** **expedite** (urgente / rompe algo / bloquea pruebas → el build lo salta al frente) o **standard** (default, FIFO).
- **draft vs ready (el gate de readiness):** **`ready`** = la descripción está completa para accionar → el build lo construye. **`draft`** = lo aparcas para visibilidad pero aún le das vueltas / depende de algo no hecho → el build lo **SALTA** hasta que lo pases a `ready`. Mission Control muestra ambos.
- **`bug` e `iterate` son los motores internos.** Clasificas por dentro para que tú solo recuerdes `/change`. `/pandacorp:bug` y `/pandacorp:iterate` existen solo como los motores que `change` y el build invocan por dentro — **no son comandos tuyos** (están ocultos del menú): tú siempre pasas por `/pandacorp:change`.
- **¿Es un hito, no un cambio suelto?** `change` tiene un cuarto veredicto además de bug / feature / decisión: un rediseño grande o un paquete de cambios con su propio mini-PRD es un **hito** que NO va a la cola — `change` te lo explica y, **solo con tu OK explícito en esa misma conversación**, lo pasa al motor `new-version` (DR-069 §5). Si lo prefieres más chico, vuelve a la clasificación normal feature/cambio.
- **¿Te preguntó algo el build?** Eso NO es un cambio (va en sentido contrario) → usa `/pandacorp:decide`.
