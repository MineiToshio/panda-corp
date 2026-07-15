---
title: "Build parcial: por FRD o por change"
group: guides
order: 4
---

# Build parcial: implementar un FRD o una change concreta

Claude permite uno o varios FRDs con su Dynamic Workflow. En Codex, el perfil promovido es más
estrecho: `EXPERIMENTAL attended_foreground` acepta **exactamente un FRD o una change `ready`**, debe
permanecer en foreground, tiene un máximo acumulado de 7200 segundos, no se reinicia automáticamente
y termina en `phase: implementation`. Codex rechaza el modo completo, varios FRDs, background,
desatendido, hardening, release y cambio de runtime.

Normalmente `/pandacorp:implement` construye todo lo pendiente en orden de dependencias. Esta guía explica cómo pedirle que construya solo un FRD concreto, un subconjunto de FRDs, o que procese directamente una change de la cola — todo con el mismo motor, los mismos gates y la misma garantía de calidad que el build completo.

## Los tres modos

### Modo completo (sin argumentos)

```
/pandacorp:implement
```

El motor lee todos los FRDs con work orders en estado `PLANNED` o inferior, los ordena por dependencias y los construye de uno en uno con TDD. Cada FRD pasa por el gate del reviewer antes de avanzar. Es el modo por defecto — construye todo en el orden correcto sin que tengas que decidir nada.

### Modo parcial por FRD

Pasa el nombre del FRD (o varios separados por espacio) como argumento:

```
/pandacorp:implement frd-05-settings
/pandacorp:implement frd-05-settings frd-06-export
```

El motor normaliza el identificador automáticamente. Todos estos formatos son equivalentes:

```
/pandacorp:implement frd-05-settings
/pandacorp:implement docs/frds/frd-05-settings
/pandacorp:implement docs/frds/frd-05-settings/frd.md
```

**¿Qué ocurre paso a paso?**

1. **Baseline** — el motor repara el estado del proyecto antes de hacer nada (igual que en el build completo).
2. **Plan** — identifica solo los FRDs especificados y sus work orders pendientes.
3. **Gate de dependencias** — el motor comprueba que todos los FRDs de los que depende el FRD pedido ya están `VERIFIED`. Si alguno no lo está, el motor **se detiene sin escribir una sola línea de código** y te dice exactamente cuáles faltan:

   > ⊘ Build parcial bloqueado — hay dependencias sin VERIFIED: `frd-05-settings` requiere: `frd-02-auth`, `frd-03-db`. Implementa primero esos FRDs (o corre `/pandacorp:implement` sin filtro para el orden automático).

4. **Build** — construye los FRDs especificados con TDD, igual que un build completo.
5. **Gate del reviewer** — cada FRD pasa su gate de revisión completa. Solo cuando el reviewer lo aprueba queda marcado `VERIFIED`.
6. **Cierre acotado** — el run se detiene y libera la lease manteniendo `phase: implementation`. Aunque ese FRD haya sido el último pendiente de todo el proyecto, un build parcial no amplía su permiso hacia el hardening global ni hacia `release`. Ese cierre completo se hace después con `/pandacorp:implement` sin objetivo.

**¿Qué hago si hay dependencias sin implementar?**

Tienes dos opciones:
- Implementarlas primero y luego el FRD objetivo: `/pandacorp:implement frd-02-auth` → `/pandacorp:implement frd-05-settings`
- Dejar que el motor los ordene automáticamente: `/pandacorp:implement` sin argumentos (construye las deps primero, en el orden correcto)

### Modo por change de la cola

Si tienes una change en `.pandacorp/inbox/changes/` marcada como `status: ready`, puedes procesarla y construirla en un solo run:

```
/pandacorp:implement change:mc-observability-consumer-dr066
```

El motor normaliza el identificador automáticamente. Todos estos formatos son equivalentes:

```
/pandacorp:implement change:mc-observability-consumer-dr066
/pandacorp:implement change:mc-observability-consumer-dr066.md
/pandacorp:implement change:.pandacorp/inbox/changes/mc-observability-consumer-dr066.md
```

El identificador es el **nombre del archivo** en `.pandacorp/inbox/changes/` (sin la extensión `.md`). Si no lo recuerdas, pasa cualquier nombre y si no existe el motor lista los disponibles.

**¿Qué ocurre paso a paso?**

1. **Baseline** — igual que siempre, el motor repara el estado.
2. **Process Change** — el motor:
   - Abre el archivo `.pandacorp/inbox/changes/<slug>.md`
   - Si el archivo no existe, lista todos los disponibles en esa carpeta
   - Verifica que el `status` sea `ready` (si no lo es, se detiene con un mensaje claro — ver tabla más abajo)
   - Lo procesa vía el motor de iterate/bug: crea o actualiza los FRDs y work orders con `implementation_status: PLANNED`
   - Identifica los FRDs afectados — esos se convierten en el filtro para el resto del build
3. **Plan** — planifica solo los FRDs que la change afecta.
4. **Gate de dependencias** — el mismo gate que en el modo FRD: si los FRDs afectados tienen deps sin `VERIFIED`, para y te dice cuáles.
5. **Build** — construye los FRDs afectados.
6. **Gate del reviewer + archivo automático** — cuando el reviewer valida el FRD, **la change se archiva automáticamente** (igual que el drain normal de la cola). No tienes que hacer nada extra.

**¿Qué pasa si la change no está lista?**

| Estado de la change | Qué hace el motor |
|---|---|
| `status: draft` | Se detiene: "márcala `ready` primero con `/pandacorp:change`" |
| `status: needs-owner` | Se detiene: "requiere una decisión del propietario antes de construir" |
| `status: structural` | Se detiene: igual, requiere acción del propietario |
| El archivo no existe | Lista todos los archivos disponibles en `.pandacorp/inbox/changes/` |

## ¿Cuándo usar cada modo?

| Situación | Modo recomendado |
|---|---|
| Primera build del proyecto, o quieres construir todo lo pendiente | Sin argumentos (Claude; no disponible en Codex) |
| Los FRDs ya están documentados y quieres construir solo uno | Por FRD |
| Quieres construir varios FRDs específicos (no todos) | Por FRD con múltiples argumentos en Claude; en Codex ejecuta uno por vez |
| Quieres saber qué deps faltan antes de continuar con un FRD | Por FRD — el gate te dice exactamente cuáles faltan |
| Hay una change en la cola que no quieres esperar al próximo build completo | Por change |
| La change que quieres construir está en borrador | Primero `/pandacorp:change` para marcarla `ready`, luego `implement change:...` |

## Notas importantes

- **`change` gana sobre `frds`**: si pasas ambos por alguna razón, `change` tiene prioridad y `frds` se ignora.
- **Un build dirigido construye SOLO su objetivo (DR-069)**: si lanzas por `change` o por `frds`, el motor **no** drena otros cambios `ready` que haya en la cola — construye únicamente lo que le pediste. Los demás cambios esperan a un `/pandacorp:implement` **sin objetivo** (bare), que es el único que vacía la cola entera. "Implementa solo este cambio" significa exactamente eso.
- **El hardening es global y solo lo corre un build completo**: un run por `frds` o `change` termina después de sus gates, conserva `phase: implementation` y nunca ejecuta el auditor/fixer de todo el proyecto. Ejecuta `/pandacorp:implement` sin objetivo cuando quieras cerrar construcción, hardening y release.
- **El motor es resumible**: si el build se interrumpe (por error o por timeout), correr el mismo comando de nuevo retoma desde donde quedó — los WOs ya `VERIFIED` no se rehacen.
- **La change no desaparece hasta que el FRD verifica**: el archivado ocurre en el gate del reviewer, no en el paso Process Change. Si el build falla a mitad, la change sigue en la cola para el próximo intento.
- **El gate de deps siempre aplica**: ya sea que pases un FRD o una change, el motor siempre chequea que las dependencias estén satisfechas antes de empezar a construir.
- **Los FRDs ya `VERIFIED` nunca se reconstruyen**: el filtro solo aplica a WOs en estado anterior a `VERIFIED`. Pasar un FRD ya completo simplemente lo ignora.
