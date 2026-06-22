---
title: "El arco económico"
group: concepts
order: 13
---

# El arco económico

No todas las ideas se construyen igual. El pipeline **se bifurca según el `return_type`** de la idea —`personal`, `monetary`, `mixed` u `opportunity`— y adapta lo que hace en cada fase. No es un pipeline único con forma de "app que cobra": lee el tipo de retorno y se ajusta (DR-042).

## Los cuatro tipos de retorno

- **personal** — el usuario eres tú. Se salta investigación de mercado/competencia, validación de demanda, precio y GTM; el foco es resolver bien tu necesidad.
- **monetary** — app pensada para generar ingresos. Recibe el tratamiento completo: gate de demanda, unit-economics y plan de distribución.
- **mixed** — útil para ti y monetizable a la vez. Mismo tratamiento que `monetary`.
- **opportunity** — apalanca un activo tuyo (audiencia, comunidad, red, posicionamiento). Valida que el alcance es real y define una métrica de oportunidad (alcance/red/posicionamiento), sin precio salvo que sea `mixed`.

## El gate de demanda (puede matar una idea antes de construir)

`/pandacorp:spec` hace una **pre-comprobación de demanda ANTES de crear la carpeta** del proyecto (DR-042). Para `monetary`/`mixed` revisa si hay competidores **que cobran de verdad** (el mercado existe y paga), si el dolor es frecuente/recurrente y, en B2B, quién paga. **Si la señal falta o contradice la idea, para y recomienda matar/pivotar — NO crea el proyecto** (matar aquí no deja un repo huérfano).

Es la pieza que evita invertir diseño y construcción en una idea monetaria sin validar.

## Unit-economics y kill-signals (viven en el PRD)

Para ideas `monetary`/`mixed`, el **PRD** lleva dos bloques de negocio:

- **Unit-economics** — precio propuesto (anclado a los competidores que cobran) + coste variable por usuario activo (de los costes conocidos: Polar ~4%+$0.40, Vercel Pro, tiers de Neon/R2/Resend/PostHog) + break-even de servilleta. El blueprint rellena el lado del coste.
- **Kill-signals** — señales de muerte con **umbrales numéricos** (p. ej. `< N usuarios activos` o `$0 de ingresos a los 60 días → revisión formal`). Para `opportunity`, la métrica de oportunidad (alcance/contactos ganados).

## La distribución (en release)

`/pandacorp:release` es **consciente del retorno**: para `monetary`/`mixed`/`opportunity` produce además `docs/launch-plan.md` —el canal de adquisición principal + 3-5 borradores de posts/hilos para que tú publiques (reutilizando las comunidades que halló el descubrimiento), enviados bajo el gate de comunicaciones externas (DR-008). **Desplegado ≠ lanzado:** una app sin usuarios no genera nada. Para ideas `personal`, se salta.

## El cierre del arco (review-launch)

Tras lanzar, `/pandacorp:review-launch` lee las métricas reales contra la hipótesis de valor y los kill-signals del PRD, y te da un veredicto **kill / hold / double-down** (DR-043). Es la otra mitad del arco: la fábrica podía construir e instrumentar, pero no leía resultados para decidir. Ver **Después de lanzar**.

> El gate de demanda, el bloque de unit-economics y el plan de lanzamiento son ítems de alcance que tú apruebas con el PRD. El kill/pivot y el precio son siempre tu decisión.
