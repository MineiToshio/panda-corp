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

Privately inspect existing `.env`, `.env.local`, `.env.production.local`, target-specific files and the
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

| Destination | Private delivery |
|---|---|
| Development web | Root `.env.local`, approved development values only; preserve compatible existing `.env`/port setup and loading precedence. |
| Production web | Root `.env.production.local`, **explicit production handoff** containing only required web build/runtime values. It is a local sensitive handoff, not proof values reached the host. Never run a local production command against real resources just to test loading. |
| Worker | Separate approved worker secret store/environment or target-specific protected file, named in the contract. Do not add worker-only database, R2, email or signing credentials to the web handoff. |
| Migration/operator/CI | Separate approved destination with least privilege. An unpooled migration URL or CI upload token enters web/worker runtime only if an actual runtime consumer independently requires it. |
| Local tooling | Local-only file/environment for dev/test/oracle tools; `.env.example` ends with a clearly labelled LOCAL-ONLY section including CI tooling names. No production handoff entries. |

Before any write, prove each sensitive path is gitignored (`git check-ignore`) **and not tracked**
(`git ls-files`), including report/worker files. Amend ignore configuration if needed before writing values.
Refuse symlinked paths/ancestors, non-regular files, hardlinked existing files or unexpected ownership; do
not chmod or follow such paths. Use a private directory for temporary data, `umask 077`, mode 600 for files
and mode 700 for temporary directories. Never place secrets in a world-readable temporary file first.
Serialize writes. Read only the intended regular file, retain existing bytes/values, add only missing
approved entries with the framework-compatible dotenv serializer (never shell interpolation), validate in
memory, and replace atomically in the same directory. Check the original has not changed before replacement;
if it has, stop rather than overwrite. Clean only temporary files this operation created. Preserve unknown
existing entries; flag unexpected production entries pending instead of deleting or silently certifying them.
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
  placeholder/empty-required detection, no local/CI/admin/worker-only values in production web, environment
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
