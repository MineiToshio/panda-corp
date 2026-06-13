# Patrones de implementación

(Para el stack web por defecto; adaptar el espíritu a otros stacks.)

## Server / Client (Next.js App Router)
- **Server Components por defecto.** `"use client"` solo cuando hace falta: estado/efectos, APIs de navegador, event handlers.
- Mantener las fronteras de cliente **mínimas pero coherentes** (a nivel feature, no fragmentar en mil componentes cliente).
- **Server Actions primero** para mutaciones disparadas desde la UI. Crear `app/api/**/route.ts` solo si: lo consume un cliente externo/webhook, necesitas comportamiento HTTP específico, streaming/descarga, o es machine-to-machine.

## UI optimista (patrón por defecto)
- Actualiza el cliente de inmediato; revierte si el servidor falla.
- Cierra modales/sheets de forma síncrona al enviar (no esperes la respuesta del servidor). El padre maneja el rollback + toast de error.

## HTML semántico y accesibilidad
- `<button>` para acciones, `<a>` para navegación, `<nav>/<main>/<section>/<header>` según corresponda. Nada de `<div onClick>`.
- Touch targets ≥44px, contraste WCAG AA, estados de foco visibles. Verificar con axe-core.

## Tema y estilos
- **Light y dark siempre**: usar variables semánticas de color, nunca colores hardcodeados (`bg-background text-foreground`, no `bg-white text-black`).
- Tailwind con helper `cn()` (clsx + tailwind-merge). Clases ordenadas (prettier-plugin-tailwindcss o equivalente).
- Los valores visuales salen de los **design tokens** definidos en la fase de diseño (`docs/diseno/design-tokens.json`).

## Estados y datos
- Diseñar siempre estados **vacío / cargando / error** (no improvisarlos).
- Analytics por defecto en interacciones clave (CTAs, navegación, forms, toggles); eventos centralizados en constantes, nunca strings sueltos. No trackear hover/cada tecla.
