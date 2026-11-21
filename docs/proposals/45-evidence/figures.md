# Numeric reconciliation for proposal 45

Dates, versions, proposal labels, revisions, gate labels, exits, work-order IDs, benchmark arm identifiers, line locators and path components identify references. MEASURED refers to retained source or archival records. DERIVED is arithmetic on observed values. ESTIMATED covers classification-based composition, inferred timing attribution and proposed policy. The tables below tie the two deliverables’ figures to the archived inputs. Decimal commas in the Spanish summary express the same values.

| Claim group | Values and mark | Evidence |
|---|---|---|
| Scope and outcome | MEASURED 20 inclusive activations / 19 inclusive IDs, 19 delivery activations / 18 distinct delivery IDs, 8 owner scopes / 0 documented full-scope engine-only completions, 13 Funko / 6 Mission Control delivery activations, no substantiated Personal Page v2 in-window engine activation, 16m 43s nearest excluded case | [Red team, census and intent-at-launch rule](redteam.md#1-the-delivery-census--survives-with-change) · [Nearest case](failures.md#personal-page-v2-three-days-outside-the-fixed-window) |
| Current CLI cohort | MEASURED 8 journals, 939 events, 59 dispatches, 0 batch_landed, 12 of 22 exact integrated SHAs across 3 of 8 runs, two administrative/partial run_finished events, legacy MVP 6 of 8 FRDs / 34 of 48 WOs, 19 build dispatches = 17 floor + 2 r1 + 0 none, zero touch launches | [Red team §1](redteam.md#1-the-delivery-census--survives-with-change) · [Journal inventory](anatomy.md#a3-journal-sample-and-chain-integrity) |
| Disposition clocks | n MEASURED, median and nearest-rank p90 DERIVED. CLI small (5, 160.21, 363.87), combined small (6, 157.60, 363.87), medium (3, 58.22, 2,975.66), combined large (10, 60.44, 158.59). The Fluid CPU run stopped at 919.96 min MEASURED. The four-WO catalog starts belong to medium. | [Recalculation, S1](verify-memo.md) · [Underlying clocks](failures.md#wall-time-and-activity) |
| Register incidence | MEASURED 64 rows / 91 occurrences with 57 CLI + 34 legacy and 90 delivery-coded. Original per-class CLI/legacy/total below. Counts use the original class for reconciliation. N6’s episode is a builder-raised contract disagreement with unresolved attribution. | [Red team §3](redteam.md#3-would-freer-prose-have-prevented-the-interruptions--fails-as-a-causal-explanation) |
| Recurring signatures | MEASURED 13 product issues/mismatches, 12 scope/oracle/phase, 11 deadlock/lease/resume, 9 generated route type, 8 stale baseline, 7 environment/access, 6 coordination, 5 capacity/timeouts, 4 CLI/transport/tool and 3 each generated file, Git staging and explicit owner waits. G2 loop counts as 1 episode, 40 successful directories, 39 harvested. 112.11 min ESTIMATED execution. | [Register signatures](failures.md#ten-most-frequent-recurring-signatures) |
| Phase clocks | MEASURED job-role envelopes for 8 CLI runs, 4.805 h implementation (19 intervals), 3.058 h docs (18), 1.323 h tests role incl. failed starts (7), 0.555 h review (4) and 0.681 h repairs (6). ESTIMATED 2.16 h sum G2/G3 (45 and 2 file-clock intervals) and 20.69 h unmatched after truncation of 32.89 h MEASURED summed spans. | [Activity reconciliation](failures.md#wall-time-and-activity) |
| Snapshot | MEASURED 166 JS modules / 19,371 lines; 14 schemas / 3,435 lines; 421 CLI lines; 7 skill/ref files / 824 lines. Over 60 Lima calendar dates, 63 runtime commits, 62 skill commits, 104 union, 48 scoped fixes = 7 + 41, 130 plugin and 75 overlay version-changing commits. | [Exact Git queries and counts](anatomy.md#a1-line-counts-and-churn) |
| Commands and schema | MEASURED 26 commands, 4 start modes, 7 detect rows, 3 size modes, 8 unit kinds, 8 roles, 9/16/3 run/unit/job states, 4 landing states, 43 journal event types, 4 structured worker schemas, required 12/9 build/review fields. ESTIMATED 2–3 contexts approved WO and 4–5 newly created card WO. | [Inventory](anatomy.md#a2-exact-cli-machine-state-and-schema-inventory) · [Estimated scenarios](anatomy.md#dispatch-counts-under-fixed-assumptions) |
| Worker inputs | MEASURED n=3, 7,127 / 7,146 / 15,531 brief characters, 56,648 / 56,776 / 64,959 first-turn characters. DERIVED task shares 47.9% / 47.7% / 78.4% from 3,412 / 3,412 / 12,180 task chars divided by brief chars. ESTIMATED task upper bound 34.9% / 40.0% / 41.6% and corresponding lower remaining share 65.1% / 60.0% / 58.4%, computed as 100% minus those upper bounds. | [Context classifier](anatomy.md#appendix-b-worker-prompt-reconstruction-and-exact-readable-inputs) · [Worker delivery](anatomy.md#2-what-the-worker-receives) |
| Funko engine incident | MEASURED n=2 engine runs, 81m 28s in the engines (4,887.671 s before rounding), 89m 37s approval to stop, 0 feature-builder dispatches and 0 G3 executions. Rejected docs elapsed 12.868 s in timed stages and 21m 09s red-to-integration. Both provider launches failed before model work. Patch drops untyped nodes 23 → 0 over 4 schemas, by report 7 → 0, review 9 → 0, rescue 3 → 0, doubt 4 → 0. | [Phase-one incident](../44-verification-strategy.md#5--the-funko-incident-which-funko-lines-should-we-follow) · [Failure census](failures.md#findings) · [Schema hunk and count](anatomy.md#6-does-3105fd55-fix-both-funko-codex-launch-failures) |
| Funko direct | MEASURED 20m 06s initial queue, 33m 35s first green, 71m 31s confirmed push from direct dispatch (4,291.436 s before rounding), 2h 40m 47.200s approval-to-push. 0 of 4 WO files from the original plan in the pushed tree. 9 FRDs in the full-card preflight. | [Direct clocks](failures.md#switches-to-direct-implementation) · [Red team comparison](redteam.md#2-the-plain-prompt-wins--fails-as-an-equal-delivery-or-error-rate-claim) · [Scope correction](redteam.md#8-can-the-experiment-lose--survives-with-change) |
| Benchmarks | MEASURED unless separately marked, every arm and exact endpoint appears in the linked ledger, including 16 small oracle runs at 151/151, headless 2.6/5.5 and 11.5/12.1 min on published rounded clocks, separate 2.54/5.46 and 11.45/12.06 user-message clocks, 4 related dialog-focus checks missed, 4.2–4.8× output tokens and 20 analyzed transcripts. MEASURED as archived, 160 of 160 targeted engine-worker records with foreign instructions. FM-9 / V-1 rounded character counts 295k / 35k unit tests and 88k / 12k browser specs, giving 8.4× and 7.3× DERIVED; the archive’s approximate 6× browser ratio has unspecified inputs (ESTIMATED). ESTIMATED 71.5% generation/latency share and approximate 132 active min in C-1. The memo retains the exact F-2/F-3 endpoints and the canonically reported range with their source boundaries. | [Archived ledger](prompts.md#comparison-ledger) · [Partial and development arms](prompts.md#iteration-and-failure-arms-recovered-from-the-lead-transcripts) · [Attribution correction](anatomy.md#5-size-churn-and-the-vanilla-comparator) · [Direct clock reconstruction](redteam.md#2-the-plain-prompt-wins--fails-as-an-equal-delivery-or-error-rate-claim) |
| Installed schemas | MEASURED: Claude and Codex plugin copies at 10.19.5 each have all four pre-fix schemas. The rejected test-writer launch records resolved the factory checkout, later patched in 3105fd55. | [Installed byte comparison, B1](verify-memo.md) |
| Prompt example | MEASURED quoted cap of 3 fix cycles as written in the brief. | [Brief quotations](anatomy.md#2-what-the-worker-receives) |
| Expanded trial | ESTIMATED 10 ordinary pairs and 2 protected controls, with 2 small, 3 UI, 3 bugs and 2 coupled scopes. On 4 ordinary scopes add each of prompt-only A, C and A replay. 36 executions (2 × 12 + 3 × 4), conditional on testing B. C is scored only on assigned cases, with a separate prospective A/C confirmation when C alone is promising. | [Sample design](synthesis.md#cohort-and-controls) · [Red-team conditions](redteam.md#8-can-the-experiment-lose--survives-with-change) |
| Proposed bars and bounds | ESTIMATED 9/10 completion, 30% candidate and 20% equal-proof median reduction, no worsened p90 or added rescues. Initial 120 min cap for small/UI/bug and 240 min for coupled/protected routing is an explicit pre-registration design allocation. Draft supplied the two caps and red team required a cap per category. Illustrative 95% one-sided bounds with no misses are 25.9% at 10 and 77.6% at 2. | [Draft completion caps](synthesis.md#proof-metrics-and-promotion-bars) · [Corrected thresholds and bounds](redteam.md#8-can-the-experiment-lose--survives-with-change) |

Independent verification supersedes the earlier rounded incident clocks and disposition strata. [Recalculation, S1–S2 and N2](verify-memo.md)

## Interruption shares

Counts are MEASURED under the classification rules above. Each DERIVED percentage is occurrences divided by 91 and rounded to two decimals. Rounded shares need not sum to exactly 100%. This is incidence, with no attribution of a percentage of elapsed time.

| Primary class | CLI | Legacy incl. diagnostic | Total | DERIVED share |
|---|---:|---:|---:|---:|
| Product defect detected | 4 | 9 | 13 | 14.29% |
| Rejected report | 5 | 0 | 5 | 5.49% |
| Launch, CLI or tooling | 5 | 4 | 9 | 9.89% |
| Environment or bootstrap | 13 | 3 | 16 | 17.58% |
| Stale or foreign red | 0 | 8 | 8 | 8.79% |
| Process or docs rule | 13 | 1 | 14 | 15.38% |
| Lease, state or resume | 8 | 4 | 12 | 13.19% |
| Quota, capacity or timeout | 4 | 1 | 5 | 5.49% |
| Coordination or handoff | 3 | 3 | 6 | 6.59% |
| Owner wait | 2 | 1 | 3 | 3.30% |

The corrected regrouping below moves the forbidden Workflow API to machinery. The diagnostic is included in this table and contributes one of the four adapter/relay hits. Removing the diagnostic gives **3 MEASURED** direct adapter/relay hits in delivery.

| Broader cause | MEASURED, under the corrected allocation | DERIVED share |
|---|---:|---:|
| Gates/review | 21 | 23.08% |
| Report/rule rigidity | 19 | 20.88% |
| Engine machinery and other tooling | 19 | 20.88% |
| Environment | 16 | 17.58% |
| Directly evidenced adapter/relay | 4 | 4.40% |
| Capacity | 5 | 5.49% |
| Other coordination | 4 | 4.40% |
| Explicit owner wait | 3 | 3.30% |

[Red team’s corrected class counts and allocation](redteam.md#3-would-freer-prose-have-prevented-the-interruptions--fails-as-a-causal-explanation)
