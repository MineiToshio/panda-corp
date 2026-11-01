import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "../../src/lib/fs-utils/parseFrontmatter";
import { type IdeaCard, readIdeas } from "../../src/lib/ideas/ideas";
import {
  isNavigationSlug,
  type NavigationCatalog,
  NavigationIdentityError,
  type NavigationResource,
  navigationSlug,
  readNavigationCatalog,
  validateNavigationCatalog,
} from "../../src/lib/navigation/identityCatalog";
import { type PortfolioEntry, readPortfolio } from "../../src/lib/portfolio/portfolio";
import { nameToSlug } from "../../src/lib/slug";

/** One CLI writer owns the private catalog and the references pointing into it. */
export type RegistrationPlan = {
  catalog: NavigationCatalog;
  writes: Map<string, string>;
  added: number;
};
export type PublicRename = { kind: "idea" | "project"; id: string; slug: string };

function projectReference(projectPath: string): string | undefined {
  const file = path.join(projectPath, ".pandacorp/navigation-identity.json");
  if (!fs.existsSync(file)) return undefined;
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("projectId" in value) ||
    typeof value.projectId !== "string"
  ) {
    throw new NavigationIdentityError(`invalid project reference at ${file}`);
  }
  return value.projectId;
}

function assignSlug(
  catalog: NavigationCatalog,
  kind: NavigationResource["kind"],
  seed: string,
): string {
  const base = navigationSlug(seed);
  const reserved = new Set(
    catalog.resources
      .filter((item) => item.kind === kind)
      .flatMap((item) => [item.slug, ...item.aliases]),
  );
  let slug = base;
  for (let suffix = 2; reserved.has(slug); suffix += 1) slug = `${base}-${suffix}`;
  return slug;
}

type ResourceInput = {
  kind: NavigationResource["kind"];
  locator: string;
  name: string;
  reference?: string;
};
function register(
  catalog: NavigationCatalog,
  root: string,
  input: ResourceInput,
): NavigationResource {
  const { kind, locator, name, reference } = input;
  const relative = path.relative(root, locator);
  let record = catalog.resources.find(
    (item) => item.kind === kind && (reference ? item.id === reference : item.locator === relative),
  );
  if (reference && !record)
    throw new NavigationIdentityError(
      `unrecognized ${kind} reference ${reference}; restore the catalog before allocating`,
    );
  if (!record) {
    record = {
      kind,
      id: `${kind}_${randomUUID()}`,
      slug: assignSlug(catalog, kind, kind === "idea" ? path.basename(locator, ".md") : name),
      aliases: [],
      legacyNames: [],
      locator: relative,
    };
    catalog.resources.push(record);
  }
  const conflict = catalog.resources.find(
    (item) => item !== record && item.kind === kind && item.locator === relative,
  );
  if (conflict)
    throw new NavigationIdentityError(`locator belongs to another identity: ${relative}`);
  record.locator = relative;
  if (!record.legacyNames.includes(name)) record.legacyNames.push(name);
  const previousName = kind === "idea" ? path.basename(locator, ".md") : name;
  const candidates = [navigationSlug(previousName), nameToSlug(previousName)];
  for (const oldSlug of candidates) {
    const tokenOwner = catalog.resources.find(
      (item) => item.kind === kind && (item.slug === oldSlug || item.aliases.includes(oldSlug)),
    );
    if (!tokenOwner && isNavigationSlug(oldSlug)) record.aliases.push(oldSlug);
  }
  return record;
}

function addWrite(writes: Map<string, string>, file: string, content: string): void {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) writes.set(file, content);
}

function renamePublicSlug(catalog: NavigationCatalog, rename: PublicRename): void {
  if (!isNavigationSlug(rename.slug))
    throw new NavigationIdentityError("invalid or reserved public slug");
  const record = catalog.resources.find(
    (item) => item.kind === rename.kind && item.id === rename.id,
  );
  if (!record) throw new NavigationIdentityError("unknown rename identity");
  if (record.slug === rename.slug) return;
  if (
    catalog.resources.some(
      (item) =>
        item.kind === rename.kind &&
        item !== record &&
        [item.slug, ...item.aliases].includes(rename.slug),
    )
  ) {
    throw new NavigationIdentityError("public slug is permanently reserved by another resource");
  }
  const previous = record.slug;
  record.aliases = record.aliases.filter((alias) => alias !== rename.slug);
  record.aliases.push(previous);
  record.slug = rename.slug;
}

type RegistrationContext = {
  root: string;
  catalog: NavigationCatalog;
  writes: Map<string, string>;
  projects: Map<string, NavigationResource>;
  seenIds: Set<string>;
};
function registerProject(context: RegistrationContext, project: PortfolioEntry): void {
  const { root, catalog, writes, projects, seenIds } = context;
  const locator = path.resolve(root, project.path);
  if (!fs.existsSync(locator) || !fs.statSync(locator).isDirectory())
    throw new NavigationIdentityError(`unavailable project directory: ${locator}`);
  if (projects.has(locator))
    throw new NavigationIdentityError(`duplicate portfolio locator: ${locator}`);
  const record = register(catalog, root, {
    kind: "project",
    locator,
    name: project.name,
    reference: projectReference(locator),
  });
  if (seenIds.has(record.id))
    throw new NavigationIdentityError(`copied project identity: ${record.id}`);
  seenIds.add(record.id);
  projects.set(locator, record);
  addWrite(
    writes,
    path.join(locator, ".pandacorp/navigation-identity.json"),
    `${JSON.stringify({ schemaVersion: 1, projectId: record.id }, null, 2)}\n`,
  );
}
function registerIdea(context: RegistrationContext, card: IdeaCard): void {
  const { root, catalog, writes, projects, seenIds } = context;
  const locator = path.join(root, "factory/ideas", `${card.slug}.md`);
  const content = fs.readFileSync(locator, "utf8");
  const parsed = matter(content, { excerpt: false });
  const reference: unknown = parsed.data.navigation_id;
  if (reference !== undefined && typeof reference !== "string")
    throw new NavigationIdentityError(`invalid idea reference: ${card.slug}`);
  const record = register(catalog, root, { kind: "idea", locator, name: card.title, reference });
  if (seenIds.has(record.id))
    throw new NavigationIdentityError(`copied idea identity: ${record.id}`);
  seenIds.add(record.id);
  if (!record.legacyNames.includes(card.slug)) record.legacyNames.push(card.slug);
  if (card.project) {
    const project = projects.get(path.resolve(root, card.project));
    if (!project)
      throw new NavigationIdentityError(`idea ${card.slug} points outside the verified portfolio`);
    if (record.projectId && record.projectId !== project.id)
      throw new NavigationIdentityError(`idea/project bridge changed: ${card.slug}`);
    record.projectId = project.id;
  }
  if (!reference)
    addWrite(
      writes,
      locator,
      content.replace(/^(\uFEFF?---\r?\n)/, `$1navigation_id: ${record.id}\n`),
    );
}

/** Plan registration from the app's actual readers. No writes and no invented name-based identity merges. */
export function planRegistration(root: string, rename?: PublicRename): RegistrationPlan {
  const catalog = readNavigationCatalog(root) ?? { schemaVersion: 1, resources: [] };
  const previousCount = catalog.resources.length;
  const writes = new Map<string, string>();
  const projects = new Map<string, NavigationResource>();
  const seenIds = new Set<string>();
  const context = { root, catalog, writes, projects, seenIds };
  for (const project of readPortfolio(path.join(root, "factory/portfolio.md")))
    registerProject(context, project);
  for (const card of readIdeas(path.join(root, "factory/ideas"))) registerIdea(context, card);
  if (rename) renamePublicSlug(catalog, rename);
  validateNavigationCatalog(catalog);
  addWrite(
    writes,
    path.join(root, "factory/navigation-identities.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  return { catalog, writes, added: catalog.resources.length - previousCount };
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, content);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** Exclusive writer lock; publish the catalog first so interrupted reference updates recover on rerun. */
export function applyRegistration(root: string, rename?: PublicRename): RegistrationPlan {
  const catalogFile = path.join(root, "factory/navigation-identities.json");
  const lockFile = `${catalogFile}.lock`;
  const lock = fs.openSync(lockFile, "wx", 0o600);
  try {
    const plan = planRegistration(root, rename);
    const catalogContent = plan.writes.get(catalogFile);
    if (catalogContent) atomicWrite(catalogFile, catalogContent);
    for (const [file, content] of plan.writes) if (file !== catalogFile) atomicWrite(file, content);
    return plan;
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockFile);
  }
}
