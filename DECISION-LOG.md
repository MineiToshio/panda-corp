# Bitácora de Pandacorp

Todo lo que decidimos y **por qué**, para no perder el rastro. Organizado por área; lo más reciente arriba en cada una.

| Área | Bitácora | Qué cubre |
|---|---|---|
| 🛰️ Mission Control (app Next.js) | [mission-control/docs/bitacora.md](mission-control/docs/bitacora.md) | Features, diseño y decisiones del producto Mission Control |
| 🔌 Plugin pandacorp | [plugin/docs/bitacora.md](plugin/docs/bitacora.md) | Skills, agentes, hooks y flujo de la fábrica |
| 💡 Ideas | [fabrica/ideas/bitacora.md](fabrica/ideas/bitacora.md) | Decisiones sobre la base de ideas y su proceso (no el contenido de cada idea) |
| 🏭 Fábrica | [fabrica/bitacora.md](fabrica/bitacora.md) | Constitución, estándares y decisiones de operación |

## Cómo se usa

Documentar un cambio son **dos capas**, siempre:

1. **Doc canónico** (la verdad actual) — el documento *dueño* del hecho se actualiza: comportamiento de la app → el **FRD**; técnico → el **blueprint/ADR**; plugin → el **archivo del skill**; idea → su **ficha**. Mapa completo en [CLAUDE.md](CLAUDE.md), sección *Bitácora*.
2. **Bitácora** (la historia) — esta entrada: fechada, con *qué* y *por qué*, enlazando el doc que se tocó. Lo más reciente arriba.

El doc canónico dice *qué es verdad hoy*; la bitácora, *qué cambió y por qué*. Hacen falta los dos.

**No confundir tres cosas:** doc canónico = **verdad actual**; bitácora = **historia**; [fabrica/decisiones/registro.yaml](fabrica/decisiones/registro.yaml) = **política** (reglas con default).

### Formato de cada entrada

```markdown
## AAAA-MM-DD — Título corto de la decisión
**Qué:** lo que decidimos/hicimos.
**Por qué:** la razón.
**Contexto:** alternativas que sopesamos, qué descartamos (opcional).
**Impacto:** archivos/áreas tocadas (opcional).
```
