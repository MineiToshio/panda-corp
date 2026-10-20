import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAccounts, parseAllocations } from "../parsers";
import { readServicesDirectory } from "../services";

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
    expect(result.issues).toContainEqual({ code: "missing", source: "accounts" });
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
    expect(result.issues).toContainEqual({ code: "invalid", source: "accounts" });
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
