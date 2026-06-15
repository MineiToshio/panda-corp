# FRD-13 — Sistema visual y accesibilidad

Mission Control debe sentirse **de ingeniería, no decorativo**, sin que el dueño (débil en diseño) tenga que afinar nada. La palanca es la **restricción tokenizada**: pocos colores, pocas variables de tema, motion sobrio. Derivado de la investigación 2026 (ver [docs/propuestas/06](../../../docs/propuestas/06-plan-de-mejoras-2026.md), referencias Linear/Vercel Geist/Rauno). Mantiene la paleta cálida tipo Anthropic ya aprobada en el prototipo.

## Criterios de aceptación (EARS)

- EL tema DEBERÁ derivarse de **pocos tokens en espacio perceptual** (OKLCH/LCH: base, acento, contraste) en vez de decenas de hex sueltos, de modo que tocar el acento no descuadre el contraste del texto y se pueda habilitar un **modo alto-contraste** sin rediseñar.
- LA UI DEBERÁ usar **un único acento racionado** (puntuación, no pintura): acento solo en lo importante (tab activa, agente trabajando, barra de XP); el resto, neutros cálidos.
- TODO número (XP, niveles, conteos por columna, stats, timestamps) DEBERÁ usar **`font-variant-numeric: tabular-nums`**.
- LA elevación DEBERÁ tener **3 niveles** (canvas → panel → tarjeta/popup) con una escala de sombra/espaciado tokenizada (radio 8px, base 16px, hairline 1px, espaciado en múltiplos de 0.25rem).
- LA animación DEBERÁ usar **solo `transform` y `opacity`**, duración **<300ms**, y aplicar el *frequency test*: lo que se ve decenas de veces al día (tabs, hover) es sobrio; lo expresivo se reserva para eventos raros y satisfactorios (logro, subir de nivel, work order completada). 2–3 tokens de easing, no curvas por componente.
- LA UI DEBERÁ honrar **`prefers-reduced-motion`**: deshabilita toda animación de Party (sesiones largas → evitar fatiga).
- NINGÚN estado DEBERÁ depender solo del color: cada estado (trabajando / inactivo / fallido / completado) se empareja con **icono o forma + etiqueta** (crítico con paleta cálida, donde rojos/naranjas/ámbar están próximos).
- LA accesibilidad DEBERÁ cumplir: `aria-label` en español en iconos, `aria-live="polite"` para anunciar eventos sin robar foco, anillo de foco visible que respeta el `border-radius`, navegación de listas con teclado, **contraste ≥4.5:1** (riesgo real con cálidos claros).

## No-objetivos (v1)
- No es un design system publicable: es el sistema interno de Mission Control. Reusa shadcn/Tailwind como vocabulario.

## Relación
Aplica transversalmente a todas las pestañas (FRD-02 a FRD-06, FRD-10) y al prototipo `prototype/index.html`, que ya incorpora `tabular-nums`, `prefers-reduced-motion` y foco visible como base.
