import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot, resolveProjectPath } from "../config/config";
import type { ProjectListItem } from "../portfolio/portfolio";
import {
  NavigationIdentityError,
  type NavigationResource,
  navigationSlug,
  readNavigationCatalog,
} from "./identityCatalog";

/** URL-safe public identity; internal IDs remain stable across filename and folder moves. */
export type NavigationIdentity = { id: string; slug: string };

function safeToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 200 &&
    !/[/\\%?#]/.test(value) &&
    !Array.from(value).some((character) => character.charCodeAt(0) < 32) &&
    value !== "." &&
    value !== ".."
  );
}

function referenceFor(kind: NavigationResource["kind"], locator: string): string | undefined {
  try {
    if (kind === "idea") {
      const parsed = matter(fs.readFileSync(locator, "utf8"), { excerpt: false });
      const reference: unknown = parsed.data.navigation_id;
      if (reference === undefined) return undefined;
      if (typeof reference !== "string")
        throw new NavigationIdentityError("invalid card reference");
      return reference;
    }
    const metadata: unknown = JSON.parse(
      fs.readFileSync(path.join(locator, ".pandacorp/navigation-identity.json"), "utf8"),
    );
    if (
      !metadata ||
      typeof metadata !== "object" ||
      !("schemaVersion" in metadata) ||
      metadata.schemaVersion !== 1 ||
      !("projectId" in metadata) ||
      typeof metadata.projectId !== "string"
    ) {
      throw new NavigationIdentityError("invalid project identity metadata");
    }
    return metadata.projectId;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return undefined;
    if (error instanceof NavigationIdentityError) throw error;
    throw new NavigationIdentityError(`cannot read identity reference: ${String(error)}`);
  }
}

function findResource(
  kind: NavigationResource["kind"],
  locator: string,
): NavigationResource | undefined {
  const root = resolveFactoryRoot();
  const catalog = readNavigationCatalog(root);
  const reference = referenceFor(kind, locator);
  if (!catalog) {
    if (reference)
      throw new NavigationIdentityError(
        "catalog missing for an existing reference; restore it from the vault",
      );
    return undefined;
  }
  const relative = path.relative(root, locator);
  const record = catalog.resources.find(
    (item) => item.kind === kind && (reference ? item.id === reference : item.locator === relative),
  );
  if (!record)
    throw new NavigationIdentityError(`unregistered ${kind}; run the identity reconciliation CLI`);
  return record;
}

/** Read an idea's registration without writing; only absent catalogs permit temporary legacy IDs. */
export function getIdeaNavigation(cardSlug: string): NavigationIdentity {
  if (!safeToken(cardSlug)) throw new NavigationIdentityError("invalid card locator");
  const record = findResource(
    "idea",
    path.join(resolveFactoryRoot(), "factory/ideas", `${cardSlug}.md`),
  );
  return record
    ? { id: record.id, slug: record.slug }
    : { id: `legacy-idea:${cardSlug}`, slug: navigationSlug(cardSlug) };
}

/** Resolve trusted portfolio locators through immutable project metadata, never through URL paths. */
export function getProjectNavigation(projectPath: string, displayName: string): NavigationIdentity {
  const record = findResource("project", resolveProjectPath(projectPath));
  return record
    ? { id: record.id, slug: record.slug }
    : { id: `legacy-project:${projectPath}`, slug: navigationSlug(displayName) };
}

function tokenIdentity(token: string, kind: NavigationResource["kind"]): string | undefined {
  const resources = readNavigationCatalog(resolveFactoryRoot())?.resources.filter(
    (item) => item.kind === kind,
  );
  if (!resources) return undefined;
  const publicMatch = resources.find(
    (item) => item.id === token || item.slug === token || item.aliases.includes(token),
  );
  if (publicMatch) return publicMatch.id;
  const legacyMatches = resources.filter((item) => item.legacyNames.includes(token));
  return legacyMatches.length === 1 ? legacyMatches[0]?.id : undefined;
}

/** Resolve only allowlisted portfolio items; ambiguous legacy names fail closed. Public tokens take precedence. */
export function resolveProjectNavigation(
  token: string,
  items: ProjectListItem[],
): ProjectListItem | undefined {
  if (!safeToken(token)) return undefined;
  const catalog = readNavigationCatalog(resolveFactoryRoot());
  const identityId = tokenIdentity(token, "project");
  const matches = items.filter((item) =>
    catalog
      ? identityId !== undefined && getProjectNavigation(item.path, item.name).id === identityId
      : item.name === token || navigationSlug(item.name) === token,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Resolve public/legacy idea tokens to the current filename, retaining renamed-card URLs. */
export function resolveIdeaNavigation(
  token: string,
  cards: { slug: string }[],
): string | undefined {
  if (!safeToken(token)) return undefined;
  const catalog = readNavigationCatalog(resolveFactoryRoot());
  const identityId = tokenIdentity(token, "idea");
  const matches = cards.filter((card) =>
    catalog
      ? identityId !== undefined && getIdeaNavigation(card.slug).id === identityId
      : card.slug === token || navigationSlug(card.slug) === token,
  );
  return matches.length === 1 ? matches[0]?.slug : undefined;
}
