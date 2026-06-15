# FRD-11 — Modos de construcción por proyecto

Permite elegir con cuánta potencia se construye cada proyecto, y muestra el comando que toca ejecutar.

## Criterios de aceptación (EARS)
- CADA proyecto DEBERÁ ofrecer (en su pestaña Comandos) un selector de **modo de construcción** con cuatro opciones:
  - **Pro / económico** — 1 agente a la vez, modelos económicos (sonnet/haiku). Más lento, mínimo consumo. Para plan Pro.
  - **Equilibrado** (default) — equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Pensado para Max 5x.
  - **Potente** — hasta 5 agentes en paralelo, avanza más rápido. Para Max 20x.
  - **Profundo** — mejores modelos en todos + revisión adversarial extra. Para un proyecto especial.
- CUANDO el dueño elige un modo, DEBERÁ mostrarse el **comando exacto a copiar** (`/pandacorp:implement [modo]`) con su descripción (agentes, modelos, plan recomendado).
- EL modo elegido DEBERÁ **recordarse por proyecto**.
- EL skill `/pandacorp:implement` DEBERÁ aceptar esos modos como argumento (`pro` | `potente` | `profundo`; sin argumento = equilibrado).

## Futuro
El modo definirá la **composición del equipo** (cuántos agentes y de qué rol; p. ej. varios frontend), y **Party** ([FRD-06](frd-06-party.md)) mostrará el equipo real que esté corriendo.
