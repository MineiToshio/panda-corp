---
description: Resuelve los puntos de decisión pendientes de un proyecto Pandacorp. Cuando un agente choca con algo que solo el dueño puede decidir (alcance de producto, gastar dinero, algo irreversible), lo deja como pendiente en docs/decisions.md y Mission Control lo resalta; este skill es como el dueño da su respuesta. Se ejecuta DENTRO del proyecto.
---

# /pandacorp:decide

El mecanismo para que **el dueño responda los puntos de decisión** que la IA dejó pendientes. Se ejecuta EN la carpeta del proyecto. Es la contraparte de los puntos de decisión que aparecen en Mission Control: Mission Control los **muestra** (solo-lectura); este skill los **resuelve**.

`$ARGUMENTS` opcional: tu respuesta directa (ej.: `/pandacorp:decide "sí, mostrar los costos"`). Sin argumentos: te muestra las pendientes una por una y te pregunta.

## Pasos

1. **Lee `docs/decisions.md`** y lista las decisiones con estado `pendiente`. Para cada una muestra: la pregunta, las opciones que se investigaron, y **la recomendación de la IA** (con su porqué).
2. **Pide la respuesta del dueño**:
   - Sin argumentos: presenta cada decisión pendiente con su recomendación y pregunta qué decide. El dueño puede decir "tu recomendación" para aceptar la sugerida.
   - Con argumentos: aplica la respuesta a la decisión pendiente (si hay varias, pregunta a cuál se refiere). Nunca decidas tú: si el dueño no responde algo, queda pendiente.
3. **Registra la respuesta** en `docs/decisions.md`: `estado: resuelta`, la decisión textual del dueño, el racional si lo dio, y la fecha. Trazabilidad: una decisión resuelta nunca se borra, se marca resuelta.
4. **Si es arquitectónica**, además crea/actualiza el ADR en `docs/adr/` (qué se decidió y el trade-off).
5. **Desbloquea**: si la decisión destrababa un work order o un frente, dilo y actualiza `docs/status.yaml` (`decisiones_pendientes`). Si `/pandacorp:implement` está corriendo, la recoge sola en su próximo punto seguro (revisa `docs/decisions.md`); si no hay construcción activa, ofrece continuar con `/pandacorp:implement`.

## Reglas

- **No decidir por el dueño.** Solo registra lo que él dice. Si una respuesta implica gastar dinero, producción, borrar datos o comunicaciones externas, sigue aplicando el registro de decisiones (puede requerir confirmación explícita con monto, etc.).
- Cada respuesta queda **en archivo** (`docs/decisions.md`), no solo en el chat: así el avance sobrevive aunque la conversación se cierre.
- Si no hay decisiones pendientes, dilo y no hagas nada.

## Cómo se ve para el dueño

En Mission Control, cada proyecto muestra un **chip con el número de decisiones pendientes**. Al entrar al proyecto (pestaña Resumen) ve la pregunta + la recomendación + el comando `/pandacorp:decide` listo para copiar. Pega el comando en Claude Code (en la carpeta del proyecto), responde, y Mission Control refleja que ya no hay pendiente.
