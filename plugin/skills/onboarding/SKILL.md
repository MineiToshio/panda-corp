---
description: Configura la fábrica Pandacorp para un dueño nuevo (primer arranque tras clonar el repo). Te entrevista a fondo —nombre, objetivos, intereses, hobbies, gustos, activos/palancas, apetito de monetización, tipos de proyecto, cómo trabajás— y guarda tu perfil en fabrica/perfil.md (personal, gitignored). Ese perfil alimenta a /discover y /recommend para proponerte ideas bien alineadas a vos. Usar al clonar el repo, o cuando el dueño dice "configurar", "onboarding", "hacer mía la fábrica", o "actualizar mi perfil".
---

# /pandacorp:onboarding

El **primer paso** al clonar Pandacorp. Convierte una fábrica genérica en *tu* fábrica:
te entrevista y guarda tu perfil en `fabrica/perfil.md`, que el resto de skills y agentes
leen para personalizarse — y muy especialmente para que **`/discover` y `/recommend` te
propongan ideas bien alineadas a vos** (no genéricas).

Se ejecuta EN la raíz de la fábrica. Es **idempotente**: re-correrlo actualiza el perfil
(lee lo que ya hay y solo pregunta lo que falte o lo que quieras cambiar).

## Pasos

1. **Saludo y contexto** (breve). Explica en 2-3 líneas qué es la fábrica: una línea de
   montaje de software 100% IA donde el dueño dirige con gates y los agentes construyen. Di
   por qué entrevistás: para recomendarle ideas alineadas a él, no genéricas. Si ya existe
   `fabrica/perfil.md`, ofrecé actualizarlo en vez de empezar de cero.

2. **Entrevista** (conversacional, en tandas cortas — no un formulario de golpe). Cubrí, y
   **repregunta para aterrizar lo concreto** (las respuestas vagas dan recomendaciones vagas):
   - **Nombre**: cómo querés que la fábrica te llame.
   - **Quién sos / qué hacés**: a qué te dedicás, contexto.
   - **Intereses y hobbies**: temas que te interesan, qué hacés en tu tiempo libre. Estos son
     el "lente" con que la fábrica filtrará ideas.
   - **Gustos y rechazos**: qué te atrae construir y qué evitarías o te aburre.
   - **Objetivos**: la mezcla real — ingresos, herramientas para tu vida, abrir puertas,
     aprender, posicionarte. No asumas que todo es plata.
   - **Activos y palancas**: ¿tenés una audiencia/comunidad, una red de contactos, acceso a
     un nicho, skills o datos particulares? Esto cambia qué vale la pena: una idea de retorno
     monetario modesto puede valer mucho si aprovecha una palanca tuya o te abre puertas.
   - **Apetito de monetización**: alto / medio / bajo / abierto. ¿Buscás plata, o también (o
     sobre todo) valor y oportunidad?
   - **Tipos de proyecto**: ¿qué te interesa? La fábrica está abierta a **cualquier solución
     tecnológica**: app web, app mobile, rework, proyecto/tooling de Claude Code, prompt o
     sistema de prompts, automatización, etc.
   - **GitHub**: usuario/organización donde crear los repos (DR-010 los crea privados por
     defecto). Si no usa GitHub, dejarlo vacío.
   - **Ruta de proyectos**: carpeta donde nacen los proyectos. Por defecto, la hermana de la
     fábrica (vacío = ese default).
   - **Idioma**: documentos y conversación (default español).
   - **Cómo trabajás**: fortalezas y debilidades (p. ej. "débil en diseño").

3. **Escribe el perfil**: copia `fabrica/perfil.example.md` → `fabrica/perfil.md` (si no
   existe) y rellénalo: completa el frontmatter (`nombre`, `github`, `ruta_proyectos`,
   `nivel_tecnico`, `idioma`, `objetivos`, `intereses`, `hobbies`, `gustos`, `disgustos`,
   `activos`, `apetito_monetizacion`, `tipos_proyecto`) y las secciones en prosa con lo
   conversado. **Nunca inventes datos**: lo que no haya dicho, déjalo vacío y decilo.
   `fabrica/perfil.md` es personal (gitignored) — no se sube.

4. **Bootstrap del portfolio**: si no existe `fabrica/portfolio.md`, créalo copiando
   `fabrica/portfolio.example.md`.

5. **Cierra con los siguientes pasos**, personalizados al perfil:
   - Para que la fábrica salga a buscar ideas alineadas a vos: `/pandacorp:discover`.
   - Para capturar una idea propia: `/pandacorp:new-idea` (o `/pandacorp:explore` si es difusa).
   - Para pedir ranking: `/pandacorp:recommend`.
   - El flujo completo está en `CLAUDE.md`.

## Reglas
- **No subir datos personales**: `fabrica/perfil.md` y `fabrica/portfolio.md` son gitignored.
  Si notás que `fabrica/perfil.md` quedó trackeado, avisá (algo está mal en `.gitignore`).
- **No inventes el perfil**: ante la duda, preguntá; lo que no se dijo queda vacío.
- **Aterrizá lo vago**: un perfil concreto (intereses, activos, apetito) es lo que hace que
  `/discover` y `/recommend` acierten. Vale la pena repreguntar.
- Es el único skill pensado para correrse al clonar; el resto asume que ya hay un perfil.
