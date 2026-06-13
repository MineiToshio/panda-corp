# FRD-05 — Work orders (vista en vivo)

Kanban de solo-lectura del estado de los work orders, con su FRD y la lectura del documento completo.

## Criterios de aceptación (EARS)
- EL kanban DEBERÁ mostrar columnas **To do · En progreso · Review/Testing · Hecho**, todas del mismo ancho, y el texto DEBERÁ ajustarse en varias líneas si no cabe.
- CADA tarjeta de work order DEBERÁ indicar de qué **FRD** es.
- CUANDO Sergio hace clic en un work order, EL sistema DEBERÁ mostrar un **Resumen** y una pestaña **Documento completo** que renderiza todo el work order (criterios de aceptación, alcance, definición de terminado, evidencia).
- EL sistema DEBERÁ mostrar el progreso del proyecto (work orders hechos / total y %).
- EL kanban DEBERÁ reflejar el estado en vivo (lo escriben los agentes en `docs/work-orders/`); Sergio NO lo edita.

## Casos límite
- Proyecto sin work orders todavía → mensaje indicando que se generan en `/pandacorp:blueprint`.
