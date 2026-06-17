---
title: "Cómo operas a diario"
group: guides
order: 1
---

# Cómo operas a diario

Esta guía describe la rutina de trabajo con Pandacorp una vez que la fábrica está configurada y tienes proyectos en marcha.

## Abrir Mission Control

Mission Control es el panel de mando. Desde la carpeta `mission-control/`:

```
pnpm dev
```

Abre `http://localhost:3000`. Desde aquí ves el estado de todos tus proyectos, las work orders activas, los agentes del equipo y los eventos en tiempo real.

## Navegar tus ideas

La sección **Inicio** muestra el tablero de ideas en sus columnas (Descubierta → Recomendada → En pipeline → Enviada / Descartada). Puedes seleccionar una idea para avanzarla al siguiente paso.

## Trabajar con un proyecto activo

Desde la carpeta de un proyecto (`cd <ruta-del-proyecto>`) tienes acceso a todos los comandos `/pandacorp:*`. Los más habituales en el día a día:

| Comando | Cuándo usarlo |
|---|---|
| `/pandacorp:iterate` | Añadir una funcionalidad o cambiar un comportamiento |
| `/pandacorp:bug` | Reportar un bug encontrado durante las pruebas |
| `/pandacorp:decide` | Registrar una decisión pendiente |
| `/pandacorp:review-launch` | Leer métricas reales y decidir kill / hold / double-down |

## El ciclo de una iteración típica

1. Abres Mission Control → ves el estado del build en curso.
2. Si hay work orders **BLOCKED** o **IN_REVIEW**, revisas y apruebas o escalas.
3. Si quieres añadir algo nuevo, usas `/pandacorp:iterate` desde la carpeta del proyecto.
4. El motor de `implement` retoma el trabajo, crea nuevas work orders y las ejecuta.
5. Recibes una notificación en el Party panel cuando el build avanza.

## Gestión del inbox

El directorio `.pandacorp/inbox/` tiene dos canales:

- **`bugs/`** — ficheros de bug reportados por el owner o por los agentes. El próximo ciclo de `implement` los recoge.
- **`decisions.md`** — decisiones pendientes de resolver. El agente `decide` las lleva al registro.

Añadir un fichero a `bugs/` o una entrada a `decisions.md` es suficiente para comunicarte con una construcción en marcha sin interrumpirla.

## Vigilar la calidad

El script `.pandacorp/verify.sh` es la fuente de verdad:

```
bash .pandacorp/verify.sh
```

Debe estar verde antes de cualquier commit. Lo ejecuta el motor de `implement` automáticamente, pero puedes correrlo tú también.

## Apagar y retomar

El build es **resumible**: si cierras la sesión y la retomas, el motor de `implement` retoma desde el último safe-point (commit verde). No pierde trabajo.
