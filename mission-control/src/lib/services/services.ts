import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parse } from "yaml";
import { resolveFactoryRoot, resolveProjectPath } from "@/lib/config/config";
import { getProjectNavigation } from "@/lib/navigation/identities";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { parseAccounts, parseAllocations, parseProviders } from "./parsers";
import type { ServiceIssue, ServicesDirectoryData } from "./types";
import { identifier, list, record } from "./validation";

interface ReadOptions {
  factoryRoot?: string;
  accountsPath?: string;
  projects?: { name: string; path: string }[];
}
function readFile(file: string, source: string, issues: ServiceIssue[]): unknown {
  try {
    const content = fs.readFileSync(file, "utf8");
    if (Buffer.byteLength(content, "utf8") > 1024 * 1024) throw new Error("oversized-registry");
    return parse(content);
  } catch (error) {
    issues.push({
      source,
      code:
        error && typeof error === "object" && "code" in error && error.code === "ENOENT"
          ? "missing"
          : "invalid",
    });
    return undefined;
  }
}
/** Public recipes can be read independently without touching private identities. */
export function readServiceCatalog(
  factoryRoot = resolveFactoryRoot(),
): Pick<ServicesDirectoryData, "providers" | "issues"> {
  const issues: ServiceIssue[] = [];
  const raw = readFile(path.join(factoryRoot, "factory/services/catalog.yaml"), "catalog", issues);
  if (raw === undefined) return { providers: [], issues };
  try {
    return { providers: parseProviders(raw), issues };
  } catch {
    return { providers: [], issues: [...issues, { source: "catalog", code: "invalid" }] };
  }
}
/** Read-only local join over public recipes, private accounts and trusted portfolio paths. */
export function readServicesDirectory(options: ReadOptions = {}): ServicesDirectoryData {
  const factoryRoot = options.factoryRoot ?? resolveFactoryRoot();
  const result: ServicesDirectoryData = {
    ...readServiceCatalog(factoryRoot),
    accounts: [],
    allocations: [],
  };
  const configuredPath = options.accountsPath ?? process.env.PANDACORP_ACCOUNTS_FILE;
  const accountsPath = configuredPath
    ? path.resolve(factoryRoot, configuredPath)
    : path.resolve(factoryRoot, "../pandacorp-vault/services/accounts.yaml");
  const accountsRaw = readFile(accountsPath, "accounts", result.issues);
  const providerIds = new Set(result.providers.map((provider) => provider.id));
  if (accountsRaw !== undefined) {
    try {
      const accounts = parseAccounts(accountsRaw);
      if (accounts.some((account) => !providerIds.has(account.providerId)))
        throw new Error("dangling-provider");
      result.accounts = accounts;
    } catch {
      result.issues.push({ source: "accounts", code: "invalid" });
    }
  }
  const projects = directoryProjects(options, accountsRaw, factoryRoot, result.issues);
  const seenProjects = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const project of projects)
    readProject(project, { result, providerIds, seenProjects, seenSlugs });
  return result;
}
function directoryProjects(
  options: ReadOptions,
  accountsRaw: unknown,
  factoryRoot: string,
  issues: ServiceIssue[],
): { name: string; path: string }[] {
  const projects = [...(options.projects ?? readPortfolio())];
  if (options.projects !== undefined || accountsRaw === undefined) return projects;
  try {
    for (const project of privateProjectPointers(accountsRaw, factoryRoot))
      if (!projects.some((entry) => resolveProjectPath(entry.path) === project.path))
        projects.push(project);
  } catch {
    issues.push({ source: "project-directory", code: "invalid" });
  }
  return projects;
}
function privateProjectPointers(
  value: unknown,
  factoryRoot: string,
): { name: string; path: string }[] {
  const raw = record(value).projects;
  if (raw === undefined) return [];
  const trustedParent = fs.realpathSync(path.resolve(factoryRoot, ".."));
  return list(raw).map((value) => {
    const entry = record(value);
    const name = identifier(entry.project_id);
    if (typeof entry.path !== "string" || !path.isAbsolute(entry.path))
      throw new Error("invalid-path");
    const resolved = fs.realpathSync(entry.path);
    const relative = path.relative(trustedParent, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !relative)
      throw new Error("untrusted-path");
    return { name, path: resolved };
  });
}
interface JoinContext {
  result: ServicesDirectoryData;
  providerIds: Set<string>;
  seenProjects: Set<string>;
  seenSlugs: Set<string>;
}
function readProject(project: { name: string; path: string }, context: JoinContext): void {
  const { result, providerIds, seenProjects, seenSlugs } = context;
  const projectPath = resolveProjectPath(project.path);
  const source = `project:${project.name}`;
  const raw = readFile(
    path.join(projectPath, ".pandacorp/accounts/services.yaml"),
    source,
    result.issues,
  );
  if (raw === undefined) return;
  try {
    const registered = readPortfolio().some(
      (entry) => resolveProjectPath(entry.path) === projectPath,
    );
    const href = registered
      ? `/portfolio/${encodeURIComponent(getProjectNavigation(project.path, project.name).slug)}/accounts`
      : "";
    const parsed = parseAllocations(raw, project.name, href);
    if (seenProjects.has(parsed.projectId) || seenSlugs.has(parsed.resourceSlug))
      throw new Error("duplicate-project");
    seenProjects.add(parsed.projectId);
    seenSlugs.add(parsed.resourceSlug);
    for (const row of parsed.allocations) {
      if (!providerIds.has(row.providerId)) throw new Error("dangling-provider");
      if (
        row.accountRef &&
        !result.accounts.some(
          (account) => account.id === row.accountRef && account.providerId === row.providerId,
        )
      )
        throw new Error("dangling-account");
    }
    result.allocations.push(...parsed.allocations);
  } catch {
    result.issues.push({ source, code: "invalid" });
  }
}
/** Request-scoped cache is the sole data source for both private directory surfaces. */
export const getServicesDirectory = cache(() => readServicesDirectory());
