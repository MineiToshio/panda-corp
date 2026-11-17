# Supervised rescue (DR-164)

A technical failure never ends an authorized run as `stopped`. Two observations with the
same error class and unit/file identity enter `rescue`, including scheduler no-progress,
exceptions and a repeated decided doubt. Different causes do not qualify yet. The journal
owns the failure history and rescue stages; replay preserves them across coordinator changes.
This rule supersedes historical technical stop/hand-back instructions below. An explicit
owner stop remains authoritative. Only unauthorized production, money, real data deletion
and external communication retain human gates. Capacity keeps its existing automatic wake.

There is one rescue per unit. The CLI gives the supervising app lead (or a fresh drive
worker) a brief containing the WO objective, necessary files/consumers, protected oracle
hashes and failure history. Work happens directly in that unit's checkout, with exceptions
to the failed ordinary artifact allowlist, report/G1 transport and attempt budget recorded
explicitly. Scope, the lease fence, one writer, protected tests and production guards remain
binding. Never modify the main checkout or set `PANDACORP_OWNER_RELEASE_OK`.
Before reusing a checkout, the engine stops its previous CLI writer and requires positive
termination evidence. Native agent writers without CLI termination proof are isolated too. If termination is uncertain, it preserves that checkout for read-only
inspection and creates an isolated rescue checkout; a signal alone never transfers ownership.
The journal retires superseded scheduler jobs (also for abandoned dependents), preserving
their ownership evidence for cleanup; late unreadable results cannot keep the run waiting.

For `next.action: rescue`, read `rescue.brief_path`. `rescue.via: session` means the app lead
executes the work and files `pb rescue --epoch E --unit U --token T --file RESULT`.
`via: cli` means the engine launches and harvests the worker; keep calling `next`.
A rescue response carrying only `wait` is still active work, not close-out. The result schema
is `schemas/rescue-report.schema.json`: status, summary, authored_by and gate (null unless
one of the four actual human actions is required). Do not commit manually.

Protected tests cannot be edited or deleted during direct work. If an oracle is wrong,
return `status: repair` and `oracle_repair: {files, contract, reason}` with concrete protected
paths, the incompatible AC/framework contract and replacement justification. The existing
independent tests execution versions the predecessor hashes and verifies the replacement
before the supervisor resumes; its reason and commit remain recorded. The supervisor
cannot approve its own oracle repair.

The CLI reruns full `bash .pandacorp/verify.sh`, freezes the candidate with a commit trailer
`Rescue: <unit> <cause>`, and requires an allocator-qualified stronger reviewer in a fresh
context before integration. Review reruns full verify on that exact clean commit; changed
protected hashes or gate machinery fail closed. A successful result re-enters ordinary
integration, FRD gates and landing. An unsuccessful rescue becomes `abandoned`, writes an
explicit gap report and closes dependent work while independent work continues. At close-out
any gaps produce `completed_with_gaps`, never technical `stopped`. Final summaries include
every rescue, cause, exception and uncompleted unit. Do not ask the owner a technical question.

