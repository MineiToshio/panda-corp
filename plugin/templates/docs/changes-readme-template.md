<!--
  TEMPLATE for .pandacorp/inbox/changes/README.md. Owner channel: body in Spanish.
  One card per file (change-request-template.md). Capture writes draft + runs card check.
  /pandacorp:implement builds only its cited scope or the pending plan; it never drains this index.
-->

# Cola de cambios

> Índice de tarjetas de esta carpeta. Para anotar algo, crea una tarjeta `draft` y valida con
> `node <plugin>/scripts/pandacorp-build.mjs card check <path>`; la ruta del plugin está en
> `.pandacorp/guide.md`. Para construirla, pide `/pandacorp:implement` con esa tarjeta como objetivo.
> La cola no se drena automáticamente. `building` identifica una tarjeta tomada por un build;
> `closing` es un cierre de `/pandacorp:sync` en curso y, pasadas 48h, el gate lo marca en rojo.
> Las tarjetas completadas se mueven a `done/`, nunca se borran.

| Tarjeta | Tipo | Clase | Estado |
|---|---|---|---|
| `<slug>.md` | bug \| feature \| change | expedite \| standard | draft \| ready \| building \| closing \| done \| discarded |
