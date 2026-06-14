# Datos y privacidad

> Dominio: Datos/Privacidad · Severidad: **MUST** cuando se manejan datos personales. Enforcement: checklist en release + gate humano. Ver DR-025.

## Regla
- **Privacy by design & by default (GDPR Art. 25):**
  - **Minimización**: solo las columnas necesarias para el propósito (se decide en el modelo de datos del blueprint).
  - **Visibilidad restringida por defecto**: RLS de Supabase (o equivalente) materializa la accesibilidad mínima.
  - Pseudonimización donde sea viable.
- **Derechos del titular** (Cap. III, no Art. 25): el modelo debe permitir **export** (acceso/portabilidad, Arts. 15/20) y **delete** (supresión, Art. 17) de los datos de una persona.
- **Nunca loguear PII ni secretos.** Retención con plazo definido por defecto.
- **Cifrado at-rest e in-transit (Art. 32):** lo da el managed DB del golden path (Neon/Supabase); el trabajo real está en export/delete y minimización.

## Cómo se verifica
- Gate-checklist en `/pandacorp:release`: ¿qué PII se recolecta? ¿es lo mínimo? ¿hay export/delete? ¿logs sin PII?
- **Recolectar PII nueva o compartir datos con terceros = escalar a Sergio** (DR-025, alinea con DR-008).

## Por qué
Recolectar datos personales sin minimización ni derechos del titular es un riesgo legal real. Privacy-by-default convierte el cumplimiento en algo estructural (en el esquema), no en un parche posterior.

Fuentes: gdpr-info.eu/art-25-gdpr · gdprchecklist.io
