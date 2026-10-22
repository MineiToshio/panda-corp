---
proyecto: "Funko Tracker"
fase: "arquitectura"
stack: "Next.js · React · PostgreSQL gestionado · trabajador en segundo plano · almacenamiento de objetos"
coste: "US$5 a 10/mes"
host: "Hosting web gratuito + trabajador pequeño"
---

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

### FRD-01 · Recorrer el catálogo
**Blueprint:** rutas del servidor con lectores tipados y componentes del inventario compartido.
**Work orders:**
- **WO-01-001** — Catalog read model and seed loader
- **WO-01-002** — Franchise index page
- **WO-01-003** — Series grid with lazy images
- **WO-01-004** — Figure card component
- **WO-01-005** — Search box with debounced query
- **WO-01-006** — Filter chips by series and year
- **WO-01-007** — Variant badges for chase and exclusive pieces
- **WO-01-008** — Empty and error states for the catalog
- **WO-01-009** — Pagination with stable URLs
- **WO-01-010** — Sort by release date and box number
- **WO-01-011** — Image fallback and alt text policy
- **WO-01-012** — Catalog loading budget
- **WO-01-013** — Franchise header with counts
- **WO-01-014** — Keyboard navigation across the grid
- **WO-01-015** — Phone layout for the series grid
- **WO-01-016** — Catalog smoke and visual baselines

### FRD-02 · Ficha de la figura
**Blueprint:** rutas del servidor con lectores tipados y componentes del inventario compartido.
**Work orders:**
- **WO-02-001** — Figure detail route
- **WO-02-002** — Variant switcher on the sheet
- **WO-02-003** — Release history table
- **WO-02-004** — Official image gallery with credits
- **WO-02-005** — Related figures strip

### FRD-03 · Cuenta y colección privada
**Blueprint:** rutas del servidor con lectores tipados y componentes del inventario compartido.
**Work orders:**
- **WO-03-001** — Email sign-in with magic links
- **WO-03-002** — Collection item model and migrations
- **WO-03-003** — Mark as owned from any card
- **WO-03-004** — Collection page with filters
- **WO-03-005** — Condition and box notes per item
- **WO-03-006** — Account deletion and data export
- **WO-03-007** — Session hardening and rate limits
- **WO-03-008** — Collection counters per franchise

### FRD-04 · Metas y faltantes
**Blueprint:** rutas del servidor con lectores tipados y componentes del inventario compartido.
**Work orders:**
- **WO-04-001** — Goal model per series
- **WO-04-002** — Missing figures view
- **WO-04-003** — Wishlist toggle and list
- **WO-04-004** — Goal progress ring

### FRD-05 · Lista para compartir
**Blueprint:** rutas del servidor con lectores tipados y componentes del inventario compartido.
**Work orders:**
- **WO-05-001** — Checklist export model
- **WO-05-002** — Image renderer worker
- **WO-05-003** — Export modes for all, owned and missing
- **WO-05-004** — Poster layout for long lists
- **WO-05-005** — Share link with expiry
- **WO-05-006** — Export history page

### FRD-06 · Carga inicial del catálogo
**Blueprint:** proceso en el trabajador con su propio registro de corridas y cola de revisión.
**Work orders:**
- **WO-06-001** — Source registry and licences
- **WO-06-002** — Ingestion run journal
- **WO-06-003** — Franchise backfill command
- **WO-06-004** — Image rights check
- **WO-06-005** — Ingestion review queue

### FRD-07 · Novedades del catálogo
**Blueprint:** proceso en el trabajador con su propio registro de corridas y cola de revisión.
**Work orders:**
- **WO-07-001** — Hourly delta check
- **WO-07-002** — New release digest

### FRD-08 · Ayuda, contacto y legal
**Blueprint:** rutas del servidor con lectores tipados y componentes del inventario compartido.
**Work orders:**
- **WO-08-001** — Help and FAQ pages
- **WO-08-002** — Contact form and legal pages
