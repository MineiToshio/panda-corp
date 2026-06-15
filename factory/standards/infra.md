# Infraestructura y operación local

Convenciones de cómo corre un proyecto en **desarrollo** (la fábrica las inyecta en cada proyecto). Detalle del modelo de construcción desatendida en [docs/proposals/07-unattended-build.md](../../docs/proposals/07-unattended-build.md).

## Base de datos y servicios en dev → Docker

- **Dev**: cada proyecto levanta su BD y servicios (Postgres, Redis si aplica) con **Docker Compose**, definido en el repo (`docker-compose.yml`). Reproducible, aislado, y el agente lo levanta de forma determinista. Único requisito de máquina: Docker Desktop instalado.
- **Staging / producción**: NO Docker — managed DB del golden path (Neon / Supabase). Docker es solo para local.
- Cada **worktree** usa su propia instancia/DB (o un nombre de proyecto Compose distinto, `docker compose -p <worktree>`) para que la prueba del dueño y la del agente no se pisen.

## Convención de puertos (varios proyectos / worktrees a la vez)

Para que nada se cruce cuando corren varias cosas en paralelo:
- Cada **proyecto** recibe un **rango base** al crearse (lo registra la fábrica; ej. proyecto A → 4000s, B → 4100s…).
- Cada **worktree** suma un offset dentro del rango (la del agente `+0`, la de review `+1`).
- App, BD y servicios leen su puerto del `.env` de ese worktree. En Docker, mapear puertos vía `.env` y usar nombre de proyecto Compose distinto por worktree.
- Mission Control muestra el puerto ("prueba en `localhost:XXXX`").

## Worktrees (probar un snapshot sin parar al agente)

- El agente construye en su worktree; el dueño prueba el **último commit verde** (`last_green_sha`) en otra carpeta:
  `git worktree add ../<proyecto>-review <last_green_sha>`.
- Un worktree nace **sin** `.env` ni `node_modules`. La plantilla del stack incluye un **`.worktreeinclude`** (sintaxis `.gitignore`) que copia `.env`/`.env.local` a cada worktree nuevo, más un paso post-create que instala deps. Con **pnpm** (almacén compartido) el install en un worktree nuevo es casi inmediato.
- Mantener **UNA** carpeta de review y refrescarla al último verde (no acumular worktrees). El sweep automático de Claude Code no borra worktrees creados a mano.

## Estado publicado para Mission Control (`docs/status.yaml`)

El script del gate (no el agente) escribe en cada cierre de work order verde:
- `last_green_sha`: commit del último work order cerrado en verde.
- `safe_to_test: true/false`: `true` solo cuando `HEAD == last_green_sha` (no hay trabajo sin commitear).
Más: `bugs_pendientes` (bandeja `docs/bugs/`), `decisiones_pendientes` (docs/decisions.md), `replanteo_pendiente` (iterate pidió pausar).

## Gates humanos como reglas duras

Los gates de la constitución (producción, gastar dinero, borrar datos, comunicaciones externas, cambios de acceso) se aplican como **reglas `deny` en `.claude/settings.json`** + el hook `block-dangerous.sh`, NO como límites dichos en la conversación (la compactación de contexto puede perderlos). El "auto mode" de Claude Code NO es blindaje de seguridad — las deny rules ganan siempre.
