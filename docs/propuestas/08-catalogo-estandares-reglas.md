# Catálogo de estándares y reglas de decisión

> Generado 2026-06-14 a partir de una investigación web con verificación (32/40 hallazgos sobreviven).
> Principio rector: **un estándar no es texto, es un contrato verificable** — regla taxativa + verificador binario + rationale.

## Categorización (8 dominios + 2 ejes transversales)

8 dominios como faceta primaria: **Programación · Arquitectura · Diseño · Tecnología · Calidad · Seguridad · Operación/Observabilidad · Datos/Privacidad** (+ Producto/Docs). Más dos ejes por-regla:
- **Severidad (RFC 2119)**: `MUST` (fallo duro) / `SHOULD` (flexible con ADR) / `MAY`. El agente solo escala si va a romper un MUST.
- **Enforcement**: `lint` · `CI gate` · `checklist` · `gate humano / deny rule`.
- **Forma de un estándar ("estándar ejecutable")**: Regla / Cómo se verifica / Por qué (separados, no mezclados).

## Estándares NUEVOS creados (`fabrica/estandares/`)
- **`performance.md`** (Calidad, MUST web): CWV p75 (LCP≤2.5s/INP≤200ms/CLS≤0.1); Lighthouse-CI proxy block-on-main; campo vía PostHog.
- **`seguridad-web.md`** (Seguridad, MUST): headers OWASP con valores literales (HSTS/nosniff/Referrer/X-Frame/Permissions); CSP report-only en v1; header-scan en CI; preload submit = humano.
- **`observabilidad.md`** (Operación): logs JSON (service.name) + Sentry día 1; OTel como capa portable escalonada.
- **`privacidad.md`** (Datos, MUST): privacy by design (GDPR Art.25), minimización + RLS, export/delete (Arts.15/17/20), no loguear PII.
- **`api-design.md`** (Programación, MUST API): errores RFC 9457 (problem+json) + validación en el borde.
- **`seo-i18n.md`** (Producto, SHOULD web): Metadata API, sitemap/robots, next-intl, hreflang.
- **Ampliaciones:** `calidad.md` (a11y-gate + performance-gate en CI), `patrones.md` (red de error global).
- `README.md`: categorización, ejes y forma canónica. **No se recodificó** lo ya cubierto (seguridad agéntica, docs viva, validación de input).

## Reglas de decisión NUEVAS (`registro.yaml`)
- **DR-024** performance · **DR-025** privacidad/PII (escala si PII nueva) · **DR-026** observabilidad mínima · **DR-027** security headers · **DR-028** contrato de error API · **DR-029** feature flags · **DR-030** desviación del golden path (ADR per-proyecto; promover = humano). **DR-006 ampliada** (migraciones expand/contract). Las DR apuntan al estándar; los valores viven allí.

## UI del catálogo (Mission Control Configuración)
Evolución de FRD-07, **2 niveles máximo** (progressive disclosure): Resumen (grid filtrable con badges dominio/severidad/enforcement) → Detalle (regla con valores literales + cómo se verifica + por qué). Skills con mini-flujo de agentes; reglas con indicador auto/humano + explicación; estándares categorizados con Resumen/Detalle. Botones "Nuevo estándar"/"Nueva regla" → `/pandacorp:codify`. Futuro: scorecard de cumplimiento por proyecto (requiere que `verify.sh` emita pass/fail por estándar a `estado.yaml`).

## Caveats
- a11y, CSP estricta y PII **no son 100% verificables por script** → "gate automático + check del reviewer", no determinismo total.
- Nuevos MUST que rompan proyectos en vuelo (CSP, a11y-gate): introducir como SHOULD/aviso y promover al madurar.
- Citas correctas: RFC 9457 (no 7807); GDPR export/delete son Cap. III (no Art. 25).

## Fuentes
roadie.io · opslevel.com · martinfowler.com/reduce-friction-ai/encoding-team-standards · web.dev/vitals · owasp HTTP_Headers/CSP cheatsheets · rfc-editor.org/rfc/rfc9457 · opentelemetry.io · gdpr-info.eu/art-25 · diataxis.fr · nngroup.com/progressive-disclosure · backstage.spotify.com/soundcheck · nextjs production-checklist
