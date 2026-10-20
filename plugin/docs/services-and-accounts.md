# Services and accounts

The Accounts view is a directory, not a secret manager or an infrastructure controller. Use it to find the external provider, purpose, authorized login email, clickable dashboard and consuming projects. GitHub remains standard shared repository infrastructure rather than a selectable provider in this directory.

## Sources of truth

- Public reusable recipes: `factory/services/catalog.yaml` (displayed in Manual). No personal identities or provider-native account IDs.
- Private account metadata: configured `<projectsRoot>/pandacorp-vault/services/accounts.yaml`. Emails, account/resource references, dated audit and quota evidence; no secret values.
- Project associations: `<project>/.pandacorp/accounts/services.yaml`, referencing provider/account IDs and the project's selected resource/environment mapping. Existing apps are documented, not migrated.
- Credentials: approved secret manager outside repositories, referenced by metadata. `backup-pandacorp-state.sh` includes project account associations and only the vault’s `services/accounts.yaml` in additive local daily snapshots (never adjacent secret files). Restore by reviewing the dated snapshot and copying the selected metadata file back with mode 600; it is a snapshot, not another writable registry. Local account metadata backup is distinct from application database backups; never send app DB dumps to R2 for MVP.

## How a new app reuses services

Architecture reads these sources first, proposes only needed resources under exact resource_slug and `<slug>.pandatrack.app`, asks explicit optional choices, then prepares approved variables as far as current access permits. A browser login does not authorize a CLI. An API key for sending does not necessarily administer account resources. Missing permissions, unknown quotas and untested steps remain visible.

Read each provider's recipe for resource/environment examples. Neon gets one slug-named project and dev/prod branches; R2 only if needed gets `<slug>-dev` / `<slug>-prod` with the same adapter against real storage locally and in production. Google OAuth uses a per-app client in the shared PandaTrack project across approved callback environments. Resend/ImprovMX share the domain/inbox with app context. Kit is off by default; no optional SDKs or credentials until approved.

## Evidence and changes

Detected integration, researched recipe, verified account, tested operation and reusable preparation are independent claims, each requiring appropriate evidence/date. A documented recipe does not certify provisioning automation. Quotas are shared and dated, not multiplied by creating resources. New providers gain a recipe, private account metadata and a project association before adoption; new accounts/spending still need owner approval. Growth driven by one app suggests isolating that consumer; evenly shared growth needs lawful capacity options, never account proliferation to evade payment.

The directory does not create accounts, resources, secrets, recurring jobs or charges. Cloudinary and payment setup are not added to new MVPs by this plan; preserve existing integrations. Modal is selected for Funko exports with on-demand execution and free-credit exhaustion stopping new work, not paid fallback.

Catalog verification: `node plugin/scripts/validate-service-catalog.mjs`; schema tests: `node plugin/scripts/test-service-catalog.mjs`. These validate metadata only, never cloud access or spend controls.
