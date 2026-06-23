---
title: "Documentar cambios hechos a mano"
group: guides
order: 9
---

# Documentar cambios hechos a mano

¿Editaste el código directamente —para ir rápido, para verlo cambiar en vivo— sin pasar por `/spec`, `/design`, `/implement` o `/change`? Entonces el código se adelantó a los documentos. `/pandacorp:sync` es el **flujo inverso**: en vez de ir del documento al código, va del **código a los documentos**. Es `/pandacorp:iterate` al revés, y se corre **DENTRO** del proyecto.

> El cuerpo paso a paso se compone en React (`GuideSync`); este markdown respalda el índice del Manual.

- **El código se vuelve el oráculo, así que sync DOCUMENTA pero no VERIFICA.** No puede saber si un cambio es correcto, solo describir lo que el código hace; por eso te muestra un plan y TÚ marcas la intención de cada cambio en un gate. Lo que escribe se marca como reconciled-from-code (como las docs as-built de `/adopt`).
- **Con o sin contexto.** Si la conversación ya tiene los cambios, parte de ahí (pero verifica el diff real). Sin contexto —en una conversación fresca— hace una **auditoría completa**: recorre toda la app contra los docs y encuentra todos los gaps.
- **La dirección decide la acción.** Solo se documenta lo que el código hace de MÁS. Si el doc tiene razón, no lo degrada: un **bug** (el código contradice un doc correcto) se deriva a `/pandacorp:change` para arreglar el código; una **feature documentada pero no construida** se marca pendiente. La especificación nunca se rebaja para describir un código roto.
- **Exhaustivo: toda la cascada.** Un cambio de comportamiento toca el FRD **y** su work order **y** el FDD; uno de arquitectura, el blueprint + ADR; uno de interfaz, el FDD + tokens. Barre `docs/` y `.pandacorp/`. Nada se queda sin documentar.
- **Dos capas, siempre.** Cada cambio actualiza el doc dueño **y** registra la entrada en `docs/decision-log.md` (el "porqué" se te PREGUNTA, porque el diff no lo trae).
- **El espejo de Claude Design.** Si tu sistema de diseño tiene un espejo en Claude Design y el cambio lo tocó, sync **avisa y ofrece** re-sincronizar vía `/design-sync` — nunca empuja solo (es una escritura hacia afuera, tras tu login).

**Complementa a `/pandacorp:change`:** sync documenta lo que el código hizo de más; change/bug arregla lo que el código hace de menos.
