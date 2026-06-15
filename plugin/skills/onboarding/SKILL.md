---
description: Configura la fábrica Pandacorp para un dueño nuevo (primer arranque tras clonar el repo). Te entrevista —nombre, objetivos, cuenta de GitHub, dónde nacen los proyectos, cómo trabajás— y guarda tu perfil en fabrica/perfil.md (personal, gitignored), que toda la fábrica lee para personalizarse. Usar al clonar el repo, o cuando el dueño dice "configurar", "onboarding", "hacer mía la fábrica", o "empezar de cero".
---

# /pandacorp:onboarding

El **primer paso** al clonar Pandacorp. Convierte una fábrica genérica en *tu* fábrica:
te entrevista y guarda tu perfil en `fabrica/perfil.md`, que el resto de skills y agentes
leen para personalizar la operación (cómo llamarte, a qué cuenta de GitHub crear repos, dónde
nacen los proyectos, y con qué objetivos filtrar ideas).

Se ejecuta EN la raíz de la fábrica. Es **idempotente**: re-correrlo actualiza el perfil
(lee lo que ya hay y solo pregunta lo que falte o lo que quieras cambiar).

## Pasos

1. **Saludo y contexto** (breve). Explica en 2-3 líneas qué es la fábrica: una línea de
   montaje de software 100% IA donde el dueño dirige con gates y los agentes construyen. Si ya
   existe `fabrica/perfil.md`, dilo y ofrecé actualizarlo en vez de empezar de cero.

2. **Entrevista** (conversacional, en tandas cortas — no un formulario de 10 preguntas de
   golpe). Cubrí:
   - **Nombre**: cómo querés que la fábrica te llame.
   - **Objetivos**: ¿qué querés construir? Apps que generen ingresos, herramientas para tu
     propia vida, o ambas. Empujá hacia lo concreto — esto define el "lente" con que `/explore`
     y `/recommend` filtran ideas.
   - **Cómo trabajás**: fortalezas y debilidades (p. ej. "débil en diseño"). Sirve para que los
     agentes compensen.
   - **GitHub**: usuario/organización donde crear los repos de proyectos (DR-010 los crea
     privados por defecto). Si no usa GitHub, dejarlo vacío.
   - **Ruta de proyectos**: carpeta donde nacen los proyectos. Por defecto, la carpeta **hermana**
     de la fábrica (vacío = ese default). Confirmá o pedí una ruta.
   - **Idioma**: idioma de documentos y conversación (default español).

3. **Escribe el perfil**: copia `fabrica/perfil.example.md` → `fabrica/perfil.md` (si no existe)
   y rellénalo: completa el frontmatter (`nombre`, `github`, `ruta_proyectos`, `nivel_tecnico`,
   `idioma`, `objetivos`) y las secciones en prosa con lo conversado. **Nunca inventes datos**:
   lo que no haya dicho, déjalo vacío. `fabrica/perfil.md` es personal (gitignored) — no se sube.

4. **Bootstrap del portfolio**: si no existe `fabrica/portfolio.md`, créalo copiando
   `fabrica/portfolio.example.md`. (Ya trae la fila del cockpit, la interfaz de la fábrica.)

5. **Verifica el plugin** (opcional, si `claude` está disponible): recordá que el plugin se
   instala desde el marketplace local con `claude plugin install pandacorp@panda-corp`. Si ya
   está instalado, no hagas nada.

6. **Cierra con los siguientes pasos**, personalizados al perfil:
   - Para arrancar el cockpit (interfaz visual): ver `cockpit/PLAN.md`.
   - Para capturar una idea: `/pandacorp:new-idea` (o `/pandacorp:explore` si todavía es difusa).
   - Para buscar oportunidades en internet: `/pandacorp:discover`.
   - El flujo completo está en `CLAUDE.md` (tabla de operación).

## Reglas
- **No subir datos personales**: `fabrica/perfil.md` y `fabrica/portfolio.md` son gitignored.
  Si notás que `fabrica/perfil.md` quedó trackeado, avisá (algo está mal en `.gitignore`).
- **No inventes el perfil**: ante la duda, preguntá; lo que no se dijo queda vacío.
- Es el único skill pensado para correrse al clonar; el resto asume que ya hay un perfil.
