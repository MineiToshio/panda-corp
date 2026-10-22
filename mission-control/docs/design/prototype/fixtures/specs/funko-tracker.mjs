// Funko Tracker — a fictional collectibles catalog in construction (~81 %), with a live build,
// a busy change queue, a relational model of 40 entities and a full services directory.
import { frontmatter } from "./common.mjs";
import { relationalModel } from "./models.mjs";
import { planFrd } from "./plan.mjs";

const T = (s) => Date.parse(s);

const frds = [
  planFrd({
    n: 1, slug: "frd-01-browse-catalog", en: "Browse the catalog", es: "Recorrer el catálogo", tag: "UI", area: "catalog",
    states: "rddddddddddddddr", from: T("2026-10-18T03:40:00Z"), every: 34, review: { verdict: "pass", after: 20 },
    titles: ["Catalog read model and seed loader", "Franchise index page", "Series grid with lazy images", "Figure card component", "Search box with debounced query", "Filter chips by series and year", "Variant badges for chase and exclusive pieces", "Empty and error states for the catalog", "Pagination with stable URLs", "Sort by release date and box number", "Image fallback and alt text policy", "Catalog loading budget", "Franchise header with counts", "Keyboard navigation across the grid", "Phone layout for the series grid", "Catalog smoke and visual baselines"],
  }),
  planFrd({
    n: 2, slug: "frd-02-figure-sheet", en: "Figure detail sheet", es: "Ficha de la figura", tag: "UI", area: "figure",
    states: "ddddd", from: T("2026-10-18T05:06:00Z"), every: 22, review: { verdict: "pass" }, extraDeps: { 0: ["WO-01-004"] },
    titles: ["Figure detail route", "Variant switcher on the sheet", "Release history table", "Official image gallery with credits", "Related figures strip"],
  }),
  planFrd({
    n: 3, slug: "frd-03-my-collection", en: "Account and private collection", es: "Cuenta y colección privada", tag: "UI", area: "collection",
    states: "dddddddr", from: T("2026-10-18T05:23:00Z"), every: 41, review: { verdict: "pass" }, extraDeps: { 2: ["WO-01-004"] },
    titles: ["Email sign-in with magic links", "Collection item model and migrations", "Mark as owned from any card", "Collection page with filters", "Condition and box notes per item", "Account deletion and data export", "Session hardening and rate limits", "Collection counters per franchise"],
  }),
  planFrd({
    n: 4, slug: "frd-04-goals-and-wishlist", en: "Goals and wishlist", es: "Metas y faltantes", tag: "UI", area: "goals",
    states: "dddd", from: T("2026-10-18T16:11:00Z"), every: 26, review: { verdict: "pass" }, extraDeps: { 0: ["WO-03-002"] },
    titles: ["Goal model per series", "Missing figures view", "Wishlist toggle and list", "Goal progress ring"],
  }),
  planFrd({
    n: 5, slug: "frd-05-shareable-checklist", en: "Shareable checklist", es: "Lista para compartir", tag: "UI", area: "export",
    states: "ddrrfr", from: T("2026-10-18T05:31:00Z"), every: 64, extraDeps: { 0: ["WO-03-004", "WO-04-002"] },
    // One blocked order: the build stopped it and waits for an owner decision (the failed-card state).
    overrides: { 4: { blocked: "the link expiry needs an owner decision: seven days or never." } },
    titles: ["Checklist export model", "Image renderer worker", "Export modes for all, owned and missing", "Poster layout for long lists", "Share link with expiry", "Export history page"],
  }),
  planFrd({
    n: 6, slug: "frd-06-catalog-seeding", en: "Initial catalog load", es: "Carga inicial del catálogo", tag: "Infra", area: "ingestion",
    states: "ddddd", from: T("2026-10-19T01:55:00Z"), every: 31, review: { verdict: "pass" }, extraDeps: { 2: ["WO-01-001"] },
    titles: ["Source registry and licences", "Ingestion run journal", "Franchise backfill command", "Image rights check", "Ingestion review queue"],
  }),
  planFrd({
    n: 7, slug: "frd-07-new-releases", en: "New releases watch", es: "Novedades del catálogo", tag: "Infra", area: "deltas",
    states: "dd", from: T("2026-10-19T23:02:00Z"), every: 33, extraDeps: { 0: ["WO-06-002"] },
    titles: ["Hourly delta check", "New release digest"],
  }),
  planFrd({
    n: 8, slug: "frd-08-help-and-legal", en: "Help, contact and legal", es: "Ayuda, contacto y legal", tag: "UI", area: "help",
    states: "rr", from: T("2026-10-19T01:01:00Z"), every: 28, review: { verdict: "pass" }, extraDeps: { 1: ["WO-03-001"] },
    titles: ["Help and FAQ pages", "Contact form and legal pages"],
  }),
];

const specDigest = `${frontmatter([["proyecto", "Funko Tracker"], ["fase", "product"]])}

> Un catálogo visual de figuras coleccionables para saber qué tienes, qué te falta y compartirlo en una sola imagen.

## 📋 PRD

### El problema
- **Variantes que se confunden** — la misma figura sale en cinco ediciones casi idénticas y nadie sabe cuál tiene.
- **Listas en papel** — los coleccionistas llevan su inventario en notas del teléfono que no se pueden compartir.
- **Catálogos incompletos** — las fuentes oficiales no muestran las exclusivas de tienda ni las reediciones.

### Hipótesis de valor
Si encontrar una figura y marcarla como "la tengo" toma menos de diez segundos, el coleccionista vuelve cada semana y comparte su lista con su grupo.

### Usuarios
- **Coleccionista casual** — compra dos o tres figuras al mes y quiere evitar duplicados.
- **Coleccionista dedicado** — persigue series completas y lleva metas por franquicia.
- **Curador del catálogo** — revisa la carga de nuevas figuras antes de publicarlas.

### Métricas de éxito
- **Activación** — 60 % de las cuentas nuevas marca al menos cinco figuras en su primera visita.
- **Retención semanal** — 35 % vuelve en la semana siguiente.
- **Compartidos** — 1 de cada 4 coleccionistas exporta una lista en su primer mes.
- **Calidad del catálogo** — menos de 2 % de fichas reportadas como incorrectas.

### Alcance v1
- Catálogo por franquicia y serie
- Ficha con variantes
- Cuenta con enlace mágico
- Colección privada
- Metas por serie
- Lista exportable como imagen
- Carga inicial revisada
- Avisos de novedades

### Fuera del v1
- Marketplace o compraventa
- Precios en tiempo real
- App nativa
- Comunidad y comentarios

### Decisiones abiertas
- **Fuente de imágenes** — ¿enlazar las oficiales o alojar copias con licencia?
- **Formato del póster** — ¿una imagen larga o varias páginas cuando la lista pasa de cien figuras?
- **Moderación** — ¿quién aprueba una ficha nueva antes de publicarla?
- **Analítica** — ¿se instrumenta desde el día uno o tras el lanzamiento?

## 🔬 Research

### Referentes
- **Apps oficiales de marca** — buen catálogo visual, pero sin variantes de tienda ni exportación.
- **Bases de datos comunitarias** — muy completas y difíciles de leer en el teléfono.
- **Hojas de cálculo compartidas** — flexibles, pero nadie las mantiene al día.
- **Grupos de mensajería** — donde de verdad se comparten las listas, como capturas sueltas.

### Hallazgo clave
El momento de uso es la tienda: el coleccionista abre la app con una figura en la mano y necesita la respuesta antes de llegar a la caja.

### La carga en dos momentos
Primero se carga el catálogo histórico de cada franquicia con revisión humana; después un vigilante horario detecta novedades y las deja en cola.

### Calidad del catálogo
Cada ficha guarda su fuente y su licencia de imagen; una ficha sin fuente no se publica.

## 🧩 FRDs

### FRD-01 · Recorrer el catálogo · UI
Explorar franquicias, series y figuras con búsqueda y filtros.
**Resumen:** la entrada principal: encontrar una figura en segundos, también desde el teléfono.
**Historias de usuario:**
- Como coleccionista quiero buscar por nombre o número de caja para encontrar la figura que tengo en la mano.
- Como coleccionista quiero filtrar por serie y año para ver solo lo que me interesa.
**Reglas de negocio:**
- Las variantes se muestran como insignias, nunca como fichas duplicadas.
- La búsqueda responde en menos de 300 ms con el catálogo cargado.
**Fuera de alcance:**
- Búsqueda por foto.
**Preguntas abiertas:**
- ¿Hace falta ordenar por popularidad en el v1?

### FRD-02 · Ficha de la figura · UI
Todo lo que distingue a una figura: variantes, ediciones y créditos de imagen.
**Resumen:** la ficha responde "¿cuál de todas es la mía?".
**Historias de usuario:**
- Como coleccionista quiero cambiar de variante sin salir de la ficha.
**Reglas de negocio:**
- Toda imagen muestra su crédito y su fuente.
**Fuera de alcance:**
- Precios de reventa.
**Preguntas abiertas:**
- ¿Mostramos reediciones como variantes o como ediciones?

### FRD-03 · Cuenta y colección privada · UI
Iniciar sesión sin contraseña y marcar lo que tengo.
**Resumen:** la colección es privada por defecto y se puede borrar entera.
**Historias de usuario:**
- Como coleccionista quiero marcar "la tengo" desde cualquier tarjeta.
**Reglas de negocio:**
- Borrar la cuenta elimina la colección en menos de 24 horas.
**Fuera de alcance:**
- Colecciones compartidas entre varias personas.
**Preguntas abiertas:**
- ¿Guardamos el estado de la caja como texto libre o como lista cerrada?

### FRD-04 · Metas y faltantes · UI
Metas por serie y la lista de lo que me falta.
**Resumen:** convierte la colección en un objetivo visible.
**Historias de usuario:**
- Como coleccionista dedicado quiero ver cuánto me falta para completar una serie.
**Reglas de negocio:**
- Una meta se calcula con las figuras publicadas de la serie, no con las anunciadas.
**Fuera de alcance:**
- Alertas de precio.
**Preguntas abiertas:**
- ¿Las exclusivas de tienda cuentan para completar la serie?

### FRD-05 · Lista para compartir · UI
Exportar la colección como una imagen legible para grupos de mensajería.
**Resumen:** el canal de crecimiento: cada lista compartida lleva el nombre de la app.
**Historias de usuario:**
- Como coleccionista quiero exportar solo lo que me falta para pedirlo en mi grupo.
**Reglas de negocio:**
- La imagen se genera en segundo plano y se avisa cuando está lista.
**Fuera de alcance:**
- Exportar a PDF.
**Preguntas abiertas:**
- ¿Cuántas figuras caben antes de partir el póster?

### FRD-06 · Carga inicial del catálogo · Infra
Cargar el histórico de cada franquicia con revisión humana.
**Resumen:** sin un catálogo confiable la app no sirve; esta carga se revisa antes de publicarse.
**Historias de usuario:**
- Como curador quiero revisar cada lote antes de que llegue al catálogo público.
**Reglas de negocio:**
- Una ficha sin fuente ni licencia de imagen no se publica.
**Fuera de alcance:**
- Carga automática sin revisión.
**Preguntas abiertas:**
- ¿Qué franquicias entran en la primera carga?

### FRD-07 · Novedades del catálogo · Infra
Detectar figuras nuevas cada hora y dejarlas en cola.
**Resumen:** mantiene el catálogo vivo sin trabajo manual diario.
**Historias de usuario:**
- Como curador quiero un resumen diario de novedades por revisar.
**Reglas de negocio:**
- Una novedad nunca se publica sin pasar por la cola de revisión.
**Fuera de alcance:**
- Notificaciones a los coleccionistas.
**Preguntas abiertas:**
- ¿El vigilante corre cada hora o dos veces al día?`;

const archDigest = `${frontmatter([["proyecto", "Funko Tracker"], ["fase", "arquitectura"], ["stack", "Next.js · React · PostgreSQL gestionado · trabajador en segundo plano · almacenamiento de objetos"], ["coste", "US$5 a 10/mes"], ["host", "Hosting web gratuito + trabajador pequeño"]])}

> Una web rápida en el teléfono con un catálogo en PostgreSQL, un trabajador aparte para generar las imágenes de las listas y una cola de revisión para cada carga del catálogo.

## 🧱 Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Web y UI | Next.js (App Router) · React | Server Components para el catálogo y poco JavaScript en el teléfono. |
| Estilos | Tailwind v4 con tokens del diseño | Un solo registro de tokens claro y oscuro. |
| Datos | PostgreSQL gestionado | Relaciones claras entre franquicias, series y variantes. |
| ORM | Drizzle | Esquema tipado y migraciones aditivas. |
| Autenticación | Enlace mágico por correo | Sin contraseñas que custodiar. |
| Correo | Servicio transaccional | Enlaces de acceso y avisos de exportación. |
| Trabajador | Proceso aparte con cola en la base | Las imágenes de las listas no bloquean la web. |
| Imágenes | Almacenamiento de objetos | Pósters exportados con caducidad. |
| Búsqueda | Índices de texto en PostgreSQL | Suficiente para el catálogo del v1. |
| Errores | Rastreo de errores | Alertas del trabajador y de la web. |
| Analítica | Pospuesta al lanzamiento | Decisión registrada en un ADR. |
| Pruebas | Vitest · Playwright | Unidad, componentes y recorridos críticos. |
| CI | Integración continua del repositorio | El gate corre en cada cambio. |
| Despliegue | Hosting web + trabajador pequeño | Dos piezas, un solo repositorio. |

## 🗄️ Modelo de datos

El catálogo es público y la colección es privada; las dos viven en la misma base con permisos separados.

- **Catálogo** — franquicias, series, personajes, figuras y sus variantes y ediciones.
- **Fuentes** — de dónde sale cada ficha, con su licencia de imagen y la fecha de revisión.
- **Colección** — lo que cada persona tiene, con estado de la caja y notas.
- **Metas** — objetivos por serie y la lista de faltantes.
- **Exportaciones** — trabajos de imagen, plantillas y enlaces con caducidad.
- **Operación** — corridas de carga, cola de revisión y registro de auditoría.

## 🔌 Comunicación & servicios

- **Web** — páginas del catálogo y de la colección, renderizadas en el servidor.
- **Base de datos** — PostgreSQL gestionado con ramas de desarrollo y producción.
- **Trabajador** — genera las imágenes de las listas y corre el vigilante de novedades.
- **Almacenamiento** — guarda los pósters exportados durante siete días.
- **Correo** — envía los enlaces de acceso y el aviso de exportación lista.
- **Errores** — recibe los fallos de la web y del trabajador.
- **Dominio** — un subdominio con DNS gestionado.
- **CI** — ejecuta el gate completo en cada cambio.
- **Analítica** — prevista para después del lanzamiento.

## 🧩 Por FRD

${frds.map((f) => `### FRD-${String(f.n).padStart(2, "0")} · ${f.es}
**Blueprint:** ${f.tag === "Infra" ? "proceso en el trabajador con su propio registro de corridas y cola de revisión" : "rutas del servidor con lectores tipados y componentes del inventario compartido"}.
**Work orders:**
${f.wos.map((w) => `- **${w.id}** — ${w.title}`).join("\n")}`).join("\n\n")}`;

const env = `# --- Base de datos --- PostgreSQL gestionado; la cadena con pooling la usa la web.
DATABASE_URL=
# Conexión directa sin pooling, solo para migraciones.
DATABASE_URL_UNPOOLED=
# Rol de solo lectura para el catálogo público.
DATABASE_READONLY_URL=
DATABASE_POOL_MAX=

# --- Autenticación --- Secreto que firma las sesiones; genéralo con una herramienta de claves.
AUTH_SECRET=
# URL pública que reciben los enlaces mágicos.
AUTH_URL=
# Minutos de validez de un enlace de acceso.
AUTH_LINK_TTL_MINUTES=
# Máximo de enlaces por correo y hora.
AUTH_RATE_LIMIT_PER_HOUR=
AUTH_TRUSTED_ORIGINS=

# --- Correo --- Clave del servicio transaccional.
EMAIL_API_KEY=
# Remitente de los enlaces de acceso.
EMAIL_FROM=
# Dirección que recibe las respuestas.
EMAIL_REPLY_TO=
# Plantilla del aviso de exportación lista.
EMAIL_EXPORT_TEMPLATE_ID=

# --- Almacenamiento --- Cuenta del almacenamiento de objetos.
STORAGE_ACCOUNT_ID=
# Clave de acceso del bucket de pósters.
STORAGE_ACCESS_KEY_ID=
# Secreto de la clave de acceso.
STORAGE_SECRET_ACCESS_KEY=
# Bucket de los pósters exportados.
STORAGE_EXPORTS_BUCKET=
# URL pública del bucket.
STORAGE_PUBLIC_BASE_URL=
# Días que dura un póster antes de borrarse.
STORAGE_EXPORT_TTL_DAYS=
STORAGE_REGION=

# --- Trabajador --- Cantidad de trabajos en paralelo.
WORKER_CONCURRENCY=
# Segundos entre sondeos de la cola.
WORKER_POLL_SECONDS=
# Minutos de inactividad antes de dormir el trabajador.
WORKER_IDLE_MINUTES=
# Expresión del vigilante horario de novedades.
WORKER_DELTA_CRON=
# Tiempo máximo de un trabajo de imagen.
WORKER_EXPORT_TIMEOUT_SECONDS=
WORKER_HEALTH_PORT=

# --- Catálogo --- Franquicias activas en la primera carga.
CATALOG_FRANCHISES=
# Tamaño de lote para cada corrida de carga.
CATALOG_BATCH_SIZE=
# Activa la cola de revisión antes de publicar.
CATALOG_REVIEW_REQUIRED=
# Días entre revisiones de una fuente.
CATALOG_SOURCE_REVIEW_DAYS=
CATALOG_IMAGE_MAX_KB=
# Nombre visible del curador por defecto.
CATALOG_DEFAULT_CURATOR=

# --- Errores --- DSN del rastreo de errores de la web.
ERRORS_DSN_WEB=
# DSN del rastreo de errores del trabajador.
ERRORS_DSN_WORKER=
# Entorno que se reporta con cada error.
ERRORS_ENVIRONMENT=
# Fracción de trazas que se envían.
ERRORS_TRACES_SAMPLE_RATE=

# --- Analítica --- Clave pública de analítica (pospuesta al lanzamiento).
ANALYTICS_PUBLIC_KEY=
# Host de la analítica.
ANALYTICS_HOST=
ANALYTICS_ENABLED=

# --- Aplicación --- URL pública de la web.
APP_URL=
# Nombre visible en correos y pósters.
APP_NAME=
# Idioma por defecto de la interfaz.
APP_DEFAULT_LOCALE=
# Correo de contacto que aparece en la página de ayuda.
APP_CONTACT_EMAIL=
# Activa las páginas legales.
APP_LEGAL_PAGES_ENABLED=
APP_MAINTENANCE_MODE=
# Nivel de registro del servidor.
LOG_LEVEL=
`;

const changes = [
  ["single-environment-file", "change", "building", "2026-10-20", "frd-06-catalog-seeding", "Unificar los archivos de entorno en uno por entorno", "Hoy conviven tres archivos de variables con nombres repetidos y nadie sabe cuál manda."],
  ["catalog-search-accents", "bug", "building", "2026-10-20", "frd-01-browse-catalog", "La búsqueda no encuentra nombres con tilde", "Buscar \"Pokémon\" sin tilde no devuelve nada aunque la figura existe."],
  ["variant-badge-overflow", "bug", "building", "2026-10-20", "frd-01-browse-catalog", "Las insignias de variante se salen de la tarjeta en el teléfono", "Con tres insignias la tarjeta se desborda a 375 px."],
  ["owned-toggle-double-tap", "bug", "building", "2026-10-20", "frd-03-my-collection", "Doble toque en \"la tengo\" la desmarca", "Un doble toque rápido envía dos cambios y la figura queda sin marcar."],
  ["poster-long-lists", "change", "building", "2026-10-19", "frd-05-shareable-checklist", "Partir el póster cuando la lista supera cien figuras", "Una imagen de 300 figuras es ilegible en los grupos de mensajería."],
  ["export-ready-email", "change", "building", "2026-10-19", "frd-05-shareable-checklist", "Avisar por correo cuando la lista exportada está lista", "Hoy hay que esperar en la página hasta que termina el trabajo."],
  ["review-queue-bulk-approve", "change", "building", "2026-10-19", "frd-06-catalog-seeding", "Aprobar en lote la cola de revisión", "El curador aprueba fichas una por una aunque vengan de la misma fuente."],
  ["franchise-count-stale", "bug", "building", "2026-10-19", "frd-01-browse-catalog", "El contador de la franquicia no cambia tras una carga", "La cabecera muestra el total viejo hasta reiniciar la web."],
  ["sheet-gallery-keyboard", "bug", "building", "2026-10-19", "frd-02-figure-sheet", "La galería de la ficha no se puede usar con teclado", "Las flechas no cambian de imagen y el foco se pierde."],
  ["goal-ring-exclusives", "change", "building", "2026-10-18", "frd-04-goals-and-wishlist", "Decidir si las exclusivas cuentan para la meta", "La meta da 100 % aunque falten dos exclusivas de tienda."],
  ["magic-link-expired-copy", "bug", "building", "2026-10-18", "frd-03-my-collection", "Mensaje confuso cuando el enlace mágico caducó", "La página dice \"error\" sin explicar cómo pedir otro enlace."],
  ["delta-digest-empty-day", "bug", "building", "2026-10-18", "frd-07-new-releases", "El resumen de novedades llega vacío algunos días", "Se envía un correo sin novedades en lugar de no enviarlo."],
  ["help-faq-search", "change", "building", "2026-10-18", "frd-08-help-and-legal", "Buscar dentro de la ayuda", "Las preguntas frecuentes ya son 30 y no hay forma de filtrarlas."],
  ["share-link-preview", "bug", "building", "2026-10-18", "frd-05-shareable-checklist", "La vista previa del enlace compartido no muestra la imagen", "Al pegar el enlace en un chat aparece solo el texto."],
  ["sort-box-number-mixed", "bug", "building", "2026-10-17", "frd-01-browse-catalog", "Ordenar por número de caja mezcla números y letras", "La caja 10 aparece antes que la 9."],
  ["collection-csv-import", "change", "ready", "2026-10-20", "frd-03-my-collection", "Importar una colección desde una hoja de cálculo", "Muchos coleccionistas ya tienen su lista en una hoja y no quieren marcarla a mano."],
  ["series-cover-art", "change", "draft", "2026-10-20", "frd-01-browse-catalog", "Portada ilustrada para cada serie", "Las series se ven todas iguales en el índice."],
  ["night-mode-poster", "change", "draft", "2026-10-19", "frd-05-shareable-checklist", "Póster en modo oscuro", "Algunos coleccionistas piden la lista con fondo oscuro."],
  ["curator-notes", "change", "draft", "2026-10-18", "frd-06-catalog-seeding", "Notas del curador en cada ficha", "El curador no puede dejar contexto para la siguiente revisión."],
  ["wishlist-share-empty", "bug", "draft", "2026-10-18", "frd-04-goals-and-wishlist", "Compartir la lista de deseos vacía rompe la página", "Con cero figuras la exportación devuelve un error."],
  ["ingestion-retry-loop", "bug", "draft", "2026-10-17", "frd-06-catalog-seeding", "Una fuente caída reintenta sin fin", "Si una fuente responde 500 la corrida no termina nunca."],
].map(([id, type, status, date, frd, title, what]) => ({ id, type, status, date, frd, title, what, cls: type === "bug" && status === "building" ? "expedite" : "standard" }));
// An urgent change that depends on another one and reopens verified work (the rebuilds-verified warning).
Object.assign(changes.find((c) => c.id === "collection-csv-import"), { cls: "expedite", dependsOn: "owned-toggle-double-tap", rebuildsVerified: true });

const decisions = `# Decisiones pendientes — Funko Tracker

## 2026-10-20 — RESUELTO: mantener el vigilante horario en la integración continua
- **Estado:** RESUELTO
- **Decisión:** el vigilante sigue corriendo en la integración continua del repositorio una semana más y se revisa el consumo.
- **Contexto:** el plan gratuito alcanza para una corrida por hora; moverlo al trabajador costaría dinero desde el primer día.

## 2026-10-20 (RESUELTO) — Posponer la analítica hasta el lanzamiento
- **Estado:** RESUELTO
- **Pregunta:** ¿instrumentar eventos desde el primer build o después de lanzar?
- **Recomendación:** posponer; el v1 se valida con entrevistas y la cola de compartidos.
- **Decisión:** posponer, registrado en el ADR correspondiente.

## RESUELTO — La construcción se detiene por dependencias entre FRDs (2026-10-17)
- **Estado:** RESUELTO
- **Qué pasa:** dos órdenes esperan a otra de un FRD distinto que todavía no empezó.
- **Recomendación:** relanzar con el orden de dependencias corregido.

## 2026-10-18T17:35:15Z — RESUELTO: reversión parcial bloqueada en frd-01-browse-catalog (needs-owner)
- **Estado:** RESUELTO
- **Qué pasa:** el motor intentó revertir una orden y chocó con cambios de otra feature.
- **Decisión:** conservar el código; la orden se rehízo encima.
`;

const progress = [
  "Arranque del build: 8 FRDs y 48 work orders planificadas en 4 oleadas.",
  "Oleada 1 en marcha: FRD-01, FRD-02, FRD-03 y FRD-05 en paralelo.",
  "WO-01-001 construida: el modelo de lectura del catálogo carga la semilla de prueba.",
  "WO-01-002 y WO-01-003 en revisión de su FRD.",
  "FRD-02 completo: 5 de 5 work orders construidas.",
  "Gate de FRD-02 aprobado a la primera.",
  "WO-03-001: el acceso por enlace mágico funciona en desarrollo.",
  "WO-05-001 espera a WO-03-004 y WO-04-002 (dependencias entre FRDs).",
  "La construcción se detuvo por una dependencia cruzada; queda registrada como decisión.",
  "Relanzado el build con el orden de dependencias corregido.",
  "FRD-01: 10 de 16 work orders construidas.",
  "El gate visual pidió ajustar el espaciado de la tarjeta de figura (nota, no bloquea).",
  "WO-01-014: navegación con teclado por la grilla verificada.",
  "FRD-03: la migración de la colección pasó en la base de prueba.",
  "Reversión parcial bloqueada en FRD-01 por conflicto con otra feature; se conserva el código.",
  "Gate de FRD-01 aprobado con 2 órdenes reabiertas para un ajuste menor.",
  "FRD-04 completo y aprobado.",
  "Oleada 2 en marcha: FRD-06 y FRD-08.",
  "WO-06-001: registro de fuentes y licencias listo.",
  "WO-06-003: la carga de una franquicia de prueba terminó con 412 fichas en cola.",
  "Gate de FRD-06 aprobado.",
  "WO-08-001 y WO-08-002 construidas; esperan el gate de FRD-08.",
  "FRD-05: el trabajador genera la imagen de una lista de 40 figuras en 6 segundos.",
  "WO-05-003 a WO-05-006 construidas y en revisión.",
  "Oleada 3: FRD-07 en marcha.",
  "WO-07-001: el vigilante horario detecta 3 novedades en la fuente de prueba.",
  "WO-07-002 construida.",
  "Cola de cambios drenada: 15 cambios entran al build en curso.",
  "Cambio \"búsqueda con tildes\" en construcción.",
  "Cambio \"insignias que se desbordan\" en construcción.",
  "El gate completo pasó en verde salvo el recorrido de exportación (pendiente de su FRD).",
  "Nada quedó bloqueado en esta corrida.",
  "Totales: 48 work orders · 39 verificadas · 9 en revisión.",
  "Siguiente punto seguro: gate de FRD-05 tras terminar los cambios en curso.",
  "Se actualizaron los recuentos de la portada del informe.",
  "Supervisor activo; latido cada 5 minutos.",
  "Cambio \"aprobar en lote la cola de revisión\" en construcción.",
  "Cambio \"avisar por correo la exportación\" en construcción.",
  "WO-03-008: contadores por franquicia construidos, esperan su gate.",
  "El gate de accesibilidad marcó dos etiquetas faltantes; corregidas en la misma orden.",
  "Snapshot visual de la grilla del catálogo bendecido en el gate de FRD-01.",
  "Se registró una lección: las dependencias entre FRDs deben declararse en la orden, no en el texto.",
  "Corrida nocturna: sin errores en el trabajador.",
  "Build en curso: 9 work orders esperan la revisión de sus FRDs.",
];

const services = {
  schema_version: 1,
  project_id: "funko-tracker",
  resource_slug: "funko-tracker",
  services: {
    database: { provider_id: "neon", account_ref: "neon-main", status: "configured", environments: { dev: { resource_name: "funko-tracker / dev" }, prod: { resource_name: "funko-tracker / prod" } } },
    web: { provider_id: "vercel", account_ref: "vercel-main", status: "configured", environments: { preview: { resource_name: "funko-tracker-preview" }, prod: { resource_name: "funko-tracker" } } },
    media: { provider_id: "cloudflare", account_ref: "cloudflare-main", status: "configured", environments: { dev: { resource_name: "funko-exports-dev" }, prod: { resource_name: "funko-exports-live" } } },
    dns: { provider_id: "cloudflare", account_ref: "cloudflare-main", status: "configured", environments: { prod: { resource_name: "figuras.example.com" } } },
    email: { provider_id: "resend", account_ref: "resend-main", status: "configured", environments: { prod: { resource_name: "avisos.example.com" } } },
    errors: { provider_id: "sentry", account_ref: "sentry-main", status: "configured", environments: { dev: { resource_name: "funko-web-dev" }, prod: { resource_name: "funko-web" } } },
    ci: { provider_id: "github", account_ref: "github-main", status: "configured", environments: { prod: { resource_name: "example-org/funko-tracker" } } },
    worker: { provider_id: "railway", account_ref: "railway-main", status: "configured", environments: { prod: { resource_name: "funko-worker" } } },
    analytics: { provider_id: "posthog", account_ref: "posthog-main", status: "inactive", environments: {} },
    cache: { provider_id: "upstash", account_ref: null, status: "proposed", environments: {} },
  },
};

const adrs = [
  { n: 1, slug: "stack-golden-path", date: "2026-10-16", title: "Stack: Next.js on managed PostgreSQL with a separate worker", context: "The catalog must load fast on phones and the checklist images take seconds to render.", decision: "Use the golden path (Next.js App Router, Drizzle, managed PostgreSQL) and move image rendering to a small worker that polls a queue stored in the database." },
  { n: 2, slug: "prototype-css-port", date: "2026-10-16", title: "Port the approved prototype CSS in place", context: "The design phase froze a prototype with measured components.", decision: "Port its tokens and component styles into the Tailwind registry instead of redrawing the screens." },
  { n: 3, slug: "worker-queue-in-postgres", date: "2026-10-16", title: "Job queue inside PostgreSQL", context: "A hosted queue would add a paid service for a handful of jobs per hour.", decision: "Keep jobs in a table with row locking; revisit if the volume passes a thousand jobs a day." },
  { n: 4, slug: "ingestion-with-review", date: "2026-10-16", title: "Every catalog load goes through a review queue", context: "Wrong figure data is the main reason collectors abandon a catalog.", decision: "Ingestion writes to a staging table; nothing reaches the public catalog without a curator's approval." },
  { n: 5, slug: "image-rights", date: "2026-10-16", title: "Store a licence and a source for every image", context: "Official images are not ours to redistribute freely.", decision: "Each image row carries its source URL, licence and review date; unlicensed images render as a placeholder." },
  { n: 6, slug: "magic-link-auth", date: "2026-10-16", title: "Passwordless sign-in with magic links", context: "Collectors visit a few times a month and forget passwords.", decision: "Email magic links with a short expiry and a per-address rate limit." },
  { n: 7, slug: "defer-analytics", date: "2026-10-20", title: "Defer product analytics until launch", context: "The v1 is validated with interviews and the share count, which the app already records.", decision: "Ship without an analytics SDK; the event plan stays written and is wired at release." },
  { n: 8, slug: "one-environment-file", date: "2026-10-20", title: "One environment file per environment", context: "Three overlapping files caused two wrong deploys during the build.", decision: "Keep one documented `.env.example` and one file per environment, generated from the services directory." },
];

const docs = {
  "docs/product/prd.md": `# PRD — Funko Tracker

## Problem

Collectors cannot tell near-identical variants apart, keep their inventory in phone notes, and share it as loose screenshots. See the [research](research.md) for the interviews behind this.

## Users

- **Casual collector** — buys a few figures a month and wants to avoid duplicates.
- **Dedicated collector** — completes whole series and tracks goals per franchise.
- **Catalog curator** — reviews every catalog load before it is published.

## Goals and metrics

| Metric | Target |
|---|---|
| Activation (five figures marked on the first visit) | 60 % |
| Weekly retention | 35 % |
| Collectors who export a list in their first month | 25 % |
| Catalog entries reported as wrong | < 2 % |

## Scope (v1)

Catalog by franchise and series, figure sheet with variants, magic-link account, private collection, goals per series, exportable checklist image, reviewed initial load and a new-releases watch.

## Out of scope

Marketplace, live prices, native apps, comments.`,
  "docs/product/research.md": `# Research — Funko Tracker

## Interviews

Eight collectors were interviewed. Six open their notes app inside the shop with a figure in hand; five have bought a duplicate at least once.

## Alternatives

- Brand apps: good visuals, no store exclusives, no export.
- Community databases: complete, hard to read on a phone.
- Shared spreadsheets: flexible, rarely up to date.

## Key finding

The moment of use is the shop aisle. Search must answer before the collector reaches the till.`,
  "docs/product/architecture.md": `# Platform architecture — Funko Tracker

A server-rendered Next.js app on managed PostgreSQL, a small worker that renders checklist images and runs the new-releases watch, object storage for exported posters, transactional email for magic links.

## Data model

The published logical model lives in [data-model.json](data-model.json): 40 entities across catalog, sources, collection, goals, exports and operations.

## Cross-cutting

- Every reader returns a typed result; malformed input fails loud.
- Catalog writes only happen through the review queue.
- Secrets live in the environment; \`.env.example\` documents every variable.`,
  "docs/decision-log.md": `# Decision log — Funko Tracker

- **2026-10-20** — Analytics deferred to launch (ADR-0007). Why: the v1 is validated with interviews and the share count.
- **2026-10-20** — One environment file per environment (ADR-0008). Why: overlapping files caused two wrong deploys.
- **2026-10-17** — Cross-FRD dependencies declared in work-order frontmatter. Why: the build stalled on an undeclared dependency.
- **2026-10-16** — Architecture approved: golden path plus a worker (ADR-0001).`,
  "DESIGN.md": `# Design — Funko Tracker

Bright, toy-shelf colours on a calm neutral base; one accent per franchise. Cards are the unit: image on top, name and box number below, variant badges in the corner.

- Typography: one display face for headings, one text face for everything else.
- Light and dark are both first-class.
- Touch targets of 44 px; badges never carry meaning by colour alone.`,
  "docs/design/components.md": `# Component inventory — Funko Tracker

| Component | Where | Notes |
|---|---|---|
| FigureCard | catalog, collection | image, name, box number, badges |
| VariantBadge | card, sheet | text + icon, never colour only |
| FilterChips | catalog | single-select per group |
| ProgressRing | goals | accessible label with the count |
| PosterPreview | export | scales the exported image |`,
  "docs/analytics/events.md": `# Event plan — Funko Tracker

Deferred to launch (ADR-0007). Planned events: \`figure_marked_owned\`, \`checklist_exported\`, \`checklist_shared\`, \`goal_created\`.`,
  "docs/reviews/frd-02-gate.md": `# FRD-02 gate review

Verdict: pass. Five work orders exercised together; one adversarial test added for a figure without images. No security findings.`,
  "docs/reviews/frd-06-gate.md": `# FRD-06 gate review

Verdict: pass. The review queue blocks unlicensed images; a malformed source file fails loud with its row number.`,
  "docs/rules/README.md": `# Engineering rules for this project

Read every file listed here before writing or changing code. Managed by Pandacorp.`,
};

export const funkoTracker = {
  id: "funko-tracker",
  srcRoot: "src/app",
  plannedOn: "2026-10-16",
  frds,
  status: `# Machine-readable status for Funko Tracker.
project: "Funko Tracker"
phase: implementation
version: v1
overlay_version: "8.110.0"
created_with: "8.96.0"
target_platforms: responsive
running: true
run_started_at: "2026-10-20T22:05:00Z"
supervisor_heartbeat: "2026-10-21T00:12:00Z"
updated_at: "2026-10-20T23:40:00Z"
repo: ""
last_green_sha: "a41c09e2"
safe_to_test: true
rethink_pending: false
advance_pending: false
`,
  specDigest,
  archDigest,
  progress,
  decisions,
  changes,
  services,
  env,
  adrs,
  docs,
  model: relationalModel("funko"),
};
