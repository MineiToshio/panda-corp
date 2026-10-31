import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readServicesDirectory } from "../services";

const roots: string[] = [];
const provider = {
  id: "neon",
  name: "Neon",
  type: "Database",
  purpose: "PostgreSQL",
  adoption: "base",
  dashboard_url: "https://console.neon.tech",
  reuse_policy: "Reuse",
  environment_policy: "Branches",
  automation: { methods: ["api"], status: "documented", steps: ["Create"] },
  quota_notes: "Check",
  sources: [{ url: "https://neon.tech/docs", checked_at: "2026-10-19" }],
};
const account = {
  id: "neon-main",
  provider_id: "neon",
  login_email: "owner@example.com",
  display_name: "Main",
  access_status: "historical_identity_verified",
  observed_at: "2026-10-19",
  plan: null,
  accepting_new_projects: true,
  automation_status: "documented",
  next_step: null,
  notes: null,
};
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "services-reviewer-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "factory/services"), { recursive: true });
  const catalogPath = path.join(root, "factory/services/catalog.yaml");
  fs.writeFileSync(catalogPath, JSON.stringify({ schema_version: 1, providers: [provider] }));
  const accountsPath = path.join(root, "private.yaml");
  fs.writeFileSync(accountsPath, JSON.stringify({ schema_version: 1, accounts: [account] }));
  return { root, catalogPath, accountsPath };
}
function read(root: string, accountsPath: string) {
  return readServicesDirectory({ factoryRoot: root, accountsPath, projects: [] });
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("reader failure modes, one bounded issue each", () => {
  it("AC-26-007.1: a missing catalog is one issue, it never blames a valid accounts file", () => {
    const { root, catalogPath, accountsPath } = fixture();
    fs.rmSync(catalogPath);
    expect(read(root, accountsPath).issues).toEqual([
      { source: "factory/services/catalog.yaml", code: "missing" },
    ]);
  });
  it("AC-26-007.1: a registry of exactly 1 MiB is read, one byte more is unreadable", () => {
    const { root, accountsPath } = fixture();
    const body = JSON.stringify({ schema_version: 1, accounts: [account] });
    fs.writeFileSync(accountsPath, `${body}\n${" ".repeat(1024 * 1024 - body.length - 1)}`);
    expect(read(root, accountsPath).issues).toEqual([]);
    fs.appendFileSync(accountsPath, " ");
    expect(read(root, accountsPath).issues).toEqual([
      { source: "services/accounts.yaml", code: "unreadable" },
    ]);
  });
  it("AC-26-007.1: a directory in place of a file is unreadable, not missing", () => {
    const { root, accountsPath } = fixture();
    fs.rmSync(accountsPath);
    fs.mkdirSync(accountsPath);
    expect(read(root, accountsPath).issues).toEqual([
      { source: "services/accounts.yaml", code: "unreadable" },
    ]);
  });
  it("AC-26-008.1: malformed YAML and sentinel secrets never reach the DTO or its issue", () => {
    const { root, accountsPath } = fixture();
    fs.writeFileSync(accountsPath, "accounts: [unterminated: SENTINEL_SECRET_VALUE\n");
    const broken = read(root, accountsPath);
    expect(broken.accounts).toEqual([]);
    expect(broken.issues).toEqual([{ source: "services/accounts.yaml", code: "invalid" }]);
    expect(JSON.stringify(broken)).not.toContain("SENTINEL");
    fs.writeFileSync(
      accountsPath,
      JSON.stringify({
        schema_version: 1,
        accounts: [{ ...account, password_ref: "SENTINEL_SECRET_VALUE" }],
      }),
    );
    expect(JSON.stringify(read(root, accountsPath))).not.toContain("SENTINEL");
  });
  it("AC-26-007.1: issue sources never carry an absolute path", () => {
    const { root, accountsPath } = fixture();
    const project = path.join(root, "my project!");
    fs.mkdirSync(project);
    const data = readServicesDirectory({
      factoryRoot: root,
      accountsPath,
      projects: [{ name: "Demo", path: project }],
    });
    expect(data.issues).toEqual([
      { source: "projects/my_project_/.pandacorp/accounts/services.yaml", code: "missing" },
    ]);
    expect(JSON.stringify(data.issues)).not.toContain(root);
  });
});
