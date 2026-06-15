# SEO e internacionalización (web)

> Dominio: Producto/Documentación · Severidad: **SHOULD** (SEO en web; i18n solo si el PRD lo pide). Enforcement: checklist.

## Regla — SEO / metadata
- **Metadata API de Next** por página: `title` y `description` propios; Open Graph images; `sitemap.ts`; `robots.ts`.
- Contenido renderizado de forma indexable (Server Components por defecto ayuda).

## Regla — i18n (si el PRD lo requiere)
- Routing por subpath (`/es/`, `/fr/`) con `app/[lang]/…` + catálogo de mensajes con **next-intl** (español por defecto, ver `conventions.md`).
- Nada de texto visible hardcodeado: todo vía i18n.

## Regla — SEO multi-idioma (si hay i18n)
- `hreflang` y `canonical` por locale vía `alternates.languages`/`canonical` de la Metadata API; metadata localizada.

## Cómo se verifica
- Checklist en `/pandacorp:release`: ¿metadata por página? ¿sitemap/robots? ¿i18n sin strings sueltos (si aplica)?

## Por qué
Sin metadata/sitemap, un producto web es invisible para buscadores. i18n bien hecho desde el routing evita reescrituras caras después.

Fuentes: nextjs production-checklist · nextjs guides/internationalization · Metadata API (`alternates`)
