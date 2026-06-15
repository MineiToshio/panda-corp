# Stack recomendado (sugerencia por defecto)

> ⚠️ Esto es una **sugerencia**, no una imposición. El agente `architect` propone el stack en el **blueprint**, evalúa si hay tecnologías mejores para ESE proyecto, y **el dueño lo aprueba** ahí (gate humano ligero, registrado como ADR). **Siempre se usan las últimas versiones estables** de lo que se elija.

## Punto de partida según tipo de proyecto

### Web full-stack (default)
- **Next.js** (App Router) + **React** + **TypeScript** (strict)
- **Tailwind CSS** + componentes propios (`core`/`modules`); `cn()` (clsx + tailwind-merge)
- **Prisma** + **PostgreSQL** (Neon/Supabase); data layer en `queries/`
- **Better Auth** (email + OAuth)
- **next-intl** (i18n, español por defecto)
- **Zod** (validación)
- **PostHog** (analytics) + **Sentry** (errores)
- **Cloudflare R2** (storage de archivos/fotos, SDK S3) — bucket por app
- **Resend** (email transaccional) + **Kit/ConvertKit** (email marketing / waitlist)
- **Polar** (pagos, Merchant of Record — funciona desde Perú/global) cuando la versión cobra
- **Vitest** (unit/integración) + **Playwright** (e2e)
- **ESLint + Prettier** (con `prettier-plugin-tailwindcss`)
- Gestor: **npm**. Deploy: Vercel (web) / contenedor en Railway o Fly.io (servicios)

> Modelo de cuentas, secretos (SOPS+age) y aprovisionamiento de estos servicios externos: `servicios-externos.md`. El stack de servicios validado en producción es el de PandaTrack.

### API / servicio backend
- TypeScript + Hono, o Python + FastAPI (según el caso); validación Zod/Pydantic; data layer aislado.

### Recolección de datos / scraping / notificaciones
- Python + FastAPI + Playwright/httpx + ARQ/Redis + PostgreSQL; scraping responsable (robots.txt, rate limiting, user-agent identificable).

## Reglas al elegir
1. Por defecto, lo de arriba en **últimas versiones estables**.
2. El `architect` **puede y debe proponer algo mejor** si encaja (mejor librería, lenguaje o servicio) — con trade-offs claros.
3. La decisión la **aprueba el dueño** en el blueprint y queda como ADR.
4. No mezclar tecnologías que rompan las convenciones duraderas (tipado estricto, data layer aislado, testing).
5. Nunca auth casero: usar una solución probada.
