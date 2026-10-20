# Services and accounts

The Accounts view is a directory, not a secret manager or an infrastructure controller. Use it to find the external provider, purpose, authorized login email, clickable dashboard and consuming projects. GitHub remains standard shared repository infrastructure rather than a selectable provider in this directory.

## Sources of truth

- Public reusable recipes: `factory/services/catalog.yaml` (displayed in Manual). No personal identities or provider-native account IDs.
- Private account metadata: configured `<projectsRoot>/pandacorp-vault/services/accounts.yaml`. Emails, account/resource references, dated audit and quota evidence; no secret values.
- Project associations: `<project>/.pandacorp/accounts/services.yaml`, referencing provider/account IDs and the project's selected resource/environment mapping. Existing apps are documented, not migrated.
- Credentials: approved secret manager outside repositories, referenced by metadata. `backup-pandacorp-state.sh` includes project account associations and only the vault’s `services/accounts.yaml` in additive local daily snapshots (never adjacent secret files). Restore by reviewing the dated snapshot and copying the selected metadata file back with mode 600; it is a snapshot, not another writable registry. Local account metadata backup is distinct from application database backups; never send app DB dumps to R2 for MVP.

## How a new app reuses services

Architecture reads these sources first, proposes only needed resources under exact resource_slug and `<slug>.pandatrack.app`, asks explicit optional choices, then finalizes the consumer contract and fills every obtainable approved provider value and locally generated app secret. Preflight itself inventories only; no speculative resource or secret creation before decisions. A browser login does not authorize a CLI. An API key for sending does not necessarily administer account resources. Missing permissions, unknown quotas and untested steps remain visible.

Read each provider's recipe for resource/environment examples. Neon gets one slug-named project and dev/prod branches; R2 only if needed gets `<slug>-dev` / `<slug>-prod` with the same adapter against real storage locally and in production. Google OAuth uses a per-app client in the shared PandaTrack project across approved callback environments. Resend/ImprovMX share the domain/inbox with app context. Kit is off by default; no optional SDKs or credentials until approved.

## Private environment delivery

Architecture step 9b3 follows `plugin/skills/architecture/references/environment-delivery.md`: keep exactly three root dotenv files: tracked placeholder-only `.env.example`, private development `.env.local` and private production handoff `.env.production`, the latter two gitignored/untracked with mode 600. Group variables by service inside clearly labelled destination blocks, including application-generated secrets. Local-only entries go last in the guide/dev file and never into production; omit unused production entries. Preserve existing values without rotation and reconcile legacy files before retiring them; an overlay upgrade alone does not rewrite private configurations. Generate separate app secrets per purpose/environment for concrete current-version consumers only. Google OAuth’s approved per-app client is intentionally shared across callback environments.

Keep worker, migration/operator and CI privileges in separate blocks of the same environment file. Use storage aliases when names collide, with explicit destination exporters/selectors that restore real provider names and include only the intended credentials. For example, a selected Modal renderer may store `MODAL_R2_ACCESS_KEY_ID` and export it as `R2_ACCESS_KEY_ID`; bootstrap `MIGRATION_DATABASE_URL` is operator-only and never exported to web/Modal. Shared protocol keys are stored once with their authorized consumers listed. No fourth dotenv file and no whole-file upload. Provider-admin/CLI tokens stay in the external machine store. Check actual framework precedence: Next can load `.env.local` before `.env.production`, so supported commands must prevent development fallback and other-block secrets from reappearing. Verify with fake inputs, not a live production boot; a missing selector/build binding remains pending. Delivery goes to the main project checkout under single-writer ownership: ignored files do not merge, and production secrets are not copied through worktree bootstrap. No secret values enter chat, logs or account catalogs.

The private Spanish report `.pandacorp/comms/entrega-entornos.md` lists each variable/destination, origin reference, installed/planned consumer, evidence, status and exact pending action, without values. Generated, configured and verified mean different things; a planned consumer is never runtime-verified. Independently check protected paths/permissions, required coverage, preserved values and environment/target separation. Missing access stays pending. Prepared production inputs are separate from host configuration and live production readiness, which must be verified later. The Accounts directory does not perform these writes.

## Evidence and changes

Detected integration, researched recipe, verified account, tested operation and reusable preparation are independent claims, each requiring appropriate evidence/date. A documented recipe does not certify provisioning automation. Quotas are shared and dated, not multiplied by creating resources. New providers gain a recipe, private account metadata and a project association before adoption; new accounts/spending still need owner approval. Growth driven by one app suggests isolating that consumer; evenly shared growth needs lawful capacity options, never account proliferation to evade payment.

The directory does not create accounts, resources, secrets, recurring jobs or charges. Cloudinary and payment setup are not added to new MVPs by this plan; preserve existing integrations. Modal is selected for Funko exports with on-demand execution and free-credit exhaustion stopping new work, not paid fallback.

Catalog verification: `node plugin/scripts/validate-service-catalog.mjs`; schema tests: `node plugin/scripts/test-service-catalog.mjs`. These validate metadata only, never cloud access or spend controls.
