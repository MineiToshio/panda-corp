import type { ServiceAccount, ServiceAllocation, ServiceProvider } from "./types";
import {
  boolean,
  choice,
  date,
  identifier,
  list,
  nonEmptyList,
  nullableText,
  record,
  safeServiceUrl,
  safeSourceUrl,
  text,
  unique,
  versioned,
} from "./validation";
/** Parse only public recipe fields; unknown extensions cannot reach the Manual. */
export function parseProviders(value: unknown): ServiceProvider[] {
  return unique(
    nonEmptyList(versioned(value).providers).map((item) => {
      const row = record(item);
      const automation = record(row.automation);
      return {
        id: identifier(row.id),
        name: text(row.name),
        type: text(row.type),
        purpose: text(row.purpose),
        adoption: choice(row.adoption, ["base", "optional", "reference", "project_specific"]),
        dashboardUrl: safeServiceUrl(row.dashboard_url),
        reusePolicy: text(row.reuse_policy),
        environmentPolicy: text(row.environment_policy),
        quotaNotes: text(row.quota_notes),
        variableExamples:
          row.variable_examples === undefined
            ? []
            : list(row.variable_examples).map(parseVariableExample),
        automation: {
          methods: nonEmptyList(automation.methods).map((method) =>
            choice(method, ["api", "cli", "browser"]),
          ),
          status: choice(automation.status, ["documented"]),
          steps: nonEmptyList(automation.steps).map(text),
        },
        sources: nonEmptyList(row.sources).map((source) => {
          const entry = record(source);
          return { url: safeSourceUrl(entry.url), checkedAt: date(text(entry.checked_at)) ?? "" };
        }),
      };
    }),
    (row) => row.id,
  );
}
/** Parse private identities using an explicit allowlist, never object spreading. */
export function parseAccounts(value: unknown): ServiceAccount[] {
  return unique(
    list(versioned(value).accounts).map((item) => {
      const row = record(item);
      const email = nullableText(row.login_email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid-email");
      return {
        id: identifier(row.id),
        providerId: identifier(row.provider_id),
        loginEmail: email,
        displayName: text(row.display_name),
        dashboardUrl: row.dashboard_url ? safeServiceUrl(row.dashboard_url) : null,
        accessStatus: choice(row.access_status, [
          "historical_identity_verified",
          "unverified",
          "access_required",
          "unavailable",
        ]),
        observedAt: date(row.observed_at),
        plan: nullableText(row.plan),
        acceptingNewProjects: boolean(row.accepting_new_projects),
        automationStatus: choice(row.automation_status, [
          "documented",
          "access_tested",
          "provision_tested",
          "pending",
        ]),
        nextStep: nullableText(row.next_step),
        notes: nullableText(row.notes),
        quotaSnapshot: parseQuota(row.quota_snapshot),
      };
    }),
    (row) => row.id,
  );
}
/** Resolve project allocations while dropping credential references and shared raw data. */
export function parseAllocations(
  value: unknown,
  projectName: string,
  projectHref: string,
): { projectId: string; resourceSlug: string; allocations: ServiceAllocation[] } {
  const root = versioned(value);
  const projectId = identifier(root.project_id);
  const resourceSlug = identifier(root.resource_slug);
  const allocations = Object.entries(record(root.services)).map(([integrationId, value]) => {
    const row = record(value);
    const environments = row.environments === undefined ? {} : record(row.environments);
    const resources = Object.entries(environments).map(([environment, value]) => {
      const resource = record(value);
      identifier(environment);
      return {
        environment,
        resourceName: nullableText(resource.resource_name),
        nativeResourceId: nullableText(resource.native_resource_id),
      };
    });
    const dev = resources.find((resource) => resource.environment === "dev");
    const prod = resources.find((resource) => resource.environment === "prod");
    const isBucketIntegration = row.provider_id === "cloudflare" && /r2|bucket/.test(integrationId);
    if (
      isBucketIntegration &&
      dev &&
      (dev.resourceName?.endsWith("-prod") || dev.resourceName?.endsWith("_prod"))
    )
      throw new Error("production-as-dev");
    if (
      isBucketIntegration &&
      dev &&
      prod &&
      [dev.resourceName, dev.nativeResourceId].some(
        (id, index) => id && id === [prod.resourceName, prod.nativeResourceId][index],
      )
    )
      throw new Error("shared-dev-prod-resource");
    return {
      integrationId: identifier(integrationId),
      projectId,
      projectName,
      projectHref,
      providerId: identifier(row.provider_id),
      accountRef: row.account_ref === null ? null : identifier(row.account_ref),
      status: choice(row.status, ["proposed", "configured", "observed", "inactive"]),
      resources,
    };
  });
  return { projectId, resourceSlug, allocations };
}

function parseQuota(value: unknown): ServiceAccount["quotaSnapshot"] {
  if (value === undefined || value === null) return null;
  const row = record(value);
  function number(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid-number");
    return value;
  }
  return {
    metric: text(row.metric),
    unit: text(row.unit),
    scope: choice(row.scope, ["account", "project"]),
    period: nullableText(row.period),
    limit: number(row.limit),
    usage: number(row.usage),
    remaining: number(row.remaining),
    observedAt: date(row.observed_at),
    source: text(row.source),
  };
}

function parseVariableExample(value: unknown): ServiceProvider["variableExamples"][number] {
  const row = record(value);
  const name = text(row.name);
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error("invalid-variable-name");
  return {
    name,
    source: text(row.source),
    targets: list(row.targets).map((target) =>
      choice(target, ["web_runtime", "worker_runtime", "migration", "local_cli"]),
    ),
    secret: boolean(row.secret),
    purpose: text(row.purpose),
    note: nullableText(row.note),
  };
}
