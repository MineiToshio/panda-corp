---
description: Approved external-service scope, account reuse, resource names, environment variable preparation and evidence.
applies_when: always
globs: ["**/*"]
source: Pandacorp standard — external-services (DR-134)
---

# External services and accounts

- Read the factory provider catalog and private account directory before choosing/provisioning a service; project associations live in `.pandacorp/accounts/services.yaml`. No personal identity or credentials in committed recipes. Account metadata stores references, never passwords/tokens. GitHub remains standard infrastructure outside service choices.
- Only current-version approved services get SDKs, keys, required env validation or work orders. Always resolve PostHog, Sentry, multilingual i18n, SEO and mailing-list needs independently. Kit is off by default; deferred/excluded is not a future stub.
- Reuse authorized accounts. Use exact `resource_slug` (for example `funko-tracker`) and default `<slug>.pandatrack.app`. Preserve existing names/resources; no automatic migration. Vercel hosts new web apps; one Neon project per app, dev/prod branches; pooled/direct URLs follow the framework contract.
- When R2 is needed, private `<slug>-dev` / `<slug>-prod` buckets use the same adapter against real R2 locally and in prod, different scoped credentials/config. No routine staging or custom MVP database backups to R2.
- Google OAuth defaults to shared PandaTrack project, one client per app shared across approved dev/prod callback origins. Reuse shared Resend domain with app/env scoped key where supported and hello sender with app display/subject context. Shared ImprovMX inbox needs plus-address/subject context to identify an app; generic mail may be unidentifiable.
- API/CLI first with verified identity and operation-specific scope; browser session does not prove token authorization. Reconcile stored IDs before create/retry. Record dated quotas and shared consumption; no account/organization proliferation to evade fees. Account creation/spending/deletion/production retain human gates.
- Record independent `detected`, `researched`, `account_verified`, `recipe_tested`, `reusable` evidence, never infer tested automation from documentation. New providers require approved scope, public recipe and private/project references before adoption.
- Variable map: name, purpose, origin, environment, destination, secret reference and pending/generated/configured/verified/not_applicable status. Provider-admin credentials stay outside app runtime. `.env.example` ends with a LOCAL-ONLY block for dev/test/oracle tooling; deploy only required runtime variables to the correct app/worker target. Never put secret values in account catalogs, logs or examples.
