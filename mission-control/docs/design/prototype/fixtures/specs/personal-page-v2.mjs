// PersonalPage v2 — a fictional developer portfolio already launched (release phase, ~76 %),
// with pending owner decisions (one already marked solved in the file), a change queue with
// building, draft and archived items, and one change file whose frontmatter is malformed.
import { frontmatter } from "./common.mjs";
import { NO_DATABASE } from "./models.mjs";
import { planFrd } from "./plan.mjs";

const T = (s) => Date.parse(s);

const frds = [
  planFrd({ n: 1, slug: "frd-01-site-shell-i18n", en: "Site shell, languages and themes", es: "Estructura, idiomas y temas", tag: "UI", area: "shell", states: "dddd", from: T("2026-06-30T20:08:00Z"), every: 26, review: { verdict: "pass" },
    titles: ["Layout shell with skip link", "Two-language routing", "Light and dark themes without flash", "Shared header and footer"] }),
  planFrd({ n: 2, slug: "frd-02-home-positioning", en: "Home and positioning", es: "Inicio y posicionamiento", tag: "UI", area: "home", states: "d", from: T("2026-06-30T22:04:00Z"), every: 30, extraDeps: { 0: ["WO-01-004"] },
    titles: ["Home hero and proof strip"] }),
  planFrd({ n: 3, slug: "frd-03-case-studies", en: "Projects and case studies", es: "Proyectos y casos", tag: "UI", area: "projects", states: "dtt", from: T("2026-06-30T22:47:00Z"), every: 30, review: { verdict: "pass" }, extraDeps: { 0: ["WO-01-004"] },
    titles: ["Project index from content files", "Case study template", "Case study image gallery"] }),
  planFrd({ n: 4, slug: "frd-04-about-now", en: "About and now", es: "Sobre mí y ahora", tag: "UI", area: "about", states: "d", from: T("2026-07-01T00:09:00Z"), every: 30,
    titles: ["About and now pages"] }),
  planFrd({ n: 5, slug: "frd-05-blog-mdx", en: "Blog in MDX", es: "Blog en MDX", tag: "UI", area: "blog", states: "ddt", from: T("2026-07-01T00:50:00Z"), every: 28, review: { verdict: "pass" },
    titles: ["Content collection for posts", "Post page with reading time", "Tag pages and RSS feed"] }),
  planFrd({ n: 6, slug: "frd-06-seo-structured-data", en: "SEO and structured data", es: "SEO y datos estructurados", tag: "Infra", area: "seo", states: "dtt", from: T("2026-07-01T04:24:00Z"), every: 30,
    titles: ["Metadata and canonical URLs", "Open Graph images at build time", "Structured data for articles"] }),
  planFrd({ n: 7, slug: "frd-07-contact", en: "Contact", es: "Contacto", tag: "UI", area: "contact", states: "d", from: T("2026-07-01T01:47:00Z"), every: 30,
    titles: ["Contact form with a hosted form service"] }),
  planFrd({ n: 8, slug: "frd-08-blog-writer-skill", en: "Blog writer skill", es: "Skill para escribir el blog", tag: "Tool", area: "writer", states: "ddddddddt", from: T("2026-07-01T02:09:00Z"), every: 14,
    titles: ["Skill entry point and prompts", "Topic intake from notes", "Outline draft", "Draft in the house voice", "Fact and link checker", "Bilingual pass", "Front matter and slug", "Cover image brief", "Editorial review checklist"] }),
];

const specDigest = `${frontmatter([["proyecto", "PersonalPage v2"], ["fase", "producto"]])}

> Un portafolio personal que en diez segundos deja claro qué construye este desarrollador, para quién y con qué resultados.

## 📋 PRD

### El problema
- **El portafolio viejo no dice nada** — una lista de tecnologías sin contexto.
- **Los casos no se cuentan** — no hay forma de mostrar el problema, la decisión y el resultado.
- **Un solo idioma** — la mitad de los contactos llega en otro idioma.
- **El blog está abandonado** — escribir cuesta y se posterga.

### Hipótesis de valor
Si cada proyecto se cuenta como un caso con resultado medible, los contactos llegan ya sabiendo qué pedir.

### Usuarios
- **Responsable de contratación** — revisa en dos minutos si el perfil encaja.
- **Cliente potencial** — busca alguien que ya resolvió un problema parecido.
- **El propio autor** — quiere publicar sin fricción.

### Métricas de éxito
- **Contactos calificados** — 4 por mes.
- **Tiempo en casos** — más de 90 segundos por visita a un caso.
- **Publicaciones** — 2 entradas por mes.
- **Rendimiento** — Lighthouse por encima de 95 en el teléfono.
- **Idiomas** — 100 % de las páginas en los dos idiomas.

### Alcance v1
- Estructura con dos idiomas
- Temas claro y oscuro
- Inicio con propuesta clara
- Índice de proyectos
- Casos de estudio
- Sobre mí y ahora
- Blog en MDX
- SEO y datos estructurados
- Formulario de contacto
- Skill para escribir el blog

### Fuera del v1
- Comentarios
- Boletín por correo
- Tienda
- Panel de administración
- Analítica propia
- Búsqueda en el sitio
- Modo sin conexión
- Traducción automática

### Decisiones abiertas
- **Dominio** — ¿se mantiene el dominio actual?
- **Fotos** — ¿retrato profesional o ilustración?
- **Tono** — ¿primera persona en los casos?
- **Formulario** — ¿servicio alojado o función propia?
- **Blog** — ¿cuántas entradas antes de lanzar?

## 🔬 Research

### Hallazgo clave
Los responsables de contratación leen el primer párrafo de un caso y saltan al resultado; si no hay número, siguen de largo.

### El diferenciador
Cada caso responde tres preguntas en orden: qué estaba roto, qué se decidió y qué cambió.

### Referentes
- **Portafolios de estudios pequeños** — casos cortos con un resultado destacado.
- **Blogs de ingeniería** — buena estructura, demasiado largos para un portafolio.
- **Perfiles profesionales** — alcance amplio, cero profundidad.
- **Sitios de una sola página** — rápidos, sin espacio para casos.
- **Plantillas populares** — bonitas e intercambiables.

## 🧩 FRDs

### FRD-01 · Estructura, idiomas y temas · UI
La base del sitio en dos idiomas, con temas sin parpadeo.
**Resumen:** todo el sitio comparte una estructura accesible y rápida.
**Historias de usuario:**
- Como visitante quiero cambiar de idioma sin perder la página.
- Como visitante quiero que el tema oscuro no parpadee al cargar.
- Como visitante con teclado quiero saltar al contenido.
**Reglas de negocio:**
- Cada página existe en los dos idiomas.
- El tema respeta la preferencia del sistema.
- El enlace para saltar al contenido es lo primero enfocable.
**Fuera de alcance:**
- Más de dos idiomas.
- Temas personalizados.
**Preguntas abiertas:**
- ¿La URL lleva el idioma como prefijo?

### FRD-02 · Inicio y posicionamiento · UI
La primera pantalla que explica qué hace el autor.
**Resumen:** una frase, tres pruebas y un llamado a la acción.
**Historias de usuario:**
- Como responsable de contratación quiero entender el perfil en diez segundos.
- Como cliente quiero ver resultados antes de seguir leyendo.
- Como visitante quiero llegar al contacto en un clic.
**Reglas de negocio:**
- La propuesta cabe en una línea en el teléfono.
- Las pruebas enlazan a sus casos.
- El inicio carga en menos de un segundo.
**Fuera de alcance:**
- Animaciones de entrada.
- Testimonios en video.
**Preguntas abiertas:**
- ¿Cuántas pruebas se muestran?

### FRD-03 · Proyectos y casos · UI
Índice de proyectos y casos contados en tres actos.
**Resumen:** el corazón del portafolio: problema, decisión y resultado.
**Historias de usuario:**
- Como cliente quiero filtrar proyectos por tipo de problema.
- Como responsable de contratación quiero leer el resultado primero.
- Como visitante quiero ver imágenes del proyecto en grande.
**Reglas de negocio:**
- Cada caso declara un resultado medible.
- Las imágenes llevan texto alternativo.
- Los casos se escriben en archivos de contenido.
**Fuera de alcance:**
- Casos privados con contraseña.
- Descarga en PDF.
**Preguntas abiertas:**
- ¿Hace falta un filtro por tecnología?

### FRD-04 · Sobre mí y ahora · UI
Quién es el autor y en qué está trabajando este mes.
**Resumen:** dos páginas cortas que humanizan el portafolio.
**Historias de usuario:**
- Como visitante quiero saber en qué trabaja el autor ahora.
- Como cliente quiero saber si tiene disponibilidad.
- Como responsable de contratación quiero un resumen de su trayectoria.
**Reglas de negocio:**
- La página "ahora" muestra su fecha de actualización.
- La disponibilidad se indica en texto, no solo con color.
- La trayectoria cabe en una pantalla.
**Fuera de alcance:**
- Currículum descargable.
- Línea de tiempo interactiva.
**Preguntas abiertas:**
- ¿Cada cuánto se actualiza "ahora"?

### FRD-05 · Blog en MDX · UI
Entradas en MDX con etiquetas y feed.
**Resumen:** escribir una entrada es crear un archivo; el sitio hace el resto.
**Historias de usuario:**
- Como lector quiero ver el tiempo de lectura.
- Como lector quiero suscribirme por RSS.
- Como autor quiero publicar con un archivo nuevo.
**Reglas de negocio:**
- Cada entrada declara idioma, fecha y etiquetas.
- El feed incluye las últimas 20 entradas.
- Una entrada sin traducción muestra un aviso.
- Las imágenes de portada llevan texto alternativo.
**Fuera de alcance:**
- Comentarios.
- Búsqueda en el blog.
**Preguntas abiertas:**
- ¿Las etiquetas se traducen?

### FRD-06 · SEO y datos estructurados · Infra
Metadatos, imágenes para redes y datos estructurados.
**Resumen:** que cada página se vea bien al compartirla y en los buscadores.
**Historias de usuario:**
- Como autor quiero que cada entrada tenga su imagen para redes.
- Como visitante quiero una vista previa clara al pegar un enlace.
- Como autor quiero que los buscadores entiendan mis artículos.
**Reglas de negocio:**
- Cada página declara su URL canónica.
- Las imágenes para redes se generan al construir el sitio.
- Los datos estructurados se validan en la integración continua.
- Las páginas en los dos idiomas se enlazan entre sí.
**Fuera de alcance:**
- Mapas del sitio por idioma separados.
- Herramientas de posicionamiento de pago.
**Preguntas abiertas:**
- ¿Qué tipos de datos estructurados entran en el v1?

### FRD-07 · Contacto · UI
Un formulario simple con un servicio alojado.
**Resumen:** escribir al autor sin exponer su correo.
**Historias de usuario:**
- Como cliente quiero escribir sin abrir mi correo.
- Como visitante quiero saber cuándo recibiré respuesta.
- Como autor quiero recibir los mensajes sin spam.
**Reglas de negocio:**
- El formulario funciona antes de cargar JavaScript.
- Los errores se muestran junto a cada campo.
- Se confirma el envío con un mensaje claro.
- El servicio alojado filtra el spam.
**Fuera de alcance:**
- Agenda de reuniones.
- Chat en vivo.
**Preguntas abiertas:**
- ¿Hace falta una casilla de consentimiento?

### FRD-08 · Skill para escribir el blog · Tool
Una skill que convierte notas en un borrador en la voz del autor.
**Resumen:** baja el costo de escribir: de notas sueltas a un borrador revisable.
**Historias de usuario:**
- Como autor quiero pasar mis notas y recibir un esquema.
- Como autor quiero un borrador en los dos idiomas.
- Como autor quiero que se revisen enlaces y datos.
**Reglas de negocio:**
- La skill nunca publica sola; deja un borrador.
- Todo dato del borrador enlaza a su fuente.
- La voz sigue la guía de estilo del autor.
- El borrador marca lo que necesita revisión humana.
- La skill registra cada borrador generado.
**Fuera de alcance:**
- Publicación automática.
- Imágenes generadas.
**Preguntas abiertas:**
- ¿La skill propone títulos o los deja al autor?`;

const archDigest = `${frontmatter([["proyecto", "personal-page-v2"], ["fase", "arquitectura"], ["stack", "Next.js · MDX · contenido en el repositorio · imágenes para redes al construir"], ["coste", "$0/mes"], ["host", "Hosting web gratuito"]])}

> Un sitio estático en lo posible: el contenido vive en el repositorio y el sitio se reconstruye en cada cambio.

## 🧱 Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Web y UI | Next.js (App Router) | Páginas estáticas con rutas por idioma. |
| Contenido | MDX en el repositorio | Escribir es crear un archivo. |
| Colecciones | Validación de contenido al construir | Un archivo mal formado rompe el build, no el sitio. |
| Estilos | Tailwind v4 con tokens | Claro y oscuro sin parpadeo. |
| Idiomas | Rutas con prefijo de idioma | Dos idiomas desde el día uno. |
| Imágenes | Optimización del framework | Rápidas en el teléfono. |
| Imágenes para redes | Generadas al construir | Sin servidor que las sirva. |
| Formulario | Servicio alojado | Sin backend propio. |
| SEO | Metadatos y datos estructurados | Validados en la integración continua. |
| Pruebas | Vitest · Playwright | Recorridos de idioma y contacto. |
| CI | Integración continua del repositorio | Gate completo en cada cambio. |
| Despliegue | Hosting web gratuito | Previews por rama. |

## 🗄️ Modelo de datos

Sin base de datos: el contenido es código y vive en el repositorio.

- **Casos** — archivos MDX con problema, decisión y resultado.
- **Entradas** — archivos MDX con idioma, fecha y etiquetas.
- **Páginas** — sobre mí y ahora, una por idioma.
- **Etiquetas** — derivadas de las entradas al construir.
- **Configuración** — datos del sitio en un archivo tipado.

## 🔌 Comunicación & servicios

- **Hosting** — sitio estático con previews por rama.
- **Formulario** — servicio alojado que reenvía los mensajes.
- **CI** — gate completo y validación de datos estructurados.

## 🧩 Por FRD

${frds.map((f) => `### FRD-${String(f.n).padStart(2, "0")} · ${f.en}
**Blueprint:** ${f.tag === "Tool" ? "una skill local con sus prompts y una lista de revisión" : "páginas estáticas alimentadas por las colecciones de contenido"}.
**Work orders:**
${f.wos.map((w) => `- **${w.id}** — ${w.title}`).join("\n")}`).join("\n\n")}`;

const decisions = `# Decisiones pendientes — bandeja del owner

Cada bloque es una pregunta para ti; el motor no avanza ese punto hasta que respondas.

## 2026-09-10 · Textos del inicio y de "sobre mí" — 2 de 4 ajustes listos, faltan 2

**Contexto:** una persona que revisó el sitio pidió cuatro ajustes de texto. El motor ya aplicó dos (la frase del inicio y el orden de las pruebas). Los otros dos cambian cómo te presentas y necesitan tu voz: el primer párrafo de "sobre mí" y el texto del botón de contacto.

**Qué necesito de ti:** elige una de las dos versiones propuestas para cada texto, o escribe la tuya.

- **Estado:** PENDIENTE
- **Recomendación:** la versión B del párrafo de "sobre mí" (más corta) y dejar el botón como está.

## 2026-07-01 · FRD-07 Contacto · falta la clave pública del servicio de formularios (necesita tu acción)

**Estado:** ✅ RESUELTO el 2026-07-03 — la clave quedó en el entorno de producción y el formulario envía bien.

**Contexto:** el gate rechazaba el recorrido de contacto porque la variable pública del servicio de formularios estaba vacía en el entorno de pruebas. El código estaba bien; faltaba el valor, que solo puedes obtener tú desde tu cuenta del servicio.

**Qué necesito de ti (1 acción):** copiar la clave pública desde el panel del servicio y guardarla en el entorno.

**Recomendación:** guardar la clave pública real; mientras tanto el gate local puede usar la clave de prueba del servicio.
`;

const changes = [
  { id: "blog-writer-v2-series", type: "feature", status: "building", date: "2026-10-19", frd: "frd-08-blog-writer-skill", title: "Series de entradas en la skill del blog", what: "Quiero que la skill proponga una serie de tres entradas a partir de una sola nota larga." },
  { id: "case-study-metrics-strip", type: "change", status: "building", date: "2026-10-18", frd: "frd-03-case-studies", title: "Franja de resultados al inicio de cada caso", what: "Los resultados están al final y nadie llega hasta ahí." },
  { id: "now-page-auto-date", type: "change", status: "building", date: "2026-10-16", frd: "frd-04-about-now", title: "Fecha automática en la página \"ahora\"", what: "La fecha de actualización se edita a mano y queda vieja." },
  { id: "research-mode-for-posts", type: "feature", status: "draft", date: "2026-10-14", frd: "frd-08-blog-writer-skill", title: "Modo de investigación web con verificación de fuentes", what: "Para entradas técnicas quiero que la skill busque fuentes y marque cuáles verificó." },
  { id: "talks-page", type: "feature", status: "draft", date: "2026-10-09", frd: "", title: "Página de charlas", what: "Quiero listar las charlas que di con su video y sus diapositivas." },
  { id: "reading-list", type: "feature", status: "draft", date: "2026-10-02", frd: "frd-05-blog-mdx", title: "Lista de lecturas recomendadas", what: "Una página con libros y artículos que recomiendo, con una línea de por qué." },
  { id: "rss-full-content", type: "bug", status: "done", date: "2026-07-20", frd: "frd-05-blog-mdx", title: "El feed RSS solo trae el resumen", what: "Los lectores de RSS muestran una línea y un enlace.", sha: "c02a91de" },
  { id: "dark-theme-code-blocks", type: "bug", status: "done", date: "2026-07-15", frd: "frd-01-site-shell-i18n", title: "Bloques de código ilegibles en tema oscuro", what: "El fondo y el texto del código tienen casi el mismo color.", sha: "7d3be410" },
  { id: "contact-success-focus", type: "bug", status: "done", date: "2026-07-10", frd: "frd-07-contact", title: "El foco se pierde al enviar el formulario", what: "Tras enviar, el lector de pantalla no anuncia la confirmación.", sha: "91ac2f07" },
  { id: "og-image-long-titles", type: "bug", status: "done", date: "2026-07-08", frd: "frd-06-seo-structured-data", title: "Títulos largos se cortan en la imagen para redes", what: "Los títulos de más de 60 caracteres salen recortados.", sha: "4e6f00b2" },
  { id: "projects-filter-chips", type: "change", status: "done", date: "2026-07-25", frd: "frd-03-case-studies", title: "Filtros por tipo de problema en proyectos", what: "El índice de proyectos creció y cuesta encontrar uno.", sha: "a17c33e9" },
  { id: "home-proof-order", type: "change", status: "done", date: "2026-09-10", frd: "frd-02-home-positioning", title: "Reordenar las pruebas del inicio", what: "La prueba más fuerte quedó tercera.", sha: "b80d4c12" },
  { id: "home-tagline-copy", type: "change", status: "done", date: "2026-09-10", frd: "frd-02-home-positioning", title: "Nueva frase del inicio", what: "La frase actual es demasiado genérica.", sha: "b80d4c12" },
  { id: "post-reading-time-locale", type: "change", status: "done", date: "2026-08-02", frd: "frd-05-blog-mdx", title: "Tiempo de lectura en el idioma de la entrada", what: "El tiempo de lectura siempre sale en un solo idioma.", sha: "e5512a0c" },
  { id: "skill-voice-guide", type: "change", status: "done", date: "2026-08-14", frd: "frd-08-blog-writer-skill", title: "Guía de voz para la skill del blog", what: "Los borradores suenan genéricos.", sha: "0f9e7b33" },
  { id: "footer-language-switch", type: "change", status: "done", date: "2026-07-18", frd: "frd-01-site-shell-i18n", title: "Selector de idioma también en el pie", what: "En el teléfono el selector queda escondido en el menú.", sha: "3cc1d8a4" },
  { id: "case-gallery-captions", type: "change", status: "done", date: "2026-08-21", frd: "frd-03-case-studies", title: "Pies de foto en la galería de casos", what: "Las imágenes no explican qué muestran.", sha: "d2a06e5f" },
];

const rawChanges = [{
  file: "done/cover-image-caption.md",
  content: `---
type: change
status: done
date: 2026-08-30
frd: frd-05-blog-mdx
note: "pie de foto de portada: falta cerrar la comilla
---
# Pie de foto en la portada de cada entrada

El texto de la portada se escribía a mano en cada archivo.`,
}];

const progress = Array.from({ length: 73 }, (_, k) => {
  const pool = [
    "(agent-inferred) Las rutas con prefijo de idioma necesitan una redirección explícita desde la raíz.",
    "(agent-inferred) Las imágenes para redes se generan más rápido si las fuentes se cargan una sola vez por build.",
    "(agent-inferred) El tema oscuro sin parpadeo exige fijar la clase antes de pintar.",
    "(owner-stated) Los casos deben empezar por el resultado.",
    "WO verificada tras el gate de su FRD.",
    "Gate completo en verde con las pruebas de idioma y de contacto.",
    "(agent-inferred) Las colecciones de contenido fallan mejor cuando el esquema se valida al construir.",
    "Cambio archivado tras su cierre.",
    "(agent-inferred) El formulario alojado necesita la clave pública también en el entorno de pruebas.",
    "Lanzamiento externo verificado en el dominio de producción.",
  ];
  return pool[(k * 7) % pool.length].replace("WO verificada", `WO-0${(k % 8) + 1}-00${(k % 3) + 1} verificada`);
});

export const personalPageV2 = {
  id: "personal-page-v2",
  srcRoot: "src/app",
  plannedOn: "2026-06-30",
  frds,
  status: `# Machine-readable status for PersonalPage v2.
project: "PersonalPage v2"
phase: release
version: v1
overlay_version: "8.98.0"
created_with: "8.20.0"
target_platforms: responsive
deploy_target: external
deploy_url: "https://example.com/"
running: false
updated_at: "2026-10-07T04:26:42.952Z"
repo: ""
last_green_sha: "f04c2b19"
safe_to_test: true
rethink_pending: false
advance_pending: false
`,
  specDigest,
  archDigest,
  progress,
  decisions,
  changes,
  rawChanges,
  services: {
    schema_version: 1, project_id: "personal-page-v2", resource_slug: "personal-page-v2",
    services: {
      web: { provider_id: "vercel", account_ref: "vercel-main", status: "observed", environments: { preview: { resource_name: "personal-page-v2-preview" }, prod: { resource_name: "personal-page-v2" } } },
      ci: { provider_id: "github", account_ref: "github-main", status: "observed", environments: { prod: { resource_name: "example-org/personal-page-v2" } } },
      forms: { provider_id: "formspark", account_ref: null, status: "proposed", environments: {} },
    },
  },
  env: `# --- Sitio --- URL pública del sitio.
SITE_URL=
# Idioma por defecto.
SITE_DEFAULT_LOCALE=

# --- Contacto --- Clave pública del servicio de formularios.
NEXT_PUBLIC_FORMS_KEY=
# Dirección que recibe los mensajes.
CONTACT_INBOX=
`,
  adrs: [
    { n: 1, slug: "approved-stack", date: "2026-06-29", title: "Approved stack: static Next.js with MDX", context: "A portfolio needs speed and easy writing, not a database.", decision: "Next.js with MDX content in the repository and static generation per language." },
    { n: 2, slug: "content-as-code", date: "2026-06-29", title: "No database: content as code", context: "Every page is authored by one person.", decision: "Keep all content in the repository; publishing is a commit." },
    { n: 3, slug: "build-time-social-images", date: "2026-06-29", title: "Social images generated at build time", context: "A runtime image service adds cost and latency.", decision: "Render every social image during the build from the post front matter." },
  ],
  docs: {
    "docs/product/prd.md": `# PRD — PersonalPage v2

A portfolio that makes clear in ten seconds what this developer builds, for whom and with what results. Case studies answer three questions: what was broken, what was decided, what changed.`,
    "docs/product/research.md": `# Research — PersonalPage v2

Hiring managers read the first paragraph of a case and jump to the result. Without a number they move on.`,
    "docs/product/architecture.md": `# Platform architecture — PersonalPage v2

Static pages per language built from MDX collections; social images at build time; a hosted form service for contact. No database (data-model.json declares \`persistence: none\`).`,
    "docs/decision-log.md": `# Decision log — PersonalPage v2

- **2026-10-07** — Released externally.
- **2026-09-10** — Two of four copy adjustments applied; two wait for the owner.
- **2026-07-03** — Contact form key stored in production.`,
    "DESIGN.md": `# Design — PersonalPage v2

Editorial and calm: generous type, one accent colour, case studies laid out like short articles.`,
    "docs/design/components.md": `# Component inventory — PersonalPage v2

| Component | Notes |
|---|---|
| CaseHeader | problem, decision, result |
| ProofStrip | three linked results |
| PostCard | title, date, reading time |`,
    "docs/analytics/events.md": `# Event plan — PersonalPage v2

\`contact_submitted\`, \`case_opened\`, \`post_read\`.`,
    "docs/launch-plan.md": `# Launch plan — PersonalPage v2

Soft launch to the professional network, then one post per fortnight.`,
    "docs/reviews/security-2026-10-06.md": `# Security review — 2026-10-06

No critical or high findings. The contact form is protected by the hosted service; no secrets in the client bundle beyond the public form key.`,
  },
  model: NO_DATABASE,
};
