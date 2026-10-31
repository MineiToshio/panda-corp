import { parseAccounts, parseProviders } from "../parsers";
import type { ServicesDirectoryData } from "../types";
export function servicesFixture(): ServicesDirectoryData {
  const providers = parseProviders({
    schema_version: 1,
    providers: [
      {
        id: "neon",
        name: "Neon",
        type: "Database",
        purpose: "PostgreSQL per project",
        adoption: "base",
        dashboard_url: "https://console.neon.tech",
        reuse_policy: "One account",
        environment_policy: "Branches",
        automation: { methods: ["api"], status: "documented", steps: ["Create"] },
        quota_notes: "Check quota",
        sources: [{ url: "https://example.com/docs", checked_at: "2026-10-19" }],
      },
      {
        id: "modal",
        name: "Modal",
        type: "Compute",
        purpose: "Render posters",
        adoption: "optional",
        dashboard_url: "https://modal.com",
        reuse_policy: "Shared",
        environment_policy: "Separate apps",
        automation: { methods: ["cli"], status: "documented", steps: ["Deploy"] },
        quota_notes: "Zero spend",
        sources: [{ url: "https://example.com/docs", checked_at: "2026-10-19" }],
      },
    ],
  });
  const accounts = parseAccounts({
    schema_version: 1,
    accounts: [
      {
        id: "neon-main",
        provider_id: "neon",
        login_email: "first@example.com",
        display_name: "Main",
        access_status: "historical_identity_verified",
        observed_at: "2026-10-19",
        plan: "Free",
        accepting_new_projects: true,
        automation_status: "documented",
        next_step: null,
        notes: null,
      },
      {
        id: "neon-second",
        provider_id: "neon",
        login_email: "second@example.com",
        display_name: "Second",
        access_status: "unverified",
        observed_at: null,
        plan: null,
        accepting_new_projects: false,
        automation_status: "pending",
        next_step: "Verify",
        notes: null,
      },
    ],
  });
  return {
    providers,
    accounts,
    issues: [],
    allocations: [
      {
        integrationId: "database",
        projectId: "demo",
        projectName: "Demo Project",
        projectHref: "/portfolio/demo/accounts",
        providerId: "neon",
        accountRef: "neon-main",
        status: "observed",
        resources: [{ environment: "dev", resourceName: "demo-dev", nativeResourceId: null }],
      },
      {
        integrationId: "render",
        projectId: "other",
        projectName: "Other",
        projectHref: "/portfolio/other/accounts",
        providerId: "modal",
        accountRef: null,
        status: "proposed",
        resources: [],
      },
    ],
  };
}
