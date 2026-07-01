<!--
  GOLD-STANDARD WORKED EXAMPLE — an idea card filled in the memo format.
  Proven to render RICH in Mission Control's Propuesta tab (full colour, charts, mock, bold, risk↔mitigation
  cards). `/discover` and `/new-idea` MIRROR this exact structure + markers so every generated card looks
  the same. The blank contract is `factory/ideas/_idea-template.md`; THIS is a complete instance to copy.
  The product and the persona in it are FICTIONAL (DR-033: no owner data ships in the versioned framework) —
  copy the structure and markers, not the content. Not a board card — it lives in `plugin/templates/` (the
  board only reads `factory/ideas/`), so it never appears on Mission Control. Keep the markers verbatim:
  `> **Badges:** … | … | …`, `### subsections`, the problema `> blockquote`, `- **Title** — desc` features,
  `**Vista previa — url**` + `- ✓`/`- !`, the scorecard table, the `| Riesgo | Mitigación |` table,
  evidence as `descripción — [fuente](url)`.
-->
---
title: "Riego — el recordatorio de plantas que no te abandona"
project_type: web
origin: discovery
status: discovered
status_before_discard: ""
discard_reason: ""
verdict: build
the_bet: "El contenido 'por qué se murió tu monstera' es lo más compartido del nicho; lo vuelves una herramienta lead-magnet, no otra app genérica de jardinería."
fold_into: ""
why_now: "Boom post-2024 del 'plant parenting' urbano en LATAM: más plantas por departamento y más quejas de apps existentes con paywalls agresivos."
kill_risk: "Planta y Greg ya existen (freemium + IA), más sofisticadas; tu único wedge es español + calendarios por clima local + tu canal."
validation_step: "1 video 'por qué tu monstera se muere en verano' que enlace a un calendario de riego web mínimo; mide tráfico + cuántos piden 'hazme el de mi planta'."
score: 71
score_rationale: "pain 8×0.3 + ease 8×0.25 + return 6×0.25 + fit 7×0.2 = 71"
complexity_bucket: micro
painkiller_class: painkiller
ground_truth_source: "owner-as-curator (calendarios por especie/clima curados por experto, NO diagnóstico algorítmico)"
legal_risk: none
prior_workaround: "alarmas del teléfono + hoja de cálculo con fechas de riego + preguntar en grupos de Facebook"
distribution_channel: "@selvaurbana + reels de rescate de plantas"
difficulty: low
profile_alignment: high
return_type: mixed
likely_stack: [Next.js, notificaciones push]
evidence:
  - "https://www.reddit.com/r/houseplants/"
  - "https://apps.apple.com/us/app/planta-care-for-your-plants/id1410126781"
created: 2026-06-26
project: ""
---

> **Veredicto: 🏗️ build (re-scopeado)** — **La apuesta:** Una web que te dice **cuándo regar cada planta según tu clima, en 60 segundos de setup** — el calendario de riego del plantlover hispano. No diagnostica tu planta: te vuelve el experto.
> **Badges:** 🏗️ build (re-scopeado) | cubeta: MICRO · 2–3 días | painkiller · viral | retorno: oportunidad + personal

## 🔥 De un vistazo

### La apuesta
El contenido "por qué se murió tu planta" es de lo más viral del nicho verde. Riego convierte ese contenido en una **herramienta** que arrastra a la audiencia hacia tu línea de contenido — un lead-magnet, no otra app de jardinería con paywall.

### El problema
Compraste una monstera de S/80 y a las tres semanas las hojas amarillean. Buscas y cada fuente dice algo distinto: *¿cada 3 días? ¿cuando el sustrato seque? ¿y en invierno?* Pones alarmas genéricas en el teléfono y **riegas de más — la causa #1 de muerte de plantas de interior**. Las apps existentes te cobran suscripción por lo básico y sus calendarios asumen clima de Estocolmo, no de Lima.

> "I killed my third pothos this year. Every app tells me a different watering schedule and none of them account for my climate…" — patrón repetido en r/houseplants y grupos de Facebook del nicho.

### Por qué ahora
Boom post-2024 del "plant parenting" urbano en LATAM: más plantas por departamento, más contenido de rescate de plantas, y reviews 1-2★ quejándose de los paywalls de las apps líderes. Tema caliente, compartible, con gente matando plantas *esta semana*.

### Por qué tú
Lo vives tú y tu nicho · Pandacorp lo construye en días · pocos ven que un *calendario en español ajustado al clima local* vale (todos asumen que hace falta una IA de diagnóstico). Tienes **credibilidad experta + @selvaurbana (~25k)**. Esto es 100% tuyo.

### La visión
- **Calendario por especie y clima** — eliges planta + ciudad; el riego se ajusta a estación y humedad típica, paso a paso.
- **Recordatorios que aprenden** — pospones o adelantas y el ciclo se recalibra; sin cuentas, sin paywall.
- **Galería "SOS hojas"** — comparador visual de síntomas comunes (riego de más vs de menos vs luz) con fotos reales.
- **"Hazme el de mi planta" (v2)** — pides un calendario para una especie rara y la comunidad/tú lo curan; engagement, no diagnóstico automático.

**Vista previa — riego.app/monstera-lima**
- ✓ Próximo riego: jueves (verano seco — cada 6 días)
- ✓ Dedo en el sustrato: los 3 cm superiores secos antes de regar
- ! Hojas amarillas abajo: revisa drenaje antes de acortar el ciclo

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | Alto (viral) | Medio (español+clima) | micro | Alta | mixed |

## ❄️ Profundizar

### Mercado
SOM honesto: no es un SaaS de miles de pagos, es un **lead-magnet**. Universo = plantlovers hispanos urbanos (LATAM). Monetización directa modesta (afiliados a viveros/sustratos que SÍ venden en LATAM, o un premium ~2 USD/mes por multi-planta); el valor real es **oportunidad**: tráfico y lista para toda la línea de contenido verde.

### Distribución
**Tu canal ES el go-to-market.** 1 video "por qué tu monstera se muere en verano" → enlaza al calendario → mides tráfico y cuántos piden "hazme el de mi planta". Reforzable con reels de rescate de plantas (formato probado del nicho). Distribution-first: no construyes y luego buscas usuarios, ya los tienes mirando.

### Gaps y fuente de la verdad
¿De dónde saca la verdad la app? → **De ti, curador experto**, como calendarios por especie/clima — NO de un algoritmo que diagnostica. No existe un dataset público confiable de riego por microclima, y por eso la app **NO promete "tu planta está enferma": educa**. Patrón guía-de-cuidado, nunca veredicto clínico sobre una planta concreta. Eso baja la idea de "GRANDE + IA" a "MICRO construible".

| Riesgo | Mitigación |
|---|---|
| **Consejo genérico mata plantas** — un ciclo mal calibrado y el usuario culpa a la app. | La app enseña la señal física (sustrato seco) como criterio final; el calendario es guía, no orden. |
| **Sin ground-truth por microclima** — el mismo ciclo no sirve en Lima y en Bogotá. | Calendarios curados por ciudad/estación; se ajustan con el feedback de posponer/adelantar. |

### Riesgo legal
**NINGUNO por diseño.** Consejo de cuidado de plantas: sin datos sensibles, sin salud humana, sin veredictos sobre terceros. Basta un aviso "guía educativa" estándar. → Riesgo none = se presenta sin condiciones.

### Red team
**Pre-mortem — "fracasó en 6 meses, ¿por qué?":** el contenido se hizo viral pero nadie pasó del video a la herramienta. **Kill-shot #1:** Planta y Greg ya existen (freemium + IA), más sofisticadas — tu único wedge es *español + clima local + tu canal*. **Mitigación:** validar con 1 video ANTES de construir a fondo; si no genera clics ni "hazme el de mi planta", no se construye la v2.

### El ask
Es una **micro-app de 2–3 días** que te devuelve **oportunidad** (tráfico + lista para la línea de contenido verde) y te sirve a ti como plantlover. El test de 7 días (1 video + calendario mínimo) decide si pasa a v2. **El diagnosticador con IA queda matado**: ground-truth inexistente + lo hacen los incumbentes. Esto es lo que sí construimos.

### Evidencia
- El riego de más como queja #1 recurrente del nicho — [r/houseplants](https://www.reddit.com/r/houseplants/)
- WTP probado: ya se paga suscripción por recordatorios — [Planta (App Store)](https://apps.apple.com/us/app/planta-care-for-your-plants/id1410126781)
- Incumbente freemium con comunidad — [Greg](https://greg.app/)
- Interés sostenido del término "plant care app" — [Google Trends](https://trends.google.com/trends/explore?q=plant%20care%20app)
