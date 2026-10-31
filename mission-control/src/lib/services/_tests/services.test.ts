import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAccounts, parseAllocations, parseProviders } from "../parsers";
import { readServicesDirectory, serviceIssueCode } from "../services";

const roots: string[] = [];
const provider = {
  id: "neon",
  name: "Neon",
  type: "Database",
  purpose: "PostgreSQL",
  adoption: "base",
  dashboard_url: "https://console.neon.tech",
  reuse_policy: "Reuse organization",
  environment_policy: "Separate branches",
  automation: { methods: ["api"], status: "documented", steps: ["Create project"] },
  quota_notes: "Check plan",
  sources: [{ url: "https://neon.tech/docs", checked_at: "2026-10-19" }],
};
const account = {
  id: "neon-main",
  provider_id: "neon",
  login_email: "owner@example.com",
  display_name: "Main organization",
  access_status: "historical_identity_verified",
  observed_at: "2026-10-19",
  plan: null,
  accepting_new_projects: true,
  automation_status: "documented",
  next_step: null,
  notes: null,
};
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "services-test-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "factory/services"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "factory/services/catalog.yaml"),
    JSON.stringify({ schema_version: 1, providers: [provider] }),
  );
  const accountsPath = path.join(root, "private.yaml");
  fs.writeFileSync(accountsPath, JSON.stringify({ schema_version: 1, accounts: [account] }));
  return { root, accountsPath };
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
describe("public catalog fail-closed contract", () => {
  it("rejects empty catalogs and recipes without evidence", () => {
    expect(() => parseProviders({ schema_version: 1, providers: [] })).toThrow();
    for (const changed of [
      { sources: [] },
      { automation: { ...provider.automation, methods: [] } },
      { automation: { ...provider.automation, steps: [] } },
      { automation: { ...provider.automation, status: "provision_tested" } },
    ])
      expect(() =>
        parseProviders({ schema_version: 1, providers: [{ ...provider, ...changed }] }),
      ).toThrow();
  });
  it("does not disable bucket isolation when the integration label changes", () => {
    for (const integrationId of ["r2", "storage", "media"])
      expect(() =>
        parseAllocations(
          {
            schema_version: 1,
            project_id: "demo",
            resource_slug: "demo",
            services: {
              [integrationId]: {
                provider_id: "cloudflare",
                account_ref: null,
                status: "proposed",
                environments: { dev: { resource_name: "demo-prod", native_resource_id: null } },
              },
            },
          },
          "Demo",
          "",
        ),
      ).toThrow();
  });
  it("accepts provider-native shared project identities outside bucket isolation", () => {
    for (const provider_id of ["google_cloud", "vercel", "sentry"])
      expect(
        parseAllocations(
          {
            schema_version: 1,
            project_id: "demo",
            resource_slug: "demo",
            services: {
              main: {
                provider_id,
                account_ref: null,
                status: "proposed",
                environments: {
                  dev: { resource_name: "demo", native_resource_id: "native" },
                  prod: { resource_name: "demo", native_resource_id: "native" },
                },
              },
            },
          },
          "Demo",
          "",
        ).allocations,
      ).toHaveLength(1);
  });
  it("rejects impossible dates rather than normalizing them", () => {
    expect(() =>
      parseAccounts({ schema_version: 1, accounts: [{ ...account, observed_at: "2026-02-30" }] }),
    ).toThrow();
  });
  it("preserves two integrations sharing the same provider", () => {
    const integration = { provider_id: "cloudflare", account_ref: null, status: "proposed" };
    const parsed = parseAllocations(
      {
        schema_version: 1,
        project_id: "demo",
        resource_slug: "demo",
        services: { dns: integration, r2: integration },
      },
      "Demo",
      "",
    );
    expect(parsed.allocations.map((row) => row.integrationId)).toEqual(["dns", "r2"]);
  });
});
describe("approved services registry contract", () => {
  it("shows candidates with explicit missing-data issue, not empty success", () => {
    const { root } = fixture();
    const result = readServicesDirectory({
      factoryRoot: root,
      accountsPath: path.join(root, "missing"),
      projects: [],
    });
    expect(result.providers).toHaveLength(1);
    expect(result.accounts).toHaveLength(0);
    expect(result.issues).toContainEqual({ code: "missing", source: "services/accounts.yaml" });
  });
  it("derives consumers and redacts secrets in every projection", () => {
    const { root, accountsPath } = fixture();
    const projectPath = path.join(root, "demo");
    fs.mkdirSync(path.join(projectPath, ".pandacorp/accounts"), { recursive: true });
    fs.writeFileSync(
      path.join(projectPath, ".pandacorp/accounts/services.yaml"),
      JSON.stringify({
        schema_version: 1,
        project_id: "demo",
        resource_slug: "demo",
        services: {
          database: {
            provider_id: "neon",
            account_ref: "neon-main",
            status: "configured",
            environments: {
              dev: {
                resource_name: "demo-dev",
                native_resource_id: null,
                credential_ref: "PRIVATE_REFERENCE",
              },
            },
            secret: "PRIVATE_VALUE",
          },
        },
      }),
    );
    const result = readServicesDirectory({
      factoryRoot: root,
      accountsPath,
      projects: [{ name: "Demo", path: projectPath }],
    });
    expect(result.issues).toEqual([]);
    expect(result.allocations[0]?.projectId).toBe("demo");
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_/);
  });
  it("rejects dangling refs instead of displaying a verified consumer", () => {
    const { root, accountsPath } = fixture();
    fs.writeFileSync(
      accountsPath,
      JSON.stringify({ schema_version: 1, accounts: [{ ...account, provider_id: "unknown" }] }),
    );
    const result = readServicesDirectory({ factoryRoot: root, accountsPath, projects: [] });
    expect(result.accounts).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
  });
  it("never discloses malformed raw YAML or exception values", () => {
    const { root, accountsPath } = fixture();
    fs.writeFileSync(accountsPath, "password: [RAW_SECRET");
    const result = readServicesDirectory({ factoryRoot: root, accountsPath, projects: [] });
    expect(JSON.stringify(result)).not.toContain("RAW_SECRET");
    expect(result.issues).toContainEqual({ code: "invalid", source: "services/accounts.yaml" });
  });
  it("rejects duplicates and credential-bearing dashboard links", () => {
    expect(() => parseAccounts({ schema_version: 1, accounts: [account, account] })).toThrow();
    for (const dashboard_url of [
      "javascript:alert(1)",
      "https://secret@console.neon.tech",
      "https://console.neon.tech/?token=SECRET",
    ])
      expect(() =>
        parseAccounts({ schema_version: 1, accounts: [{ ...account, dashboard_url }] }),
      ).toThrow();
  });
  it("rejects production buckets used as dev resources", () => {
    expect(() =>
      parseAllocations(
        {
          schema_version: 1,
          project_id: "demo",
          resource_slug: "demo",
          services: {
            r2: {
              provider_id: "cloudflare",
              account_ref: null,
              status: "proposed",
              environments: { dev: { resource_name: "demo-prod", native_resource_id: null } },
            },
          },
        },
        "Demo",
        "/portfolio/demo/accounts",
      ),
    ).toThrow();
  });
});

describe("bounded issue classification", () => {
  it("AC-26-007.1 AC-26-008.1: maps every internal failure to a closed safe code", () => {
    for (const [id, code] of [
      ["duplicate-id", "duplicate"],
      ["duplicate-project", "duplicate"],
      ["dangling-provider", "dangling"],
      ["dangling-account", "dangling"],
      ["production-as-dev", "productionAsDev"],
      ["shared-dev-prod-resource", "productionAsDev"],
      ["oversized-registry", "unreadable"],
      ["RAW_SECRET", "invalid"],
    ])
      expect(serviceIssueCode(new Error(id))).toBe(code);
    expect(serviceIssueCode({ code: "ENOENT", message: "RAW_SECRET" })).toBe("missing");
    expect(serviceIssueCode({ code: "EACCES", path: "/private/RAW_SECRET" })).toBe("unreadable");
  });
  it("AC-26-007.1: distinguishes unreadable, duplicate and malformed private registries", () => {
    const { root, accountsPath } = fixture();
    fs.writeFileSync(
      accountsPath,
      JSON.stringify({ schema_version: 1, accounts: [account, account] }),
    );
    expect(readServicesDirectory({ factoryRoot: root, accountsPath, projects: [] }).issues).toEqual(
      [{ source: "services/accounts.yaml", code: "duplicate" }],
    );
    expect(
      readServicesDirectory({ factoryRoot: root, accountsPath: root, projects: [] }).issues,
    ).toEqual([{ source: "services/accounts.yaml", code: "unreadable" }]);
  });
  it("AC-26-009.1: public projection uses recipes without private identity or secret fields", async () => {
    const { readServiceManualPages } = await import("../manual");
    const { root } = fixture();
    const pages = JSON.stringify(readServiceManualPages(root));
    expect(pages).toContain("Reuse organization");
    expect(pages).not.toMatch(/owner@example.com|login_email|credential_ref/);
  });
});

it("AC-26-007.1: a bad project emits one bounded issue and leaves valid links intact", () => {
  const { root, accountsPath } = fixture();
  const projects = ["valid", "dangling", "production", "duplicate"];
  const source = (name: string) => `projects/${name}/.pandacorp/accounts/services.yaml`;
  const write = (name: string, value: unknown) => {
    const folder = path.join(root, name, ".pandacorp/accounts");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "services.yaml"), JSON.stringify(value));
  };
  const service = { provider_id: "neon", account_ref: "neon-main", status: "configured" };
  write("valid", {
    schema_version: 1,
    project_id: "valid",
    resource_slug: "valid",
    services: { db: service },
  });
  write("dangling", {
    schema_version: 1,
    project_id: "dangling",
    resource_slug: "dangling",
    services: { db: { ...service, account_ref: "absent" } },
  });
  write("production", {
    schema_version: 1,
    project_id: "production",
    resource_slug: "production",
    services: {
      storage: {
        provider_id: "cloudflare",
        account_ref: null,
        status: "proposed",
        environments: { dev: { resource_name: "app-prod" } },
      },
    },
  });
  write("duplicate", {
    schema_version: 1,
    project_id: "valid",
    resource_slug: "valid",
    services: { db: service },
  });
  const data = readServicesDirectory({
    factoryRoot: root,
    accountsPath,
    projects: projects.map((name) => ({ name, path: path.join(root, name) })),
  });
  expect(data.allocations.map((row) => row.projectId)).toEqual(["valid"]);
  expect(data.issues).toEqual([
    { source: source("dangling"), code: "dangling" },
    { source: source("production"), code: "productionAsDev" },
    { source: source("duplicate"), code: "duplicate" },
  ]);
});
