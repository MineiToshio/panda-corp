# FRD-04 — Workspace de proyecto

Al abrir un proyecto desde el portfolio, su espacio de trabajo con pestañas y cabecera de progreso.

## Criterios de aceptación (EARS)
- EL workspace DEBERÁ ofrecer pestañas, en este orden: **Resumen · Work orders · Mission Control · Documentos · Comandos**.
- LA cabecera DEBERÁ mostrar título, etapa, versión, la línea de `progreso` y una **barra de progreso** (% de work orders hechos), visible en todas las pestañas.
- LA pestaña **Resumen** DEBERÁ mostrar: resumen, puntos clave, **puntos de decisión** (resaltados, con su conteo) y un **log de actividad** de alto nivel (qué se ha hecho y qué decisiones se tomaron), leído de `docs/decisiones.md` y `docs/progreso.md`.
- CUANDO hay decisiones pendientes, EL sistema DEBERÁ resaltarlas para que Sergio las vea.
- LA pestaña **Comandos** DEBERÁ mostrar los comandos relevantes a la etapa actual (p. ej. en construcción: continuar `implement`, `release`, `iterate`) con una nota de **cuándo usar cada uno** y los modos de `implement` (potente/profundo). Va al final porque es contextual y repetitivo, no algo que se mira siempre.
- LA pestaña **Documentos** DEBERÁ permitir navegar y leer los documentos del proyecto renderizados.
