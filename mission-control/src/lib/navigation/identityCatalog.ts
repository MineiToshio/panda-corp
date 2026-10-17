import fs from "node:fs";
import path from "node:path";

/** Owner-private, versioned identity registry. Locators are relative to the factory root. */
export type NavigationResource = {
  kind: "idea" | "project";
  id: string;
  slug: string;
  aliases: string[];
  legacyNames: string[];
  locator: string;
  projectId?: string;
};
export type NavigationCatalog = { schemaVersion: 1; resources: NavigationResource[] };

/** A damaged registry or missing registration is operationally visible, never reallocated on GET. */
export class NavigationIdentityError extends Error {
  constructor(message: string) {
    super(`Navigation identities: ${message}`);
    this.name = "NavigationIdentityError";
  }
}

const RESERVED = new Set(["api", "new", "edit", "reference", "undefined", "null"]);
const PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Public slugs are bounded, path-free, and independent of mutable display names. */
export function isNavigationSlug(value: string): boolean {
  return value.length <= 100 && PUBLIC_SLUG.test(value) && !RESERVED.has(value);
}

/** Legacy name conversion also seeds the public slug at registration, once. */
export function navigationSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
  return slug && !RESERVED.has(slug) ? slug : `${slug || "resource"}-item`;
}

function validateResource(item: unknown): asserts item is NavigationResource {
  if (!item || typeof item !== "object")
    throw new NavigationIdentityError("invalid resource record");
  const candidate = item as Record<string, unknown>;
  if (
    !["idea", "project"].includes(String(candidate.kind)) ||
    typeof candidate.id !== "string" ||
    !new RegExp(
      `^${candidate.kind}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
    ).test(candidate.id) ||
    typeof candidate.slug !== "string" ||
    !isNavigationSlug(candidate.slug) ||
    !Array.isArray(candidate.aliases) ||
    !candidate.aliases.every(
      (alias: unknown) => typeof alias === "string" && isNavigationSlug(alias),
    ) ||
    !Array.isArray(candidate.legacyNames) ||
    !candidate.legacyNames.every(
      (name: unknown) => typeof name === "string" && name.length > 0 && name.length <= 200,
    ) ||
    typeof candidate.locator !== "string" ||
    !candidate.locator ||
    path.isAbsolute(candidate.locator) ||
    (candidate.projectId !== undefined &&
      (candidate.kind !== "idea" || typeof candidate.projectId !== "string"))
  ) {
    throw new NavigationIdentityError("invalid resource record");
  }
}

/** Validate an untrusted JSON registry, including reserved public tokens and explicit bridges. */
export function validateNavigationCatalog(value: unknown): NavigationCatalog {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("resources" in value) ||
    !Array.isArray(value.resources)
  ) {
    throw new NavigationIdentityError("unsupported catalog schema");
  }
  const resources: NavigationResource[] = [];
  const ids = new Set<string>();
  const publicTokens = new Set<string>();
  const locators = new Set<string>();
  for (const item of value.resources) {
    validateResource(item);
    if (ids.has(item.id) || locators.has(`${item.kind}:${item.locator}`)) {
      throw new NavigationIdentityError("duplicate identity or locator");
    }
    ids.add(item.id);
    locators.add(`${item.kind}:${item.locator}`);
    for (const token of [item.slug, ...item.aliases]) {
      const key = `${item.kind}:${token}`;
      if (publicTokens.has(key)) throw new NavigationIdentityError(`duplicate public token ${key}`);
      publicTokens.add(key);
    }
    resources.push(item);
  }
  for (const record of resources) {
    if (
      record.projectId &&
      !resources.some((project) => project.kind === "project" && project.id === record.projectId)
    ) {
      throw new NavigationIdentityError(`unresolved idea/project bridge ${record.id}`);
    }
  }
  return { schemaVersion: 1, resources };
}

/** Missing is the explicit legacy fixture boundary; an existing unreadable catalog is an error. */
export function readNavigationCatalog(root: string): NavigationCatalog | undefined {
  try {
    return validateNavigationCatalog(
      JSON.parse(fs.readFileSync(path.join(root, "factory/navigation-identities.json"), "utf8")),
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return undefined;
    if (error instanceof NavigationIdentityError) throw error;
    throw new NavigationIdentityError(`cannot read catalog: ${String(error)}`);
  }
}
