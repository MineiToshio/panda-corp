# Seguridad web (headers / CSP)

> Dominio: Seguridad · Severidad: **MUST** (web). Enforcement: CI gate (header-scan) + gate humano para el preload. Consolida lo que estaba disperso (constitución §12, DR-017, `security-auditor`). Ver DR-027.

## Regla — headers (valores literales pre-aprobados)
Se setean en `next.config` `headers()` o middleware:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY` (o CSP `frame-ancestors 'none'`)
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- **Eliminar** `X-Powered-By` y banners de `Server`.

## Regla — CSP
- **CSP con nonce/hash, sin `unsafe-inline`** es el objetivo, pero **en v1 va en `report-only`** (no bloqueante): el nonce por request rompe con PostHog/Sentry/Stripe (todos en el stack). Se endurece cuando el proyecto madura.

## Cómo se verifica
- **Test de header-scan en CI** (convierte el "headers de seguridad" decorativo en algo fail-closed): asevera que cada header está presente con su valor.
- El **submit a hstspreload.org es duradero y difícil de revertir → lo aprueba el dueño**, no el agente.

## Por qué
Estos headers son baratos y cortan clases enteras de ataques (clickjacking, sniffing, fuga de referrer). Por eso son default literal, no decisión por proyecto.

Fuentes: owasp HTTP_Headers_Cheat_Sheet · owasp Content_Security_Policy_Cheat_Sheet · nextjs production-checklist
