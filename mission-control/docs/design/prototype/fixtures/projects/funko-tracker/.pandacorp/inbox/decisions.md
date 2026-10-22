# Decisiones pendientes — Funko Tracker

## 2026-10-20 — RESUELTO: mantener el vigilante horario en la integración continua
- **Estado:** RESUELTO
- **Decisión:** el vigilante sigue corriendo en la integración continua del repositorio una semana más y se revisa el consumo.
- **Contexto:** el plan gratuito alcanza para una corrida por hora; moverlo al trabajador costaría dinero desde el primer día.

## 2026-10-20 (RESUELTO) — Posponer la analítica hasta el lanzamiento
- **Estado:** RESUELTO
- **Pregunta:** ¿instrumentar eventos desde el primer build o después de lanzar?
- **Recomendación:** posponer; el v1 se valida con entrevistas y la cola de compartidos.
- **Decisión:** posponer, registrado en el ADR correspondiente.

## RESUELTO — La construcción se detiene por dependencias entre FRDs (2026-10-17)
- **Estado:** RESUELTO
- **Qué pasa:** dos órdenes esperan a otra de un FRD distinto que todavía no empezó.
- **Recomendación:** relanzar con el orden de dependencias corregido.

## 2026-10-18T17:35:15Z — RESUELTO: reversión parcial bloqueada en frd-01-browse-catalog (needs-owner)
- **Estado:** RESUELTO
- **Qué pasa:** el motor intentó revertir una orden y chocó con cambios de otra feature.
- **Decisión:** conservar el código; la orden se rehízo encima.
