---
title: "Después de lanzar"
group: concepts
order: 14
---

# Después de lanzar

**Desplegado ≠ lanzado.** Que una versión esté en producción no significa que tenga usuarios ni que funcione el negocio. Por eso el ciclo de vida no termina en el deploy: la fase **operación** es real, no un sumidero muerto. Un proyecto lanzado entra en `operation` y ahí se mide.

## Las 6 fases (operación incluida)

```
product → design → architecture → build → release → operation
```

`release` es **desplegar** (una versión queda viva); `operation` es **operar** (leer métricas y decidir). Son cosas distintas.

## review-launch · cierra el bucle (DR-043)

`/pandacorp:review-launch` corre en un proyecto lanzado (precondición `phase: operation`). Hace cuatro cosas:

1. **Lee los objetivos** del PRD (`docs/product/prd.md`): la hipótesis de valor, el hito de activación, las métricas de éxito y los **kill-signals con sus umbrales numéricos**.
2. **Lee las métricas reales** en PostHog — pero **antes, dos asertos de procedencia** (los datos del proyecto equivocado son peores que ningún dato): que exista `docs/analytics/events.md` en ESTE proyecto (si falta, se detiene: «sin telemetría — instrumenta primero vía `/pandacorp:change`», sin veredicto), y que el proyecto de PostHog conectado sea el de esta app (si no coincide o no hay conexión, no lee de otra org: deja las consultas escritas y reporta «sin datos para este proyecto»). Con la procedencia despejada, lee (los eventos definidos en `docs/analytics/events.md`): adquisición, **tasa de activación**, retención y la métrica de retorno según el `return_type`:
   - **monetary / mixed** → usuarios activos, ingresos/MRR y el **chequeo de unit-economics**: ¿los ingresos cubren el coste variable por usuario + el asiento fijo de Vercel Pro (el break-even del PRD/blueprint)?
   - **opportunity** → la métrica de oportunidad (alcance/contactos/posicionamiento ganados).
   - **personal** → ¿el dueño realmente la usa (una señal mínima de uso)?
3. **Compara** las métricas contra la hipótesis y los kill-signals.
4. **Actualiza las columnas de negocio del portfolio** (`factory/portfolio.md`).

## Los tres veredictos

- **DOUBLE DOWN** — la hipótesis se sostuvo (o va bien): recomienda el siguiente paso (encolar la próxima feature por la puerta única `/pandacorp:change`, o empujar la distribución de `docs/launch-plan.md`).
- **HOLD** — no concluyente / demasiado pronto: seguir midiendo; fija la próxima fecha de revisión.
- **KILL / ARCHIVE** — saltó un kill-signal (monetary: por debajo del umbral de usuarios/ingresos en la ventana, o CAC > LTV; opportunity: la métrica está plana; personal: el dueño dejó de usarla): recomienda archivar y liberar el foco.

## No mata por su cuenta

review-launch **lee, recomienda y solo escribe** las columnas de negocio del portfolio + una nota de revisión. **No mata, no archiva, no despliega ni gasta** — eso siguen siendo gates humanos (matar/archivar un producto lanzado es tu decisión). El bucle produce la recomendación; tú decides.

Es **consciente del retorno**: juzga por la métrica que corresponde al `return_type`, no siempre por ingresos. Una herramienta `personal` que usas a diario es un éxito aunque facture $0.

## Alimenta el portfolio

El portfolio gana **columnas de negocio** —Usuarios / Retorno / Veredicto— para que veas ganadores vs zombies de un vistazo. Una idea matada realimenta a `recommend` (que no vuelva a proponer la misma apuesta muerta). Puede correr **a demanda** o como un job **`/loop` autopautado** sobre el portfolio lanzado: sin nadie presente, solo mide, registra y avisa — nunca mata por sí solo.
