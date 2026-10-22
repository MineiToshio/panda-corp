---
proyecto: "personal-page-v2"
fase: "arquitectura"
stack: "Next.js · MDX · contenido en el repositorio · imágenes para redes al construir"
coste: "$0/mes"
host: "Hosting web gratuito"
---

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

### FRD-01 · Site shell, languages and themes
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-01-001** — Layout shell with skip link
- **WO-01-002** — Two-language routing
- **WO-01-003** — Light and dark themes without flash
- **WO-01-004** — Shared header and footer

### FRD-02 · Home and positioning
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-02-001** — Home hero and proof strip

### FRD-03 · Projects and case studies
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-03-001** — Project index from content files
- **WO-03-002** — Case study template
- **WO-03-003** — Case study image gallery

### FRD-04 · About and now
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-04-001** — About and now pages

### FRD-05 · Blog in MDX
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-05-001** — Content collection for posts
- **WO-05-002** — Post page with reading time
- **WO-05-003** — Tag pages and RSS feed

### FRD-06 · SEO and structured data
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-06-001** — Metadata and canonical URLs
- **WO-06-002** — Open Graph images at build time
- **WO-06-003** — Structured data for articles

### FRD-07 · Contact
**Blueprint:** páginas estáticas alimentadas por las colecciones de contenido.
**Work orders:**
- **WO-07-001** — Contact form with a hosted form service

### FRD-08 · Blog writer skill
**Blueprint:** una skill local con sus prompts y una lista de revisión.
**Work orders:**
- **WO-08-001** — Skill entry point and prompts
- **WO-08-002** — Topic intake from notes
- **WO-08-003** — Outline draft
- **WO-08-004** — Draft in the house voice
- **WO-08-005** — Fact and link checker
- **WO-08-006** — Bilingual pass
- **WO-08-007** — Front matter and slug
- **WO-08-008** — Cover image brief
- **WO-08-009** — Editorial review checklist
