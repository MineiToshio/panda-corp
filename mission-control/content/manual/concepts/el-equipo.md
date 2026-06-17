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

### Researcher

Investiga el mercado, la competencia y las tendencias tecnológicas. Informa el PRD con datos reales. Busca demanda verificable antes de construir.

### Product Manager

Documenta el PRD y los FRDs. Convierte la visión del propietario en criterios de aceptación EARS accionables para los implementers.

### Designer

Crea mockups navegables con identidad visual bespoke. Genera el sistema de diseño (tokens, paleta, tipografía) que el frontend usa como única fuente de verdad visual.

### Implementer

Rol genérico de construcción — ejecuta work orders con TDD. En la práctica lo usan el backend-dev y el frontend-dev según el tipo de WO.

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
