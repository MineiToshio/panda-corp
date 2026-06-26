<!--
  GOLD-STANDARD WORKED EXAMPLE — an idea card filled in the memo format.
  Proven to render RICH in Mission Control's Propuesta tab (full colour, charts, mock, bold, risk↔mitigation
  cards). `/discover` and `/new-idea` MIRROR this exact structure + markers so every generated card looks
  the same. The blank contract is `factory/ideas/_idea-template.md`; THIS is a complete, real instance to copy.
  Not a board card — it lives in `plugin/templates/` (the board only reads `factory/ideas/`), so it never
  appears on Mission Control. Keep the markers verbatim: `> **Badges:** … | … | …`, `### subsections`,
  the problema `> blockquote`, `- **Title** — desc` features, `**Vista previa — url**` + `- ✓`/`- !`,
  the scorecard table, the `| Riesgo | Mitigación |` table, evidence as `descripción — [fuente](url)`.
-->
---
title: "PandaCheck — checklist anti-fake del coleccionista"
project_type: web
origin: discovery
status: discovered
discard_reason: ""
verdict: build
the_bet: "El contenido 'real vs fake' es lo más viral del nicho; lo vuelves una herramienta lead-magnet, no un oráculo con líos legales."
fold_into: ""
why_now: "Crisis de falsificaciones 2025 (alerta CPSC + cobertura CNN sobre fakes de Labubu)."
kill_risk: "LegitApp ya existe (IA + expertos), más sofisticado; tu único wedge es español + tu canal."
validation_step: "1 video 'así detectas un Labubu falso' que enlace a un checklist web mínimo; mide tráfico + cuántos piden 'verifícame esta'."
score: 72
complexity_bucket: micro
painkiller_class: painkiller
ground_truth_source: "owner-as-curator (checklist de señales por experto, NO veredicto algorítmico)"
legal_risk: low
prior_workaround: "videos sueltos 'real vs fake' en inglés + preguntar en grupos/foros"
distribution_channel: "@pandadcollector + TikTok Live"
difficulty: low
profile_alignment: high
return_type: mixed
likely_stack: [Next.js, subida de imágenes]
evidence:
  - "https://www.cnn.com/2025/08/24/business/fake-labubus-pop-mart"
  - "https://legitapp.com/products/app-authentication"
created: 2026-06-26
project: ""
---

> **Veredicto: 🏗️ build (re-scopeado)** — **La apuesta:** Una web que te enseña a **detectar un Funko o Labubu falso en 60 segundos** — el checklist anti-fake del coleccionista hispano. No juzga tu pieza: te vuelve el experto.
> **Badges:** 🏗️ build (re-scopeado) | cubeta: MICRO · 2–3 días | painkiller · viral | retorno: oportunidad + personal

## 🔥 De un vistazo

### La apuesta
El contenido "real vs fake" es de lo más viral de tu nicho. PandaCheck convierte ese contenido en una **herramienta** que arrastra a tu audiencia hacia la línea Panda* — un lead-magnet, no un oráculo que se mete en líos legales.

### El problema
Pagaste S/120 por tu Labubu en una tienda no oficial. Llega la caja y empieza la duda: *¿los 9 dientes? ¿el sello del pie? ¿el holograma?* Buscas y solo encuentras un video en inglés, a medias. **Cada compra fuera de tienda oficial te deja esa espina** — y el QR "oficial" también lo clonan (60% de los fakes).

> "How do I know if my Labubu is real? The QR scanned fine but the box feels off…" — patrón repetido en foros y comentarios del nicho.

### Por qué ahora
Crisis de falsificaciones 2025: alerta de la **CPSC** y cobertura de **CNN** sobre fakes de Labubu. Tema caliente, compartible, y con gente comprando a ciegas *esta semana*.

### Por qué tú
Lo vives tú y tu nicho · Pandacorp lo construye en días · pocos ven que un *checklist en español* vale (todos asumen que hace falta una IA cara). Tienes **credibilidad experta + @pandadcollector (~30k)**. Esto es 100% tuyo.

### La visión
- **Checklist guiado por serie** — Labubu V1/V2/V3, Funko por código de pie; paso a paso con fotos de referencia real vs fake.
- **Galería "spot the fake"** — comparador lado a lado de las señales que delatan cada falsificación.
- **Modo detective gamificado** — insignias y "nivel de ojo experto", estética RPG, no un formulario.
- **"Verifícame esta" (v2)** — subes fotos y la comunidad/tú comentan; engagement, no veredicto automático.

**Vista previa — pandacheck.app/labubu-v3**
- ✓ Sello de pie con relieve nítido y fuente correcta
- ✓ 9 dientes, encías color durazno (no rosa chillón)
- ! Holograma: revisa el viraje de color al inclinar

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | Alto (viral) | Medio (español) | micro | Alta | mixed |

## ❄️ Profundizar

### Mercado
SOM honesto: no es un SaaS de miles de pagos, es un **lead-magnet**. Universo = coleccionistas hispanos de Funko/Labubu/Pop Mart (LATAM). Monetización directa modesta (freemium ~2-3 USD/verificación o afiliados a tiendas que SÍ paguen en LATAM); el valor real es **oportunidad**: tráfico y lista para toda la línea Panda*.

### Distribución
**Tu canal ES el go-to-market.** 1 video "así detectas un Labubu falso" → enlaza al checklist → mides tráfico y cuántos piden "verifícame esta". Reforzable con TikTok Live (paga en Perú desde may-2025). Distribution-first: no construyes y luego buscas usuarios, ya los tienes mirando.

### Gaps y fuente de la verdad
¿De dónde saca la verdad la app? → **De ti, curador experto**, como un checklist de señales — NO de un algoritmo que dictamina. No existe un dataset público de autenticidad confiable, y por eso la app **NO promete "real/falso": educa**. Patrón PSA/CGC y Entrupy: opinión experta, nunca garantía. Eso baja la idea de "GRANDE + riesgo" a "MICRO construible".

| Riesgo | Mitigación |
|---|---|
| **Falso positivo** — alguien marca "real" un fake, lo compra y pierde plata (precedente Nike v. StockX). | La app educa, no certifica; jamás emite veredicto sobre una pieza concreta. |
| **Sin ground-truth** — no hay base de datos de autenticidad oficial. | Checklist curado por serie; se actualiza cuando evoluciona la falsificación. |

### Riesgo legal
**BAJO por diseño.** Al no afirmar que una pieza concreta es falsa, no hay difamación a la tienda ni responsabilidad por error. Se cubre con un **disclaimer "educativo/informativo"** prominente (estándar FTC: claro y visible). → Riesgo bajo = se presenta con disclaimer, no se descarta.

### Red team
**Pre-mortem — "fracasó en 6 meses, ¿por qué?":** el contenido se hizo viral pero nadie pasó del video a la herramienta. **Kill-shot #1:** LegitApp ya existe (IA + expertos), más sofisticado — tu único wedge es *español + tu canal*. **Mitigación:** validar con 1 video ANTES de construir a fondo; si no genera clics ni "verifícame esta", no se construye la v2.

### El ask
Es una **micro-app de 2–3 días** que te devuelve **oportunidad** (tráfico + lista para la línea Panda*) y te sirve a ti como coleccionista. El test de 7 días (1 video + checklist mínimo) decide si pasa a v2. **El autenticador con IA queda matado**: ground-truth inexistente + cola legal. Esto es lo que sí construimos.

### Evidencia
- Crisis de fakes Labubu en prensa — [CNN](https://www.cnn.com/2025/08/24/business/fake-labubus-pop-mart)
- WTP probado: ya se cobra por autenticar — [LegitApp](https://legitapp.com/products/app-authentication)
- 60% de fakes con QR clonado — [smartbuy.alibaba.com](https://smartbuy.alibaba.com/popmart/how-to-scan-real-labubu)
- Patrón "opinión, no garantía" (grading) — [CGC](https://www.cgccards.com/card-grading/cgc-guarantee/)
- El falso positivo y su cola legal — [Nike v. StockX](https://www.thefashionlaw.com/nike-alleges-counterfeit-sales-insidious-false-advertising-by-stockx/)
