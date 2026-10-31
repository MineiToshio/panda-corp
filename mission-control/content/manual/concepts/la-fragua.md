---
title: "La Fragua"
group: concepts
order: 19
---

# La Fragua: el build en vivo

**La Fragua** aparece en la parte superior de **Resumen** de cada proyecto. Sus cuatro
estaciones, **Cola · Taller · Revisión · Bóveda**, muestran las órdenes de trabajo según su
estado real. Abre el proyecto desde **Portafolio** para seguir la construcción.

## Una orden, una estación

Cada orden tiene un token con su número de FRD y su número de orden. Al pasar el ratón o
recibir foco, el token muestra el código, el título, el estado y el FRD de esa orden.

| Estación | Órdenes que contiene | Fuente |
|---|---|---|
| **Cola** | Trabajo planificado, todavía sin empezar | Frontmatter `implementation_status: PLANNED` |
| **Taller** | Trabajo en construcción, bloqueado o fallido | Frontmatter `IN_PROGRESS`, `BLOCKED` o `fail` |
| **Revisión** | Trabajo construido que espera o pasa el gate de su FRD | Frontmatter `IN_REVIEW` |
| **Bóveda** | Trabajo verificado | Frontmatter `VERIFIED` |

Una orden bloqueada o fallida permanece en Taller con el color de peligro. Si una revisión
devuelve una orden a `PLANNED`, su token vuelve a Cola. Los eventos no deciden la estación:
la fuente de verdad es el frontmatter, el mismo que lee Observabilidad.

Cada estación enseña hasta ocho tokens y un «+N» cuando hay más. El contador incluye todas
las órdenes de esa estación; la lista completa se consulta en Observabilidad. Una estación
vacía muestra tres huecos y su mensaje de vacío. Si aún no hay órdenes, la escena explica
que se llenará cuando Arquitectura publique el plan. En el teléfono las estaciones se apilan.

## La decoración nunca finge medición

Los equipos decorativos de cada estación son fijos: no representan agentes individuales ni
multiplican las órdenes de trabajo. Los tokens y contadores sí representan datos reales.
La comunicación entre agentes queda en documentos, incluido el **Status Note** de cada orden.

La escena anima los equipos y un mensajero solo cuando el build está encendido y hay señal
reciente. El mensajero recorre una ruta dorada entre la primera y la última estación con
trabajo. Si el build está apagado o sin señal, la escena queda en reposo y conserva los tokens.

## Frescura: en vivo, datos antiguos, sin señal

El indicador de frescura permite distinguir un build activo de una bandera sin respaldo.
La señal reciente procede del heartbeat del supervisor o de los eventos del build. Un estado
«corriendo» sin señal reciente no basta para animar la escena.

Esta es la regla DR-066: un monitor nunca presenta una bandera auto-reportada como prueba
de vida. Si la señal envejece, revisa el build antes de confiar en su actividad.

## Por qué la escena se actualiza

Dos canales alimentan la vista:

1. **Eventos:** las transiciones del motor refrescan la actividad y su frescura.
2. **Estado en disco:** el transporte observa `status.yaml` y el frontmatter de las órdenes.
   Cuando cambian, vuelve a leer la estructura aunque no haya llegado un evento.

Un evento antiguo no enciende un build apagado. La actividad exige que `status.yaml` indique
que está corriendo y que la señal sea reciente; las estaciones siguen derivándose de las órdenes.

## Para profundizar

- Requisitos de las cuatro estaciones: `docs/frds/frd-06-party/frd.md` (REQ-06-020).
- Diseño técnico: `docs/frds/frd-06-party/blueprint.md`.
- Productores de eventos y heartbeat: `factory/standards/observability.md`.
