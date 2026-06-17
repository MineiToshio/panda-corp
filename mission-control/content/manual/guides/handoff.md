---
title: "Cómo hacer handoff a otra persona"
group: guides
order: 3
---

# Cómo hacer handoff a otra persona

Esta guía explica cómo transferir el control de la fábrica y de un proyecto a otra persona —un colaborador, un cliente, o tú mismo en un nuevo dispositivo— de forma que puedan operar sin contexto previo.

## Qué necesita la persona que recibe

1. **Claude Code** instalado con cuenta activa.
2. Acceso de lectura/escritura al repositorio de la fábrica (`panda-corp`).
3. Acceso a los repositorios de los proyectos que van a operar.

## Paso 1 — Clonar la fábrica

```
git clone <repo-url-fabrica> panda-corp
cd panda-corp
```

## Paso 2 — Instalar el plugin

```
claude plugin install pandacorp@panda-corp
```

El plugin es local al repositorio clonado. Si el repo tiene cambios no instalados, el dashboard advierte del desfase (banner de plugin out-of-sync).

## Paso 3 — Ejecutar el onboarding

```
/pandacorp:onboarding
```

Esto genera el `factory/profile.md` personal de la nueva persona (gitignoreado — nunca se commitea). La fábrica lee ese fichero para personalizar la experiencia.

## Paso 4 — Sincronizar el portfolio

```
/pandacorp:sync-portfolio
```

Lee los proyectos en la ruta configurada en el perfil y actualiza `factory/portfolio.md` con los punteros correctos.

## Paso 5 — Instalar Mission Control

Desde la carpeta `mission-control/`:

```
pnpm install
pnpm dev
```

Abre `http://localhost:3000` para ver el estado de todos los proyectos.

## Qué encontrará en Mission Control

- **Tablero de ideas** — el estado de cada idea en su ciclo de vida.
- **Portfolio** — lista de proyectos activos con su fase actual.
- **Work Orders** — estado del build en curso por proyecto.
- **Manual** — esta misma documentación navegable.

## Dónde vive la documentación de cada proyecto

Cada proyecto tiene su propio `docs/` con:

- `docs/product/prd.md` — visión y métricas.
- `docs/product/architecture.md` — arquitectura de la plataforma.
- `docs/frds/frd-NN-<slug>/frd.md` — contrato de cada funcionalidad.
- `docs/decision-log.md` — historial de decisiones y el porqué.

La nueva persona puede leer cualquier FRD para entender qué hace cada parte del sistema y por qué se decidió así.

## Operación desde el día 1

Con el onboarding completo, la nueva persona tiene acceso a todos los comandos `/pandacorp:*`. Para añadir una funcionalidad:

```
cd <ruta-del-proyecto>
/pandacorp:iterate
```

Para reportar un bug:

```
/pandacorp:bug
```

El flujo es idéntico al del owner original — la fábrica no distingue entre personas.

## Secretos y credenciales

Los secretos **nunca están en el repositorio**. Se inyectan mediante variables de entorno o un gestor de secretos (SOPS + age, según DR-037). La persona que hace el handoff debe transferir el acceso a esas credenciales por un canal seguro fuera de git.
