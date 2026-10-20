# Private environment delivery (architecture step 9b3, DR-134)

Architecture **fills every obtainable approved value**. A name/origin map alone is incomplete delivery.
This step runs after decisions and the current-version consumer contract are final, not at preflight.
Use the approved account/resource recipes from `service-preparation.md`; this file defines private delivery,
not blanket cloud permission. Do not ask again for an action already explicitly authorized in the session.
Missing access is pending; spend, access changes, external messages, production deployment and destructive
operations retain their applicable human gates. Never create a second account to bypass missing access.

## 1. Freeze the contract, then reconcile privately

For each variable record: name, purpose, origin, environment, exact destination, required-now flag,
consumer path/owning WO, **installed or planned**, secret-store reference (never value) and evidence/status.
The contract is in `docs/product/architecture.md`; `.env.example` mirrors its approved variable names.
A concrete current-version WO can need a value before its consumer is built: prepare it, but never claim
that planned consumer ran. Deferred/excluded features, hypothetical workers and future WOs get no secrets.
If implementation changes a consumer, reconcile the contract and private delivery in that same change.

Privately inspect existing dotenv files (including any legacy `.env.production.local` or target-specific files) and the
approved machine store through a value-suppressing process. Check the selected framework's actual loading
and precedence rules; do not source dotenv as shell code. Existing values win: preserve them byte-for-byte,
including on reruns, and never rotate/revoke an existing secret as a preparation shortcut. Reuse a stored
value when its environment and consumer match. A conflicting duplicate, malformed file, unproven origin or
existing dev/prod reuse stays pending for resolution; do not silently overwrite it or generate a replacement.
Do not output values, hashes of secrets, connection strings or decrypted store contents into chat, tool
output, screenshots, logs, command arguments or process tracing. Transfer secret-store/provider responses
within a process to the protected destination; display only names, counts and redacted evidence.

## 2. Fill values from the right origin

- **Provider-owned values:** verify the authorized account/org, native resource IDs, scope and budget.
  Reconcile before creating a missing approved resource; persist returned IDs before a retry. Use a supported
  authenticated API/CLI, or browser when needed. Obtain URLs, runtime credentials and public configuration
  for the selected dev/prod resources through authorized operations. An admin/provisioning token remains in
  the machine store, never copied as an app/worker key. Unsupported issuance or missing permission is pending.
  A provider-key value that is only shown once goes directly to protected storage, not a transcript.
- **Application-generated values:** generate with the runtime's cryptographic random generator, at least
  32 random bytes for symmetric secrets unless the actual consumer's documented format requires otherwise.
  Follow the consumer's encoding/length contract; asymmetric signing keys need its specified algorithm,
  keypair and encoding, not a random string. Examples **only if concretely consumed by chosen current scope**:
  Better Auth secret, analytics pseudonymization salt, internal revalidation secret, rate-limit HMAC key,
  job/callback signing material. Neither a service catalog nor these examples creates a required variable.
  Generate independently per purpose and environment; share a value across producer/consumer only where
  their same-environment protocol requires the same signing secret. Never use dev values to fill prod.
- **Non-secret configuration:** derive the approved ports, resource names, endpoints, sender and callback
  origins from the final architecture/live resource IDs. Preserve existing naming. Google OAuth's per-app
  client is intentionally shared across approved dev/prod callback origins in the shared PandaTrack project;
  record this exception explicitly. It does not permit sharing unrelated secrets or adding staging.

## 3. Deliver protected files to explicit targets

Write in the MAIN project checkout under its existing single-writer ownership. If it is busy, leave delivery
pending until a safe point; never write into a live owner's checkout. Ignored files in a planning worktree
do not travel through git merge. Do not copy production secrets through worktree bootstrap/includes.

**Required root layout: exactly three files**, irrespective of the number of providers:

| File | Contents / Git |
|---|---|
| `.env.example` | Tracked guide; empty values and comments for every approved name, service, purpose and destination. |
| `.env.local` | Gitignored development bundle; development values only, with local-only tools at the end. |
| `.env.production` | Gitignored production handoff; only values needed by approved production destinations, never local-only tools or unused services. |

Group by **service inside clearly labelled destination blocks**, so the owner can identify both the
provider and where each value goes. For example: `VERCEL / WEB — Neon`, `VERCEL / WEB — Google OAuth`,
`MODAL / RENDERER — R2` when Modal is actually selected, and `APPLICATION-GENERATED SECRETS` with their
destinations stated. This example selects no new service. A migration/CI/operator block is included only
when required by a concrete approved consumer and clearly says **NOT FOR WEB/WORKER RUNTIME**. Keep
shared protocol fields once and state every authorized consumer. Do not duplicate dotenv keys.
The last block of `.env.example` and `.env.local` says **LOCAL-ONLY — DO NOT DEPLOY**: smoke/oracle/test,
Python/browser tool paths and other operator tooling as applicable. These do not enter `.env.production`.
Do not retain unused variables in that production file simply for completeness; the guide documents names.

**A combined file is storage, not a runtime permission boundary.** Distinct credentials remain distinct:
web R2 read and renderer R2 write, dev/prod SQL roles, and bootstrap migration authority must not collapse
to one credential for convenience. Use unambiguous storage aliases where runtime names would collide,
for example `MODAL_R2_ACCESS_KEY_ID` -> renderer `R2_ACCESS_KEY_ID` and `MIGRATION_DATABASE_URL` ->
Prisma's direct URL, only when those consumers exist. Record the mapping and destination allowlists in
the architecture/README. Export/select a destination explicitly using the selected stack's supported
mechanism or a reviewed project-local selector; the owner's handoff commands must produce the real
provider variable names without hand-renaming aliases. Do not source/load/upload the entire bundle into
a runtime or export bootstrap/admin/other-destination secrets to it. Provider-admin/CLI credentials stay
in the external machine store. CI and provider native secret stores are delivery destinations, not an
excuse for a fourth persistent project dotenv file.

Inspect actual framework precedence. In Next.js, `.env.local` can precede `.env.production`; switching
the filename alone does not prevent development fallback. Wire explicit dev/prod and destination
selection into the supported commands, including worker, migration/seed and tooling entrypoints when
present. Check with **synthetic fixtures only** that production cannot fall back to dev, unrelated secrets
cannot reappear through autoloading, missing destination aliases do not fall back to another role's keys,
and injected isolated test DB/fixture inputs survive command chains. Never boot against real production
resources to prove loading. If a selector/build binding is not implemented, assign the concrete WO and
mark that destination/use pending; populated files alone do not certify safe execution.

When consolidating an existing layout, inventory every old source and consumer first. Resolve conflicts,
preserve applicable values without rotation and update loader/command references. Confirm value preservation
in memory before retiring superseded files; retain any needed recovery material in the protected external
store. Unknown values, conflicting sources or unsafe/in-flight migration stay pending, never silently
lost to satisfy a file count. Do not automatically rewrite every existing project's local files on an
upgrade: propagation installs the convention; actual consolidation is a scoped operation. No new
`.env.modal.*`, `.env.migrations.*`, `.env.fidelity.*`, `.env.offline.*`, or secret-fragment files are generated.

### Migration credentials: execution location versus database target

When migrations are actually selected, label **both facts** in the private file comments and guide:
execution happens from the owner's Mac; the database target is development or production. Local
execution does not mean a development database, and “not uploaded” does not mean unused.

| File | Placement and required explanation |
|---|---|
| `.env.local` | Below the final LOCAL-ONLY separator, in a migration subsection: “Development migrations — executed from your Mac against the development database; Prisma/the selected migration CLI reads this connection; do not upload to Vercel/Modal runtime.” |
| `.env.production` | A separate, clearly labelled operator subsection: “Production migrations — executed from your Mac against the production database; Prisma/the selected migration CLI reads this connection; do not upload to Vercel/Modal runtime.” This approved production-target connection is useful even though it is not deployed with the app. |
| `.env.example` | Empty migration placeholder in the final local/operator-only section. Explain that `.env.local` supplies the development target and `.env.production` the production target. |

Use the actual migration consumer and mapping; Prisma and `MIGRATION_DATABASE_URL` are examples, not
requirements for projects without that stack. Do not create migration variables when there is no
approved consumer. Keep required production-target migration credentials in `.env.production`, not
among development values or in a new file. Local tools/fixtures such as Python/browser paths still
never belong in production; they are different from an operator connection to the production DB.
The owner runs the documented migration command locally with explicit target selection; never imply
that copying the connection to a dashboard is necessary. Runtime exports exclude migration authority.
Preparing/labeling these values executes no migrations and changes no production authorization gate.


Before any write, prove each sensitive path is gitignored (`git check-ignore`) **and not tracked**
(`git ls-files`), including the private bundles and report. Amend ignore configuration if needed before writing values.
Refuse symlinked paths/ancestors, non-regular files, hardlinked existing files or unexpected ownership; do
not chmod or follow such paths. Use a private directory for temporary data, `umask 077`, mode 600 for files
and mode 700 for temporary directories. Never place secrets in a world-readable temporary file first.
Serialize writes. Read only the intended regular file, retain existing bytes/values, add only missing
approved entries with the framework-compatible dotenv serializer (never shell interpolation), validate in
memory, and replace atomically in the same directory. Check the original has not changed before replacement;
if it has, stop rather than overwrite. Clean only temporary files this operation created. Preserve unknown existing values in protected reconciliation/recovery storage; resolve their purpose before
retiring an old source. Exclude confirmed local-only/unused values from the production bundle. Unknown
production entries stay pending for classification instead of silent deletion or readiness certification.
Store newly obtained/generated app credentials in the approved external secret manager, separated by app,
environment and destination; if the store cannot be updated safely, record that pending recovery step.

## 4. Recheck and hand off without values

The lead writes `.pandacorp/comms/entrega-entornos.md` (gitignored, Spanish, mode 600) in the MAIN checkout:

- Contract revision/commit, date, selected scope and actual paths/destinations; never values or personal IDs.
- Per variable **and destination**: name, origin/reference, installed/planned consumer, status and dated evidence.
  `pending` = missing/conflicting/inaccessible value or delivery; `generated` = app value created but not yet
  delivered; `configured` = present in its protected target; `verified` = its installed consumer passed a
  bounded check against the intended environment. `not_applicable` records an excluded obligation, not a key.
- Separate delivery checks (ignore/untracked, path safety, permissions, parseability, expected-name coverage,
  placeholder/empty-required detection, exactly the three named root files, service/destination labels and
  final local-only sections, no local-only/unused values in the production bundle, no migration/admin/other-
  destination values in runtime exports, tested alias mappings and no framework fallback, environment
  separation with the documented OAuth exception, and preserved existing values) from provider connectivity
  and consumer execution. Compare secrets in memory only; report match/conflict without secret fingerprints.
- Each pending item: affected destination, exact blocked operation, reason, next actor/action, and what it blocks
  (local use, worker execution or production). Unsupported API/browser steps and untested planned consumers
  stay explicit. A known unauthorized entry is pending, not quietly classified as ready.
- Separate verdicts for development web, worker, production **inputs prepared**, host configuration and live
  runtime verification. No host/live verification means “pendiente/no verificado”, even when handoff files exist.

Reread the protected files through a value-suppressing parser, checking expected names and valid format without
executing them. Run only bounded non-destructive checks already authorized for the installed consumer; do not
send email, execute paid jobs, migrate production data or deploy just to upgrade a status. A key existing in a
file does not prove provider access, app startup or production readiness. The independent phase reviewer checks
the value-free report and these delivery conditions without receiving secrets. Include counts and pending
steps in the architecture digest; secrets never go into committed docs, account catalogs or `.env.example`.

No generic writer is shipped here: dotenv formats, loaders and target secret stores vary by selected stack.
Use its supported parser/serializer or a narrowly reviewed project-local operation; a bespoke helper, if added,
needs idempotence, existing-value preservation, adversarial protected-path and no-output tests before use.
