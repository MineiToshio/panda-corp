---
title: "Elegir modo de construcción"
group: guides
order: 3
---

# Elegir modo de construcción

`/pandacorp:implement` acepta un modo según con cuánta potencia quieras construir (pro / balanced / powerful / deep).

## Build parcial — implementar un solo FRD

Puedes pedirle que construya solo un FRD o un subconjunto:

```
/pandacorp:implement frd-05-settings
/pandacorp:implement docs/frds/frd-05-settings
/pandacorp:implement docs/frds/frd-05-settings/frd.md
/pandacorp:implement frd-05-settings frd-06-export
```

Cualquiera de esos formatos es válido — el motor los normaliza automáticamente al nombre de carpeta. Antes de arrancar, verifica que todas las **dependencias** de ese FRD ya están `VERIFIED`. Si no lo están, te dice exactamente cuáles tienes que implementar primero y se detiene sin hacer nada. Sin argumento, construye todos los FRDs pendientes en el orden correcto de dependencias (comportamiento habitual).

## Build desde la cola de changes

Si tienes algo en `.pandacorp/inbox/changes/` que quieres construir ahora sin esperar al próximo build completo:

```
/pandacorp:implement change:mc-observability-consumer-dr066
/pandacorp:implement change:mc-observability-consumer-dr066.md
/pandacorp:implement change:.pandacorp/inbox/changes/mc-observability-consumer-dr066.md
```

Cualquiera de esos formatos es válido — el motor normaliza al nombre del archivo sin extensión. Si el archivo no existe, lista los disponibles. Verifica que esté en `status: ready` (no en borrador ni bloqueado por el owner), lo procesa a través del motor de iterate/bug para crear o actualizar los FRDs y work orders correspondientes, y luego construye solo esos FRDs. Si sus dependencias no están VERIFIED, el gate de deps se dispara igual que en un build parcial por FRD.

> El cuerpo paso a paso se compone en React. Este markdown respalda el índice del Manual.
