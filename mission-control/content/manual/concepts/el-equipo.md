---
title: "El equipo"
group: concepts
order: 3
---

# El equipo

Pandacorp opera con un equipo de agentes de IA especializados. Cada agente tiene un rol bien definido, un modelo asignado y responsabilidades concretas. El propietario es el único humano del equipo — todos los demás son agentes.

## Los agentes

### Architect

Diseña la arquitectura técnica de la plataforma y de cada FRD. Genera el blueprint con el stack, el modelo de datos, los componentes y las interfaces. Produce las work orders que dividen la construcción.

### Backend Developer

Implementa la lógica de servidor: APIs, acceso a datos, lógica de negocio, integraciones externas. Opera bajo las convenciones de la fábrica (strict typing, TDD, sin `any`).

### Frontend Developer

Construye los componentes UI, layouts y la interactividad del cliente. Usa únicamente design tokens — nunca valores hardcodeados de color o espaciado.

### Test Writer

Escribe los tests de aceptación (RED) antes de que el implementer escriba código, anclados en los criterios EARS de los FRDs. También escribe tests adversariales y e2e en flows críticos.

### Reviewer

Valida el trabajo de otros agentes al nivel del FRD. Vuelve a correr toda la evidencia, escribe tests adversariales que el implementer no vio, y ejecuta mutation testing. Solo él puede marcar un FRD como VERIFIED.

### Drift Finder

Buscador de deriva de FRD completa, sobre sonnet (esfuerzo medio, hasta 60 llamadas). Corre dentro de cada gate de FRD fijado a su worktree, en paralelo con el colector de evidencia: por defecto cuando el gate usa evidencia `digested`, y en modo `explore` solo si se activa con `driftFinder` (launcher `--drift-finder on|off`). Recibe todo el catálogo de contratos del FRD, nunca el diff, y señala dónde el código ya verificado se aleja del FRD, con una prueba por cada deriva. Solo propone: el Reviewer sigue siendo el juez, y cada deriva que el Reviewer no resuelve pasa por la prueba diferencial (DR-122) antes de convertirse en tarjeta o reapertura.

### Researcher

Investiga el mercado, la competencia y las tendencias tecnológicas. Informa el PRD con datos reales. Busca demanda verificable antes de construir.

### Product Manager

Documenta el PRD y los FRDs. Convierte la visión del propietario en criterios de aceptación EARS accionables para los implementers.

### Designer

Crea mockups navegables con identidad visual bespoke. Genera el sistema de diseño (tokens, paleta, tipografía) que el frontend usa como única fuente de verdad visual.

### Implementer

Rol genérico de construcción — ejecuta work orders con TDD. En la práctica lo usan el backend-dev y el frontend-dev según el tipo de WO.

### Mech

Ejecutor mecánico de bajo juicio — solo tiene acceso a `Bash` y `Read`, nunca a `Write`/`Edit`, así que no puede tocar código de producto. Corre los pasos de plomería del motor de `implement` que no requieren decidir nada: el commit por work order, el sello de dispatch de cada oleada, el sync de rollups, y la notificación de fin de run (más el archivado de changes cuando `leanCloseOut` está desactivado — por defecto ese paso vive en el cierre del reviewer). No reemplaza al `implementer` ni al `reviewer` — ejecuta exactamente el comando que se le indica y nada más. El safe-point se queda explícitamente en el implementer y nunca pasa por Mech: decidir qué hacer con un ítem drenado (o con cualquier otra cosa en ese punto) es juicio, no un script. Corre sobre el modelo MECH (haiku por defecto, configurable con `args.mechModel`) a `effort: 'low'`.

### Librarian

Cosecha lecciones del inbox de memoria (`.pandacorp/run/lessons.md`) y las refina en entradas duraderas en `factory/memory/`. Mantiene la memoria transversal de la fábrica.

### Analytics

Define el plan de eventos de analítica, instrumenta el tracking y produce el dashboard de métricas para el review de lanzamiento.

### Copywriter

Escribe el copy de UI, los textos de marketing y la documentación de usuario, siempre en el idioma correcto (i18n).

### DevOps

Configura la infraestructura, el CI/CD, los entornos de despliegue y los secretos. Gate humano para cualquier cambio de acceso o gasto.

### Security Auditor

Revisa la superficie de ataque siguiendo OWASP Top 10 para aplicaciones agénticas. Informa al propietario de vulnerabilidades antes del release.

## Cómo se orquesta el equipo

El motor de `implement` asigna work orders a agentes según el tipo de tarea. Hasta 3 agentes trabajan en paralelo cuando sus WOs no tienen dependencias entre sí. La coordinación es explícita en el código del workflow — no hay comunicación peer-to-peer entre agentes.

## En Mission Control

El **Party panel** muestra los agentes activos con sus avatares animados. Los estados reflejan el trabajo en tiempo real: el agente se mueve cuando trabaja, se congela cuando espera, y celebra cuando completa una WO.
