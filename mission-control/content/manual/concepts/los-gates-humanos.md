---
title: "Los gates humanos"
group: concepts
order: 16
---

# Los gates humanos

La fábrica es autónoma, pero hay decisiones que **solo tú** puedes tomar: las que tienen consecuencias irreversibles, cuestan dinero o salen al mundo. Son los **gates humanos**. Todo lo demás lo resuelve el registro de decisiones (`factory/decisions/registry.yaml`); una decisión no cubierta se escala UNA vez y se codifica como regla.

## La lista completa

Solo requieren tu visto bueno explícito:

1. **Selección de idea** — elegir qué idea avanza.
2. **Elección de diseño** — aprobar el diseño visual.
3. **Release a producción** — el deploy a producción (DR-004).
4. **Gastar dinero** — compras, planes de pago, dominios, APIs de pago. El bloqueo siempre es **con el monto** (DR-005): no hay umbral automático, cualquier gasto se aprueba indicando cuánto.
5. **Borrar datos o recursos** — borrar datos, repos, ramas remotas o recursos cloud (DR-007).
6. **Comunicaciones externas** — emails a usuarios, webhooks públicos, publicar en stores/marketplaces (DR-008).
7. **Cambios de acceso** — permisos, roles, credenciales.

## Se aplican como reglas duras, no como conversación

El principio clave: estos gates se aplican como **reglas `deny` duras** en `.claude/settings.json` + hooks deterministas, **nunca** como límites dichos en la conversación. ¿Por qué? El contexto puede compactarse y perderse; un hook no. **"Auto mode" no es una salvaguarda** — un agente con permisos amplios sigue topándose con la regla `deny`.

## Cada intervención reduce las futuras

La otra mitad del principio: **toda intervención humana debe reducir las futuras.** Cuando te escalan algo no cubierto, das tu respuesta y esa respuesta **se codifica como regla** en el registro. La próxima vez que aparezca el mismo caso, ya no te preguntan: el default decide. Así la fábrica se vuelve más autónoma con el uso, sin perder el control sobre lo que importa.

> Cada gate dispara además un **push al celular** (DR-038): el pendiente queda por archivo y te llega un aviso accionable.
