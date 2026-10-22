// PandaSaga — a fictional spoiler-safe story companion that finished its architecture phase:
// full PRD digest (users, metrics, scope), FRDs tagged UI/Infra, ADRs and a 35-order plan
// that has not started building.
import { frontmatter } from "./common.mjs";
import { relationalModel } from "./models.mjs";
import { planFrd } from "./plan.mjs";

const frds = [
  planFrd({ n: 1, slug: "frd-01-reader-account-progress", en: "Reader account and progress", es: "Cuenta y progreso de lectura", tag: "UI", area: "reader", states: "ttttttttttttt", from: null,
    titles: ["Guest context on first visit", "Email account with magic link", "Merge guest progress into an account", "Progress model per release", "Mark a chapter as read", "Progress bar per work", "Continue-reading shelf", "Reading history page", "Export my progress", "Delete my account", "Session and device list", "Progress sync across devices", "Account smoke and visual baselines"] }),
  planFrd({ n: 2, slug: "frd-02-spoiler-safe-catalog", en: "Spoiler-safe catalog", es: "Catálogo sin spoilers", tag: "Infra", area: "catalog", states: "tttt", from: null, extraDeps: { 0: ["WO-01-004"] },
    titles: ["Catalog bundle format", "Atomic publish of a bundle", "Chapter-bounded visibility filter", "Spoiler report intake"] }),
  planFrd({ n: 3, slug: "frd-03-recap-before-resume", en: "Recap before resuming", es: "Resumen antes de retomar", tag: "UI", area: "recap", states: "ttt", from: null, extraDeps: { 0: ["WO-02-003"] },
    titles: ["Recap generator up to a chapter", "Recap screen with sections", "Chapter summaries in the timeline"] }),
  planFrd({ n: 4, slug: "frd-04-story-encyclopedia", en: "Story encyclopedia", es: "Enciclopedia de la historia", tag: "UI", area: "encyclopedia", states: "ttttt", from: null, extraDeps: { 0: ["WO-02-003"] },
    titles: ["Entry and revision model", "Entry page bounded by progress", "Characters, places and factions index", "Search inside the encyclopedia", "Bookmarks for entries"] }),
  planFrd({ n: 5, slug: "frd-05-connection-map", en: "Connection map", es: "Mapa de conexiones", tag: "UI", area: "connections", states: "tt", from: null, extraDeps: { 0: ["WO-04-001"] },
    titles: ["Connection graph data", "Interactive connection map"] }),
  planFrd({ n: 6, slug: "frd-06-chapter-explorer", en: "Chapter explorer", es: "Explorar capítulos", tag: "UI", area: "chapters", states: "tt", from: null, extraDeps: { 0: ["WO-01-005"] },
    titles: ["Chapter list per release", "Chapter page with what changed"] }),
  planFrd({ n: 7, slug: "frd-07-content-ingestion", en: "Content ingestion", es: "Ingesta de contenido", tag: "Infra", area: "ingestion", states: "tttttt", from: null, extraDeps: { 0: ["WO-02-001"] },
    titles: ["Ingestion source registry", "Ingestion skill entry point", "Draft bundle from a source", "Spoiler boundary checker", "Image credit capture", "Ingestion review report"] }),
];

const specDigest = `${frontmatter([["proyecto", "PandaSaga"], ["fase", "producto"]])}

> Retoma cualquier historia donde la dejaste: un resumen hasta tu capítulo, una enciclopedia que solo muestra lo que ya viste y un mapa de quién es quién, sin un solo spoiler.

## 📋 PRD

### El problema
- **Volver cuesta** — tras semanas sin leer, nadie recuerda quién era quién.
- **Buscar es arriesgado** — cualquier búsqueda en internet trae spoilers del final.
- **Varias versiones** — la misma historia existe en libro, serie y videojuego, con ritmos distintos.
- **Las wikis no esperan** — están escritas para quien ya terminó.

### Hipótesis de valor
Si un lector puede retomar una historia en menos de dos minutos sin toparse con nada que no haya visto, volverá a la app cada vez que retome una saga.

### Usuarios
- **Lector intermitente** — lee por temporadas y necesita recordar antes de seguir.
- **Fan multiformato** — sigue la misma historia en libro y en serie.
- **Curador de contenido** — prepara el catálogo de cada obra con la herramienta de ingesta.

### Métricas de éxito
- **Retomas exitosas** — 70 % de las sesiones que abren un resumen siguen leyendo.
- **Cero spoilers reportados** — menos de 1 reporte por cada 1 000 lecturas de la enciclopedia.
- **Cuentas** — 30 % de los invitados crea cuenta en su segunda visita.
- **Obras activas** — 5 obras completas en el catálogo al lanzar.
- **Tiempo hasta retomar** — mediana menor a 2 minutos.
- **Retención mensual** — 40 % de los lectores vuelve al mes siguiente.

### Alcance v1
- Lectura como invitado
- Cuenta con enlace mágico
- Progreso por capítulo
- Resumen antes de retomar
- Enciclopedia limitada por progreso
- Mapa de conexiones
- Explorador de capítulos
- Catálogo publicado de forma atómica
- Reporte de spoilers
- Herramienta de ingesta para el curador
- Modo oscuro
- Exportar mi progreso
- Borrar mi cuenta
- Cinco obras iniciales
- Imágenes con crédito
- Búsqueda en la enciclopedia
- Marcadores

### Fuera del v1
- Comentarios y comunidad
- Recomendaciones personalizadas
- App nativa
- Audiolibros
- Traducciones automáticas
- Monetización
- Contenido generado por lectores

### Decisiones abiertas
- **Obras iniciales** — ¿qué cinco obras entran al lanzamiento?
- **Ritmo de publicación** — ¿una obra nueva por mes o por temporada?
- **Imágenes** — ¿ilustraciones propias o arte oficial con licencia?
- **Invitados** — ¿cuánto tiempo se guarda el progreso de un invitado?
- **Reportes** — ¿quién revisa un spoiler reportado y en cuánto tiempo?

## 🔬 Research

### Hallazgo clave
Los lectores no buscan "todo sobre la obra": buscan "lo que yo ya sé", y ninguna herramienta actual sabe hasta dónde llegaste.

### El diferenciador
Cada dato del catálogo está atado al capítulo donde aparece; la app solo muestra lo que el lector ya pasó, en cualquier formato de la obra.

### Referentes
- **Wikis de fans** — completas, pero llenas de spoilers.
- **Resúmenes en video** — útiles, pero cubren temporadas enteras.
- **Apps de seguimiento de lectura** — registran el avance, no explican la historia.
- **Guías de personajes impresas** — las mejores, pero solo para libros concretos.
- **Foros de relectura** — muestran la demanda de "recordar sin spoilers".
- **Asistentes de IA genéricos** — responden, pero sin saber dónde vas.
- **Sitios de sinopsis por capítulo** — granularidad correcta, diseño hostil.
- **Bases de datos de series** — buenas fichas, sin límite de progreso.
- **Clubes de lectura** — confirman el hábito de leer por temporadas.

## 🧩 FRDs

### FRD-01 · Cuenta y progreso de lectura · UI
Leer como invitado y guardar el progreso por capítulo.
**Resumen:** el progreso es la base de todo: sin saber dónde vas, la app no puede protegerte de spoilers. Se puede empezar sin cuenta y crearla después sin perder nada.
**Historias de usuario:**
- Como lector quiero marcar el capítulo donde quedé con un toque.
- Como invitado quiero crear una cuenta sin perder lo que ya marqué.
- Como fan multiformato quiero llevar el progreso del libro y de la serie por separado.
- Como lector quiero borrar mi cuenta y todo mi progreso.
**Reglas de negocio:**
- El progreso nunca retrocede salvo que el lector lo pida.
- Un invitado conserva su progreso en el dispositivo durante 90 días.
- Fusionar un invitado con una cuenta conserva el capítulo más avanzado.
- Borrar la cuenta elimina el progreso en menos de 24 horas.
- Cada obra lleva su progreso por versión (libro, serie, juego).
- Marcar un capítulo es reversible durante 10 segundos.
- El estado de sesión se guarda en una cookie segura.
- No se piden datos personales más allá del correo.
- Exportar mi progreso entrega un archivo legible.
- Una cuenta nueva empieza sin obras en la estantería.
- La estantería muestra primero la obra retomada más recientemente.
- La sincronización entre dispositivos ocurre al abrir la app.
- Los errores de red no pierden la última marca.
- Los invitados no pueden reportar spoilers.
- Las cuentas inactivas por un año reciben un aviso antes de borrarse.
**Fuera de alcance:**
- Inicio con redes sociales.
- Perfiles públicos.
**Preguntas abiertas:**
- ¿El progreso de invitado se puede pasar a otro dispositivo con un código?

### FRD-02 · Catálogo sin spoilers · Infra
El formato y la publicación del catálogo de cada obra, con cada dato atado a su capítulo.
**Resumen:** el catálogo se publica como un paquete versionado y atómico; nada se muestra si su capítulo es posterior al del lector.
**Historias de usuario:**
- Como curador quiero publicar una obra entera de una vez, sin estados a medias.
- Como lector quiero reportar un spoiler con un toque.
**Reglas de negocio:**
- Un paquete se publica completo o no se publica.
- Todo dato sin capítulo de aparición se rechaza en la publicación.
- La visibilidad se calcula en el servidor, nunca en el navegador.
- Un reporte de spoiler oculta el dato hasta su revisión.
- Las versiones anteriores del paquete se conservan 30 días.
- El catálogo se sirve con caché por obra y capítulo.
- Las imágenes llevan su crédito en el mismo paquete.
- Una obra puede tener varias versiones con capítulos distintos.
- El paquete se valida contra su esquema antes de publicarse.
- La publicación deja un registro de auditoría.
- El curador puede retirar una obra sin borrar el progreso de los lectores.
**Fuera de alcance:**
- Edición del catálogo desde la web.
- Contenido aportado por lectores.
- Publicación programada.
**Preguntas abiertas:**
- ¿Cuánto tarda en propagarse una corrección del catálogo?

### FRD-03 · Resumen antes de retomar · UI
Un resumen breve de lo ocurrido hasta el capítulo del lector.
**Resumen:** la pantalla que justifica la app: en dos minutos sabes dónde estabas.
**Historias de usuario:**
- Como lector intermitente quiero un resumen hasta mi capítulo antes de seguir.
- Como lector quiero saltar a los personajes que reaparecen en el siguiente capítulo.
- Como lector quiero elegir un resumen corto o largo.
- Como fan multiformato quiero el resumen de la versión que estoy siguiendo.
**Reglas de negocio:**
- El resumen nunca incluye nada posterior al capítulo del lector.
- Cada sección del resumen enlaza a su entrada de la enciclopedia.
- El resumen corto cabe en una pantalla de teléfono.
- Los resúmenes se generan al publicar el paquete, no al pedirlos.
- Si no hay resumen para ese capítulo, se ofrece el anterior más cercano.
- El resumen indica a qué capítulo corresponde.
- Las imágenes del resumen llevan su crédito.
**Fuera de alcance:**
- Resúmenes en audio.
**Preguntas abiertas:**
- ¿Cuántas secciones como máximo tiene un resumen largo?

### FRD-04 · Enciclopedia de la historia · UI
Fichas de personajes, lugares y facciones que solo dicen lo que el lector ya vio.
**Resumen:** cada ficha tiene revisiones por capítulo; el lector ve la última revisión que le corresponde.
**Historias de usuario:**
- Como lector quiero consultar quién es un personaje sin enterarme de su destino.
- Como lector quiero buscar dentro de la enciclopedia.
- Como lector quiero guardar fichas para volver a ellas.
**Reglas de negocio:**
- Una ficha muestra solo la revisión visible para el capítulo del lector.
- La búsqueda no sugiere fichas que el lector todavía no conoce.
- Los marcadores sobreviven a los cambios de revisión.
- Una ficha indica "hay más después de tu capítulo" sin decir qué.
- Las fichas de una obra no aparecen en otra.
- El índice se ordena por primera aparición.
- Las fichas sin revisión visible no existen para el lector.
- Las imágenes de una ficha también respetan el capítulo.
- Los enlaces entre fichas se ocultan si el destino no es visible.
**Fuera de alcance:**
- Edición colaborativa de fichas.
**Preguntas abiertas:**
- ¿Mostramos el número de capítulo de cada revisión?

### FRD-05 · Mapa de conexiones · UI
Un mapa interactivo de quién se relaciona con quién, hasta el capítulo del lector.
**Resumen:** la vista que más piden los fans: las relaciones aparecen a medida que se revelan.
**Historias de usuario:**
- Como lector quiero ver las relaciones de un personaje en un mapa.
- Como lector quiero filtrar el mapa por tipo de relación.
**Reglas de negocio:**
- Una conexión aparece solo desde el capítulo que la revela.
- El mapa funciona también como lista en el teléfono.
- Cada conexión lleva su tipo como texto, no solo como color.
- El mapa se puede recorrer con teclado.
- Las conexiones ocultas no dejan huecos que delaten su existencia.
- El mapa se centra en el personaje elegido.
**Fuera de alcance:**
- Exportar el mapa como imagen.
**Preguntas abiertas:**
- ¿Cuántos nodos se muestran antes de agrupar?

### FRD-06 · Explorar capítulos · UI
La lista de capítulos de cada versión y qué cambia en cada uno.
**Resumen:** sirve para ubicarse y para marcar el progreso exacto.
**Historias de usuario:**
- Como lector quiero ver la lista de capítulos y marcar dónde voy.
- Como lector quiero ver qué personajes aparecen por primera vez en un capítulo ya leído.
- Como fan multiformato quiero cambiar de versión sin perder mi lugar.
**Reglas de negocio:**
- Los capítulos no leídos solo muestran su número y título.
- Cambiar de versión conserva el progreso de cada una.
- El capítulo actual siempre está a la vista al abrir la lista.
- Los títulos de capítulos con spoiler se ocultan hasta leerlos.
- La lista carga por partes en obras con muchos capítulos.
**Fuera de alcance:**
- Lectura del texto completo dentro de la app.
- Notas personales por capítulo.
**Preguntas abiertas:**
- ¿Hace falta una vista por temporada en las series?`;

const archDigest = `${frontmatter([["proyecto", "PandaSaga"], ["fase", "arquitectura"], ["stack", "Next.js · React · PostgreSQL serverless · paquetes de catálogo versionados · herramienta de ingesta"], ["coste", "$0/mes"], ["host", "Hosting web gratuito + PostgreSQL serverless"]])}

> Una web que sabe hasta qué capítulo vas: el catálogo se publica como paquetes versionados y el servidor filtra cada respuesta por el progreso del lector.

## 🧱 Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Web y UI | Next.js (App Router) · React | Render en el servidor para filtrar spoilers antes de enviar nada. |
| Estilos | Tailwind v4 con tokens | Claro y oscuro desde el diseño aprobado. |
| Datos | PostgreSQL serverless | Gratis en el volumen inicial; ramas por entorno. |
| ORM | Drizzle | Migraciones aditivas y tipos compartidos. |
| Autenticación | Enlace mágico + contexto de invitado | Leer sin cuenta y crearla después. |
| Catálogo | Paquetes JSON versionados | Publicación atómica, fácil de revisar en un PR. |
| Visibilidad | Filtro en el servidor por capítulo | El navegador nunca recibe lo que no debe ver. |
| Caché | Por obra y capítulo | El mismo capítulo comparte respuesta entre lectores. |
| Mapa | Librería de grafos con vista de lista | Usable en el teléfono y con teclado. |
| Imágenes | Optimización del framework | Créditos en el mismo paquete. |
| Ingesta | Skill de la fábrica | El curador prepara el paquete con ayuda de un agente. |
| Errores | Rastreo de errores | Alertas de publicación fallida. |
| Analítica | Plan de eventos mínimo | Retomas y reportes de spoiler. |
| Pruebas | Vitest · Playwright | Pruebas de no-spoiler en cada FRD. |
| CI | Integración continua del repositorio | Valida cada paquete contra su esquema. |
| Despliegue | Hosting web gratuito | Previews por rama. |

## 🗄️ Modelo de datos

Todo dato visible está atado al capítulo donde aparece; el progreso del lector decide qué revisión se muestra.

- **Lectores** — cuentas, contextos de invitado y progreso por versión.
- **Obras** — obras, versiones, capítulos y resúmenes por capítulo.
- **Enciclopedia** — fichas con revisiones visibles desde un capítulo.
- **Conexiones** — relaciones entre fichas reveladas en un capítulo.
- **Resúmenes** — resúmenes hasta un capítulo, por secciones.
- **Publicación** — paquetes versionados y corridas de publicación.
- **Ingesta** — fuentes y trabajos de la herramienta del curador.
- **Seguridad** — reportes de spoiler, marcadores y auditoría.
- **Imágenes** — arte con su crédito.
- **Interruptores** — banderas del servidor.
- **Medios** — libro, serie, película o juego.
- **Tipos de conexión** — aliado, rival, familia…
- **Invitados fusionados** — el rastro de cada fusión.
- **Marcadores** — fichas guardadas por cada lector.

## 🔌 Comunicación & servicios

- **Web** — páginas renderizadas en el servidor con el filtro de capítulo.
- **Base de datos** — PostgreSQL serverless con rama de desarrollo y de producción.
- **Catálogo** — paquetes en el repositorio, publicados por la integración continua.
- **Imágenes** — optimizadas por el framework, con su crédito.
- **Correo** — enlaces de acceso.
- **Errores** — rastreo de errores en web y publicación.
- **CI** — valida esquema y límites de spoiler en cada paquete.
- **Ingesta** — una skill que el curador corre en local.
- **Dominio** — subdominio con DNS gestionado.

## 🧩 Por FRD

${frds.map((f) => `### FRD-${String(f.n).padStart(2, "0")} · ${f.es}
**Blueprint:** ${f.tag === "Infra" ? "proceso fuera de la web con validación de esquema y registro de auditoría" : "rutas del servidor que reciben el progreso del lector y solo devuelven lo visible"}.
**Work orders:**
${f.wos.map((w) => `- **${w.id}** — ${w.title}`).join("\n")}`).join("\n\n")}`;

const adrs = [
  { n: 1, slug: "platform-stack", date: "2026-10-15", title: "Platform stack on the golden path", context: "The product is a read-heavy web app with a small write surface.", decision: "Next.js App Router with Drizzle on serverless PostgreSQL; previews per branch." },
  { n: 2, slug: "guest-contexts-and-auth", date: "2026-10-15", title: "Guest contexts merged into magic-link accounts", context: "Readers should start without an account.", decision: "A device-bound guest context stores progress; signing in merges it, keeping the furthest chapter." },
  { n: 3, slug: "catalog-bundles-atomic-publish", date: "2026-10-15", title: "Catalog as versioned bundles with atomic publish", context: "Half-published works would leak or hide content inconsistently.", decision: "A bundle is validated and published in one transaction; previous versions are kept 30 days." },
  { n: 4, slug: "image-delivery", date: "2026-10-15", title: "Images delivered by the framework optimiser", context: "Cover art and portraits must stay light on phones.", decision: "Use the framework image component; credits travel inside the bundle." },
  { n: 5, slug: "deployment-and-ci", date: "2026-10-16", title: "Deployment and CI", context: "Bundles must be checked before they reach readers.", decision: "CI validates bundle schema and spoiler boundaries; the free hosting tier deploys previews per branch." },
  { n: 6, slug: "connection-map-rendering", date: "2026-10-16", title: "Connection map with a list fallback", context: "Graphs are hard to use on phones and with a keyboard.", decision: "Render an interactive map on wide screens and an equivalent list below 768 px." },
  { n: 7, slug: "reader-scoped-rendering", date: "2026-10-16", title: "Reader-scoped rendering and caching", context: "Filtering in the browser would send spoilers over the wire.", decision: "Filter on the server by chapter; cache responses per work and chapter, never per reader." },
  { n: 8, slug: "ingestion-skill", date: "2026-10-16", title: "Catalog ingestion as a factory skill", context: "Preparing a work is careful editorial work.", decision: "A local skill drafts the bundle from approved sources and a checker flags anything without a chapter." },
];

const docs = {
  "docs/product/prd.md": `# PRD — PandaSaga

## Problem

Returning to a long story after weeks away is hard, and searching for a reminder almost always spoils the ending. The [research](research.md) explains why existing wikis do not help.

## Users

- Intermittent reader, multi-format fan, content curator.

## Success metrics

| Metric | Target |
|---|---|
| Sessions that open a recap and keep reading | 70 % |
| Spoiler reports per 1,000 encyclopedia reads | < 1 |
| Guests who create an account on their second visit | 30 % |

## Scope

Guest reading, magic-link accounts, chapter progress, recaps, a chapter-bounded encyclopedia, a connection map and a chapter explorer, fed by versioned catalog bundles.`,
  "docs/product/research.md": `# Research — PandaSaga

Readers do not want everything about a work; they want what they already know. No current tool knows how far a reader has got. Fan wikis are written for people who finished; recap videos cover whole seasons.`,
  "docs/product/architecture.md": `# Platform architecture — PandaSaga

Server-rendered pages receive the reader's progress and return only what is visible at that chapter. The catalog is a set of versioned bundles published atomically by CI. The logical model is published in [data-model.json](data-model.json).`,
  "docs/decision-log.md": `# Decision log — PandaSaga

- **2026-10-17** — Architecture approved with 35 work orders across 7 FRDs.
- **2026-10-16** — Connection map gets a list fallback on phones (ADR-0006).
- **2026-10-15** — Catalog bundles published atomically (ADR-0003).`,
  "DESIGN.md": `# Design — PandaSaga

A quiet reading room: warm paper tones in light mode, ink blue in dark mode. Spoiler boundaries are always visible as a thin "you are here" line.`,
  "docs/design/components.md": `# Component inventory — PandaSaga

| Component | Notes |
|---|---|
| ProgressMarker | the "you are here" line |
| EntryCard | entry with its visible revision |
| RecapSection | one recap paragraph with links |
| ConnectionMap | graph with a list fallback |`,
  "docs/design/microcopy.md": `# Microcopy — PandaSaga

- Empty shelf: "Todavía no retomaste ninguna historia."
- Hidden content: "Hay más después de tu capítulo."`,
  "docs/analytics/events.md": `# Event plan — PandaSaga

\`recap_opened\`, \`chapter_marked\`, \`spoiler_reported\`, \`guest_converted\`.`,
  "docs/reviews/architecture-readiness.md": `# Architecture readiness review

Verdict: ready. Every FRD has a blueprint, every work order names its requirements, and the data model matches the blueprints.`,
};

export const pandasaga = {
  id: "pandasaga",
  srcRoot: "src/app",
  plannedOn: "2026-10-17",
  frds,
  status: `# Machine-readable status for PandaSaga.
project: "PandaSaga"
phase: architecture
version: v1
overlay_version: "8.98.0"
created_with: "8.90.0"
target_platforms: responsive
running: false
updated_at: "2026-10-17T03:30:00Z"
repo: ""
last_green_sha: ""
safe_to_test: false
rethink_pending: false
advance_pending: false
`,
  specDigest,
  archDigest,
  changes: [{ id: "catalog-bundle-credits", type: "change", status: "done", date: "2026-10-16", frd: "frd-02-spoiler-safe-catalog", title: "Incluir los créditos de imagen dentro del paquete", what: "Los créditos vivían en un archivo aparte y se desincronizaban.", sha: "5b1e0c73" }],
  services: {
    schema_version: 1, project_id: "pandasaga", resource_slug: "pandasaga",
    services: {
      web: { provider_id: "vercel", account_ref: "vercel-main", status: "proposed", environments: { preview: { resource_name: "pandasaga-preview" }, prod: { resource_name: "pandasaga" } } },
      database: { provider_id: "neon", account_ref: "neon-main", status: "proposed", environments: { dev: { resource_name: "pandasaga / dev" }, prod: { resource_name: "pandasaga / prod" } } },
      dns: { provider_id: "cloudflare", account_ref: "cloudflare-main", status: "proposed", environments: { prod: { resource_name: "saga.example.com" } } },
      errors: { provider_id: "sentry", account_ref: "sentry-main", status: "proposed", environments: { prod: { resource_name: "pandasaga-web" } } },
      ci: { provider_id: "github", account_ref: "github-main", status: "proposed", environments: { prod: { resource_name: "example-org/pandasaga" } } },
    },
  },
  env: `# --- Base de datos --- Cadena con pooling para la web.
DATABASE_URL=
# Conexión directa para migraciones.
DATABASE_URL_UNPOOLED=

# --- Autenticación --- Secreto que firma las sesiones.
AUTH_SECRET=
# URL pública de los enlaces mágicos.
AUTH_URL=
# Días que se guarda el progreso de un invitado.
GUEST_CONTEXT_TTL_DAYS=

# --- Correo --- Clave del servicio transaccional.
EMAIL_API_KEY=
# Remitente de los enlaces de acceso.
EMAIL_FROM=

# --- Catálogo --- Carpeta de los paquetes publicados.
CATALOG_BUNDLES_DIR=
# Días que se conservan las versiones anteriores.
CATALOG_RETENTION_DAYS=

# --- Errores --- DSN del rastreo de errores.
ERRORS_DSN=
# Entorno reportado con cada error.
ERRORS_ENVIRONMENT=

# --- Aplicación --- URL pública de la web.
APP_URL=
# Idioma por defecto.
APP_DEFAULT_LOCALE=
`,
  adrs,
  docs,
  model: relationalModel("saga"),
};
