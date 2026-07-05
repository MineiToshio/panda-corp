---
title: "Hooks, gates y seguridad"
group: concepts
order: 8
---

# Hooks, gates y seguridad

La fábrica usa un sistema de gates y hooks para garantizar que ciertos tipos de acciones — las que tienen consecuencias irreversibles o costosas — siempre pasen por un humano o un script de verificación.

## Gates humanos

Solo el propietario puede autorizar:

1. **Elegir qué idea construir** — avanzar una idea a `in-pipeline`.
2. **Aprobar el diseño visual** — antes de generar el blueprint.
3. **Autorizar el release a producción** — gate explícito en `/pandacorp:release`.
4. **Gastar dinero** — activar servicios de pago, suscripciones, créditos de API.
5. **Conectar servicios externos** — OAuth, webhooks, integraciones.
6. **Eliminar datos** — borrado permanente en cualquier capa.
7. **Comunicaciones externas** — emails, publicaciones en redes, PRs públicas.

Estos gates están codificados como reglas `deny` en `.claude/settings.json` y como hooks deterministas — no son solo instrucciones en el contexto de la conversación (el contexto puede compactarse y perderse; los hooks no).

## Gates de calidad (automáticos)

El script `.pandacorp/verify.sh` es el gate de calidad. Corre:

- `pnpm vitest run` — todos los tests deben pasar.
- `pnpm tsc --noEmit` — sin errores de tipos.
- `pnpm biome check` — sin errores de lint ni formato.

Si falla, el motor de `implement` se congela (freeze-on-red, DR-015) y escala al propietario. Nunca avanza sobre código roto.

## Gate de revisión por FRD (DR-050)

Cuando todas las work orders de un FRD están en `IN_REVIEW`, el agente `reviewer` (de modelo diferente al implementer) ejecuta el gate de FRD:

1. Vuelve a correr `verify.sh` en un entorno limpio.
2. Lee todos los criterios de aceptación EARS del FRD.
3. Escribe tests adversariales que el implementer no vio.
4. Ejecuta mutation testing para confirmar que los tests no son decorativos.
5. Solo si todo pasa: marca las WOs como VERIFIED y el FRD avanza.

El implementer nunca verifica su propio trabajo — esa es la invariante de este gate.

## Freeze-on-red (DR-015)

Si `verify.sh` falla, el motor se congela. Máximo 3 intentos de reparación por fallo; si el mismo error se repite, se escala al propietario. No hay "bypass" — un agente que saltara este gate violaría la constitución.

## Gates de la propia fábrica

El repo de la fábrica también tiene sus gates automáticos:

- **Deriva de artefactos generados** (`check-derived-drift.sh`, hook de Stop): los espejos Codex (`.codex/agents/*.toml`), el manifest espejo del plugin y el symlink `.agents/skills` se verifican contra sus fuentes únicas en cada sesión. Deriva detectada = la sesión no puede cerrar hasta regenerar (DR-113).
- **Aviso de aislamiento con alcance real** (BL-0033): el recordatorio de worktree (DR-096) ya no salta al editar prosa de la fábrica (estándares, docs, texto de skills — superficies sin gate de programa completo); sigue saltando para lo que se ejecuta o se despliega a proyectos (`plugin/scripts`, `plugin/hooks`, `plugin/templates`, `mission-control/`). En la fábrica se aterriza directo a `main` — la merge queue existe solo en los proyectos.

## Seguridad de las operaciones agénticas

La fábrica sigue OWASP Top 10 para aplicaciones agénticas (ASI01–ASI10):

- **Tool Misuse** — los agentes solo usan las herramientas que necesitan; las operaciones destructivas (force-push, borrado de datos, deploy a producción) requieren gate humano explícito.
- **Identity & Privilege Abuse** — cada agente opera con el mínimo privilegio necesario para su rol.
- **Memory Poisoning** — `.pandacorp/comms/progress.md` y la memoria de la fábrica son fuentes de verdad que solo se actualizan mediante commits verificados. Las lecciones candidatas no se promueven sin gate humano.
- **Cascading Failures** — el freeze-on-red previene que un error en una WO se propague al resto del build.

## Secretos

Nunca en el código ni en el contexto de los agentes. Se inyectan via variables de entorno. El `.gitignore` excluye `.env*`. SOPS + age es el gestor de secretos recomendado (DR-037).
