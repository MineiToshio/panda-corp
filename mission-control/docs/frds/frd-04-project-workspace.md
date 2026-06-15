# FRD-04 — Workspace de proyecto

Al abrir un proyecto desde el portfolio, su espacio de trabajo con pestañas, cabecera de progreso y comandos.

## Criterios de aceptación (EARS)
- EL workspace DEBERÁ ofrecer pestañas, en este orden: **Resumen · Work orders · Party · Documentos · Comandos** (Comandos al final, porque es contextual y repetitivo).
- LA cabecera DEBERÁ mostrar título, etapa, versión, la línea de `progreso` y una barra de **"Objetivos de la misión"** (% de work orders completados), visible en todas las pestañas.
- LA pestaña **Resumen** DEBERÁ mostrar: resumen, puntos clave, **puntos de decisión** (resaltados, con conteo) y un **log de actividad** de alto nivel (qué se hizo y qué decisiones se tomaron), leídos de `docs/decisiones.md` y `docs/progreso.md`.
- CUANDO hay decisiones pendientes, DEBERÁ resaltarlas.
- LA pestaña **Comandos** DEBERÁ mostrar los comandos relevantes a la etapa (continuar `implement`, `release`, `iterate`, con cuándo usar cada uno) y el **selector de modo de construcción** ([FRD-11](frd-11-modos-de-construccion.md)).
- LA pestaña **Documentos** DEBERÁ permitir navegar y leer los documentos del proyecto renderizados.
- LA pestaña **Party** es la del [FRD-06](frd-06-party.md); **Work orders** la del [FRD-05](frd-05-work-orders.md).
