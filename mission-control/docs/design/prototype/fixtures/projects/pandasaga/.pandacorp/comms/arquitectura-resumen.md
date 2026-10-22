---
proyecto: "PandaSaga"
fase: "arquitectura"
stack: "Next.js · React · PostgreSQL serverless · paquetes de catálogo versionados · herramienta de ingesta"
coste: "$0/mes"
host: "Hosting web gratuito + PostgreSQL serverless"
---

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

### FRD-01 · Cuenta y progreso de lectura
**Blueprint:** rutas del servidor que reciben el progreso del lector y solo devuelven lo visible.
**Work orders:**
- **WO-01-001** — Guest context on first visit
- **WO-01-002** — Email account with magic link
- **WO-01-003** — Merge guest progress into an account
- **WO-01-004** — Progress model per release
- **WO-01-005** — Mark a chapter as read
- **WO-01-006** — Progress bar per work
- **WO-01-007** — Continue-reading shelf
- **WO-01-008** — Reading history page
- **WO-01-009** — Export my progress
- **WO-01-010** — Delete my account
- **WO-01-011** — Session and device list
- **WO-01-012** — Progress sync across devices
- **WO-01-013** — Account smoke and visual baselines

### FRD-02 · Catálogo sin spoilers
**Blueprint:** proceso fuera de la web con validación de esquema y registro de auditoría.
**Work orders:**
- **WO-02-001** — Catalog bundle format
- **WO-02-002** — Atomic publish of a bundle
- **WO-02-003** — Chapter-bounded visibility filter
- **WO-02-004** — Spoiler report intake

### FRD-03 · Resumen antes de retomar
**Blueprint:** rutas del servidor que reciben el progreso del lector y solo devuelven lo visible.
**Work orders:**
- **WO-03-001** — Recap generator up to a chapter
- **WO-03-002** — Recap screen with sections
- **WO-03-003** — Chapter summaries in the timeline

### FRD-04 · Enciclopedia de la historia
**Blueprint:** rutas del servidor que reciben el progreso del lector y solo devuelven lo visible.
**Work orders:**
- **WO-04-001** — Entry and revision model
- **WO-04-002** — Entry page bounded by progress
- **WO-04-003** — Characters, places and factions index
- **WO-04-004** — Search inside the encyclopedia
- **WO-04-005** — Bookmarks for entries

### FRD-05 · Mapa de conexiones
**Blueprint:** rutas del servidor que reciben el progreso del lector y solo devuelven lo visible.
**Work orders:**
- **WO-05-001** — Connection graph data
- **WO-05-002** — Interactive connection map

### FRD-06 · Explorar capítulos
**Blueprint:** rutas del servidor que reciben el progreso del lector y solo devuelven lo visible.
**Work orders:**
- **WO-06-001** — Chapter list per release
- **WO-06-002** — Chapter page with what changed

### FRD-07 · Ingesta de contenido
**Blueprint:** proceso fuera de la web con validación de esquema y registro de auditoría.
**Work orders:**
- **WO-07-001** — Ingestion source registry
- **WO-07-002** — Ingestion skill entry point
- **WO-07-003** — Draft bundle from a source
- **WO-07-004** — Spoiler boundary checker
- **WO-07-005** — Image credit capture
- **WO-07-006** — Ingestion review report
