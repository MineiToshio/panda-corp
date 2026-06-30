/**
 * Project-name → URL slug.
 *
 * The portfolio stores a human display name ("Pandacorp (Mission Control)"); the
 * dashboard/portfolio links route to a kebab slug ("pandacorp-mission-control").
 * Both the link generators and the `/projects/[slug]` resolver MUST agree on this
 * single transform, or every project deep-link 404s (the resolver compares the
 * slug against the project name). One source of truth (DR-092).
 */

/** Derive a stable, URL-safe kebab slug from a project display name. */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
