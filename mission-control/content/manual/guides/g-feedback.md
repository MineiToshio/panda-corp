---
title: "Reportar bug o decidir"
group: guides
order: 4
---

# Reportar un bug o responder una decisión

Mientras un proyecto se construye (o ya lanzado), tienes tres canales para meterle mano — todos **por archivos (file-based)**, que el agente revisa en su próximo **punto seguro (safe point)**, sin que tengas que pararlo. El motor **nunca interrumpe** a mitad de una work order: lee los canales **entre work orders**, al terminar cada WO.

> El cuerpo paso a paso se compone en React (`GuideFeedback`). Este markdown respalda el índice del Manual y documenta los tres canales.

- **Algo está roto** → `/pandacorp:bug`. Deja un fichero en la bandeja `.pandacorp/inbox/bugs/`; la construcción lo recoge en el siguiente safe point y le crea un test de regresión antes del fix.
- **Un cambio o módulo nuevo** → `/pandacorp:iterate`. El PM triagea: un ajuste chico se encola, un cambio fuerte te muestra el impacto y pide pausar.
- **Responder algo que te preguntó** → `/pandacorp:decide`. Te muestra la decisión con su recomendación, la registra en `decisions.md` y desbloquea el frente.

El estado (`status.yaml`) lo escribe el **gate**, no el agente: el motor lee los canales y recoge tu feedback entre work orders (gate-driven).

**Enlaces:** Mission Control te muestra el último commit en verde · seguro para probar (el panel de snapshot / último verde) y resalta las **decisiones pendientes** del workspace en Portfolio → Resumen.
