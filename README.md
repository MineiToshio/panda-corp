# Pandacorp — Fábrica de software 100% IA

Pandacorp es una **fábrica de software operada por IA**: una línea de montaje donde *tú* (el dueño)
diriges con unos pocos gates humanos y agentes especializados de Claude hacen el resto —
descubrir ideas, escribir el PRD/FRDs, diseñar la UI, definir la arquitectura, construir con TDD,
revisar y desplegar. El proceso, los estándares y los agentes viven aquí; **el código de producto
nunca** — cada producto nace en su propio repo, hermano de este.

Este repo **es la fábrica** (el know-how). Lo operas con el plugin `pandacorp` para Claude Code:
una colección de skills (`/pandacorp:*`), agentes, hooks y plantillas.

> **Hecho para clonarse.** Cualquiera puede descargar este repo y usarlo como su propia fábrica.
> Tus datos personales (perfil, ideas, portfolio) **no** se versionan: quedan en tu disco, ignorados
> por git. Lo que se comparte es el molde.

## Requisitos

- [Claude Code](https://www.claude.com/product/claude-code) (CLI, app de escritorio, web o extensión IDE).
- `git`. Opcional pero recomendado: `gh` (GitHub CLI) para crear los repos de tus proyectos.
- Opcional: [Obsidian](https://obsidian.md/) para ver la base de ideas como kanban (`ideas.base`).

## Arranque rápido

```bash
git clone <este-repo> panda-corp
cd panda-corp

# 1) Registra este repo como marketplace local (lo llama "panda-corp")
claude plugin marketplace add .

# 2) Instala el plugin desde ese marketplace (scope usuario)
claude plugin install pandacorp@panda-corp

# 3) Abre Claude Code en esta carpeta y corre el onboarding
#   /pandacorp:onboarding
```

`/pandacorp:onboarding` es **el primer paso**: te entrevista (nombre, objetivos, cuenta de GitHub,
dónde nacen tus proyectos, cómo trabajas) y guarda tu perfil en `fabrica/perfil.md` — un archivo
**personal y gitignored** que el resto de la fábrica lee para personalizarse. Convierte una fábrica
genérica en *tu* fábrica.

## Cómo se opera

| Acción | Skill |
|---|---|
| **Configurar la fábrica (primer arranque)** | `/pandacorp:onboarding` |
| Explorar/aclarar una idea difusa conversando | `/pandacorp:explore [tema]` |
| Capturar/cristalizar una idea | `/pandacorp:new-idea` |
| Buscar dolores monetizables en internet | `/pandacorp:discover` |
| Pedir ranking/recomendación de ideas | `/pandacorp:recommend` |
| Crear el proyecto y documentar el MVP (handoff) | `/pandacorp:spec <idea>` |

`/pandacorp:spec <idea>` es el **handoff**: crea la carpeta/repo del proyecto (hermano de la fábrica)
y documenta el MVP. Las fases siguientes se corren **dentro de la carpeta del proyecto**:
`/pandacorp:design` → `/pandacorp:blueprint` → `/pandacorp:implement` → `/pandacorp:release`, y
`/pandacorp:iterate` para cambios en cualquier momento.

El flujo completo y las reglas están en [CLAUDE.md](CLAUDE.md).

## Mission Control

`mission-control/` es la **interfaz visual** de la fábrica: un dashboard web **local y de solo-lectura** que
muestra el tablero de ideas, el portfolio, el siguiente comando a copiar y Party (los
agentes del workflow en vivo). **Nunca llama a Claude** — solo lee los archivos del repo. Ver
[mission-control/PLAN.md](mission-control/PLAN.md).

## Estructura del repo

```
panda-corp/
├── fabrica/
│   ├── constitucion.md            principios innegociables
│   ├── estandares/                ingeniería que se inyecta en cada proyecto
│   ├── decisiones/registro.yaml   reglas recurrentes con default pre-aprobado
│   ├── ideas/                     base de ideas (tus fichas son personales/gitignored)
│   ├── perfil.example.md          seed de tu perfil  → /onboarding crea perfil.md
│   └── portfolio.example.md       seed del portfolio → /onboarding crea portfolio.md
├── plugin/                        el plugin pandacorp (skills, agentes, hooks, plantillas)
├── mission-control/                       la interfaz visual (Next.js, solo-lectura)
├── docs/                          visión, investigación y propuestas (el porqué del diseño)
├── BITACORA.md                    índice de bitácoras de decisiones
└── CLAUDE.md                      constitución operativa de la fábrica
```

## Hacerla tuya / privacidad

Lo que es **tuyo** vive en tu disco pero **no se sube** (ver [.gitignore](.gitignore)):

- `fabrica/perfil.md` — tu perfil (lo genera `/pandacorp:onboarding`).
- `fabrica/portfolio.md` — tu índice de proyectos.
- `fabrica/ideas/*.md` — tus fichas de ideas (se conserva la plantilla `_plantilla-ficha.md`).
- Los proyectos de producto viven en **carpetas/repos separados**, fuera de esta.

Los seeds `*.example.md` versionados son las plantillas a partir de las cuales el onboarding
genera tus archivos reales.

## Filosofía de decisiones

Tres cosas distintas, no se mezclan: el **doc canónico** (FRD/PRD/blueprint/ficha) es la *verdad
actual*; la **bitácora** (`BITACORA.md` y las de cada área) es la *historia* (qué cambió y por qué);
`fabrica/decisiones/registro.yaml` es la *política* (reglas recurrentes con default pre-aprobado).

## Licencia

Sin licencia por ahora — todos los derechos reservados. Se podrá definir una licencia abierta más
adelante.
