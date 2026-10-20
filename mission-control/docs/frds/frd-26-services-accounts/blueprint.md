# FRD-26 — Blueprint

## Data boundary

`src/lib/services/services.ts` is the single read-only, request-cached join. The catalog parser projects provider recipes; the private parser whitelists identity, date, access, automation and known quota fields. Unknown extensions, `credential_ref`, raw shared config and secrets never enter DTOs. Parsing errors become source/code issues without raw values or paths. Private account identities are excluded from the Manual's separate public projection.

The factory root resolves through existing `PANDACORP_FACTORY_ROOT`; `PANDACORP_ACCOUNTS_FILE` may override the private registry relative to that root. Default: sibling `../pandacorp-vault/services/accounts.yaml`. Project relationships derive from existing portfolio pointers plus private registry project pointers restricted by canonical filesystem paths to the factory's projects parent. The reader does not scan folders, environment files, cloud accounts or arbitrary client-supplied paths.

Catalog schema v1 providers expose id/name/type/purpose/adoption/dashboard_url/reuse_policy/environment_policy/automation/quota_notes/sources. Private schema v1 accounts expose id/provider_id/login_email/display_name/access_status/observed_at/plan/accepting_new_projects/automation_status/next_step/notes and optional quota_snapshot. Optional projects carry project_id/path. Project schema v1 carries project_id/resource_slug/services; resources expose only environment/resource_name/native_resource_id. See factory service schema templates for the complete interchange contract.

HTTPS dashboard links reject userinfo, fragments, non-HTTPS protocols and arbitrary query parameters. A stable non-secret `project` query is accepted. Duplicated IDs/slugs, malformed states, unknown providers, mismatched/dangling account refs and production-as-dev R2 bucket names fail explicitly. Shared native provider projects (Google OAuth, Vercel, Sentry) remain valid; environment resource checks are scoped to Cloudflare environment resources, treated as buckets except the explicit `dns` capability. Renaming an R2 integration to `storage` or `media` does not bypass the checks. These metadata checks do not certify cloud-side permissions or prove isolation; native resource semantics still require provider verification.

## UI and navigation

The existing SubTabs primitive hosts Portfolio Projects/Accounts; `portfolioView=accounts` preserves the canonical selected project/tab and browser history. The global view is rendered even with zero projects. The project workspace adds its tenth tab `accounts`, encoded by the common navigation codec and route validator.

`ServicesDirectory` is reused across both private views. Read data stays in server components; only the safe DTO reaches the search/filter component. Native `details` provides keyboard expansion. Layout uses existing shell/theme variables and contained wrapping, not a new design system. Public provider recipes are derived Manual guides at `/manual/guides/services` and `/manual/guides/service-:provider`, plus the factory's canonical operating guide.

## Verification

Boundary fixture tests exercise malformed YAML, missing sources, duplicate identities, dangling references, secret field removal and dev/prod violations. UI tests exercise separate accounts, safe external links, search/filter, project scoping, missing bindings and selection-preserving global navigation. Existing shell, navigation and Manual tests remain required; independent review and live browser checks are recorded separately from executor-owned historical work-order state.
