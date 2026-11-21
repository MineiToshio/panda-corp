# Independent verification of proposal 45

**Verdict: NOT FIT for owner sign-off as written.** The recommendation to keep A and compare it with C in isolation survives. The memo treats A as a corrected baseline without distinguishing two materially different copies, and overstates what A enforces when planning work after intake. Both affect the validity of the proposed comparison. Neither finding requires a change to the two corrected prompt texts.

**Review result, MEASURED:** 2 BLOCKER, 7 SHOULD FIX, 4 NIT. This is a review of a proposal. No product, engine, verifier, queue, test or deployment was run. All replacements below are editorial instructions for the author.

**Source key.** EN = `/Users/Shared/Proyectos/panda-corp/docs/proposals/45-implement-audit.md` (SHA-256 prefix `746395e18b6d`). ES = `audit/chat-es.md` (prefix `6f30be73a2a1`). K = `/Users/Shared/Proyectos/panda-corp`, F = its sibling `funko-tracker`, E = `K/docs/proposals/45-evidence`, R = `K/plugin/runtime/build`. Scratchpad-relative paths are relative to the directory containing `audit/`. The source check uses K `3105fd55` and the ancestry check uses Funko main at `cedefd9f`. E/redteam.md governs interpretation of E/synthesis.md. A discrepancy with raw timestamps, Git or a production code path is identified explicitly below. Counts, archive observations and clock deltas are MEASURED unless explicitly DERIVED or ESTIMATED. Revisions, line numbers, timestamps and source versions are identifiers.

## Defects and exact replacement text

### B1 · BLOCKER · EN 21, 95, 168, 264, 275; ES 5, 50 — the baseline depends on the launch path

The registered Claude installation is at version `10.19.5`, commit `d5e1c96d`. All four of its worker schemas and all four in the local Codex plugin cache match the **parent** of `3105fd55` byte for byte. The factory checkout has the patch. The documented Claude command resolves the installed root, whereas the documented Codex command resolves the factory checkout. The **two actual failed launches** recorded the factory schema path before that checkout was patched. Thus the stale cache is a present distribution gap, not a newly established cause of the historical failures. A matching version string does not qualify the baseline. The second run did launch docs workers.

Evidence: `~/.claude/plugins/installed_plugins.json:4–11`; `~/.{claude,codex}/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/report.schema.json:7–9`; `K/plugin/skills/implement/references/engine-v2.md:45–52`; both `F/.pandacorp/run/codex-workers/w-br-2026-11-21-01-u-tests-wo-06-010*/state.json:1`; E/redteam.md:23–24,110–113. The independent command below compares every schema, not just its version.

Replacement for the installed-copy and second-run sentences at EN 95 and the first sentence at EN 275:

> Both rejected launches named the factory checkout’s report schema. That checkout now contains the fix. The registered Claude 10.19.5 installation and the local Codex 10.19.5 cache still contain the pre-fix schemas. Run 2 dispatched documentation workers and stopped before the test writer. Provider acceptance and end-to-end recovery remain unobserved.

Replacement for the sentence beginning “Compare the installed, patched engine” at EN 168, with the same condition in the Observe row:

> Record the actual CLI path, the four schema hashes and the overlay used by each runtime. Compare A with the explicit direct route only after A’s resolved files match the patched reference in the replica. Record any setup or launch failure and the cost of correcting it separately.

Replacement for ES 5 and the first sentence of ES 50, respectively:

> Mantendría el motor como opción habitual. Antes de compararlo con una sesión directa, comprobaría que la copia que realmente arranca contiene la corrección.
>
> Conserva el motor como opción habitual y autoriza la comparación en copias aisladas. La corrección está en el proyecto de la fábrica, pero las copias locales del complemento todavía contienen el formato anterior.

### B2 · BLOCKER · EN 35, 147, 218, 232–236; ES 21, 68 — independent regression ownership is policy, with a gap in the ordinary scheduler

The factory requires an independent tests-first unit for **every bug card**, including bugs with existing criteria. Initial planning passes the card type. On a later planning round, such as a round after the architect creates the WOs, the scheduler reads the card as `design` but omits `card_type` from the call. The planner reads only `input.card_type` for this condition. A newly planned bug chain can therefore lose the bug-specific prerequisite unless the separate risk-zone/new-criteria condition triggers. An already queued test unit remains evidence of its own chain. This is a static source finding, with no count of live bypasses or demonstrated production escape. Replaying a bug as a bare WO also cannot establish that the original card policy was enforced. A/B/C could obtain the same final green while all omitting the same independent baseline proof.

Evidence: `K/factory/standards/build-engine.md:508–513`; `R/lifecycle/start.mjs:115–126`; `R/lifecycle/plan.mjs:10–18`; `R/next/step.mjs:72`; `R/next/planning.mjs:72–79,94–109`; `R/planner.mjs:60–62`; `R/planner/model.mjs:103–108`; `R/planner/units.mjs:64–69,97–104`. EN 184 correctly preserves the policy in the proposed builder prompt.

Replacement for the tests-first sentence at EN 35:

> Policy requires an independent test writer for a bug card and for a risk-zone chain that adds acceptance criteria. Initial planning receives the card type. Later scheduling omits that field, so newly created bug work can miss its independent test prerequisite. Credit A with fail-first evidence only when the independent author, baseline assertion failure and dependent builder dispatch are recorded for that chain.

Replacement for the opening of the gains cell at EN 147:

> Retains scheduling, dependency recovery, fine-grained state and the existing queue path. Independent fail-first is required for governed bugs, with the replanning gap described above.

Replacement to append to EN 234:

> Before allocation, copy each original scope’s bug and risk obligations into the evaluator’s independent checklist. For governed regressions, require the same assertion and fixture, independent authorship and an observed assertion failure before the builder’s change. A missing receipt counts against that arm even if the final queue is green. Record any coordinator bridge and keep it out of autonomous completions.

Replacement for the proposed-roles cell at ES 21:

> En un cambio sencillo, el mismo agente programa, prueba y actualiza los documentos. Si es una corrección que exige una prueba independiente, otro agente debe demostrar el fallo antes de que se programe el arreglo. Comprobaremos ese registro en las dos rutas. Después, un revisor independiente evalúa el resultado.

### S1 · SHOULD FIX · EN 62–69 — the size table still counts the full catalog request as a small WO

E/failures.md:37–38,179–187 uses a requested-scope rule (small = 1–2 WOs, medium = 3–10), yet puts both catalog starts in small using only the first scheduled WO. E/redteam.md:23–24,48,134 and EN 96 establish four planned WOs for the same card, with nine FRDs named at preflight. The original arithmetic reproduces, but the stratum does not survive the red-team correction. The engine’s own `giant` label and a retrospective count of four WOs measure different things. Below I count the retried card twice at the same original planned scope, keep L6 as the single targeted WO given the documented three-card ambiguity, and use exact journal spans before rounding.

Replacement for EN 62–69 (retain its source link):

> | Disposition by planned WO count, minutes; n MEASURED, median and nearest-rank p90 DERIVED | n | Median | p90 |
> |---|---:|---:|---:|
> | CLI, small | 5 | 160.21 | 363.87 |
> | Combined delivery, small | 6 | 157.60 | 363.87 |
> | Combined delivery, medium (all CLI) | 3 | 58.22 | 2,975.66 |
> | Combined delivery, large | 10 | 60.44 | 158.59 |
>
> These are times to a recorded disposition. Both catalog starts cover the same four-WO plan. The older Mission Control queue start is counted by its one targeted WO. Small covers up to two WOs, medium three through ten and large more than ten. The Fluid CPU run stopped at 919.96 min MEASURED; its later administrative close remains the largest medium observation. Linked attempts, early exits and delayed notifications limit interpretation.

Also update E/figures.md:9 if the correction is adopted. Source for L6 and the legacy large observations: E/failures.md:46–57. The exact read-only recalculation is in `work/verify_45_independent.py`.

### S2 · SHOULD FIX · EN 94, 96; ES 13 — two clocks use rounded endpoints, and closure needs the right source

The archived approximation of 71m 32s does not reproduce at the confirmed-push event. The dispatch was at 15:53:49.224 and the push receipt at 17:05:20.660 UTC. Their difference is 4,291.436 s, or 71m 31.436s MEASURED. The in-engine spans sum to 4,887.671 s, or 81m 27.671s MEASURED. Approval to stop, initial enqueue, first green and approval to push otherwise reconcile. The pushed tree contains product documents; the *local* card records closure by `change-reconcile` using a commit trailer. Its closed state is absent from the pushed tree. The first successful queue check was on an earlier version than the one with the corrected collection filter.

Evidence: `~/.claude/projects/-Users-Shared-Proyectos-funko-tracker/99a8d00e-4719-419a-a688-c20803820ebe.jsonl:302,1121`; `F/.pandacorp/run/queue-log.jsonl:75,83,87,95,118`; both catalog journals at E/redteam.md:23–24; `F/.pandacorp/inbox/changes/done/catalog-line-scope.md:14–18`; `git -C F ls-tree -r --name-only d94a6e3a -- .pandacorp/inbox/changes/done/catalog-line-scope.md` → empty.

Replacement text for EN 94 and 96 (use whole-second rounding in the narrative):

> 81m 28s inside the two runs
>
> From direct dispatch to the first queue submission was 20m 06s, to the first full green 33m 35s, and to confirmed push of the revised candidate 71m 31s, all MEASURED. The pushed tree updated product docs and contained none of the four WO files in the engine plan. The local card records closure against the commit trailer.

Replacement for ES 13:

> **Medido.** En Funko, la primera versión de la sesión directa pasó la comprobación completa a los 33 min 35 s. Después se corrigió un filtro de Mi colección y reapareció un fallo de preparación. El envío de la versión revisada quedó confirmado a los 71 min 31 s desde el arranque. Incluía documentos del cambio y dejaba fuera los archivos de las 4 órdenes preparadas por el motor.

Carry the new precision into E/figures.md:16–17; preserve the original evidence files and their historical approximations.

### S3 · SHOULD FIX · ES 9 — the census reports absence of documented completion

“Ninguno quedó entregado” turns incomplete records and owner redirects into an assertion about actual outcomes. “Hubo código útil” also loses the measured evidence for partial delivery. EN 23, 58–60 and E/redteam.md:11–32 distinguish owners’ requests, activations, IDs and exact commit ancestry. Reaching main does not identify the actor or prove that the complete scope was delivered.

Replacement:

> **Medido.** Encontramos 19 arranques de entrega, con 18 identificadores distintos, para 8 encargos. En los registros conservados no encontramos una entrega completa hecha solo por el motor para ninguno de esos encargos. En Funko sí llegaron a la versión principal 12 de los 22 cambios que el motor había integrado. En algunos casos tú decidiste cambiar de ruta.

### S4 · SHOULD FIX · EN 100, 120; ES 12 — material benchmark confound omitted

The memo mentions inherited context for direct subagents and inherited working directories elsewhere. It omits the observed contamination of the *engine arm*: the small-benchmark workers received Mission Control’s instructions while building a different project. A later warning cannot establish that the historical arms had equal context. The cost and error effect remain unmeasured. This matters directly to the owner’s question about bad instructions. Also, the historical direct clock ends at the agent’s handoff, without a timestamp for the earliest internally usable version.

Evidence: E/prompts.md:15–25,31–41,87–88; `K/factory/backlog/BL-0220-workflow-agents-get-launcher-claude-md.md:32–35`. A bounded independent scan of the archived `ffab0b09…/subagents/workflows/*/agent-*.jsonl` first messages with literal `pandacorp-bench-form/bench-implement` found 125/125 MEASURED with Mission Control cwd and an instructions attachment listing its CLAUDE.md; that filter is narrower than the historical resolution’s 160/160 MEASURED as archived.

Replacement to append to EN 100:

> In the archived small benchmark, all 160 of 160 targeted engine-worker records in the historical audit received Mission Control instructions while building the benchmark project (MEASURED as archived). The direct subagents had an explicit instruction to ignore foreign project context. The effect on time and errors is unknown. In the comparison, record the actual project instructions each worker receives.

Replacement for ES 12:

> **Medido.** En las pruebas antiguas, los agentes directos presentaron su trabajo a los 2,6 y 5,5 min en el caso pequeño y a los 11,5 y 12,1 min en el mediano. Al motor se le exigían más comprobaciones y, en el caso pequeño, sus agentes recibieron instrucciones de otro proyecto. Una entrega directa mediana falló al usar los diálogos con el teclado. Esas pruebas no permiten comparar el tiempo hasta una entrega revisada por igual.

### S5 · SHOULD FIX · EN 120 — the browser-test ratio needs its sample and unit

Proposal 41’s summary says roughly six times. Its explicit character-count comparator is FM-9 versus V-1, 88k/12k ≈ 7.33 for browser specs and 295k/35k ≈ 8.43 for unit tests. Figures are rounded inputs. The archived 4.2–4.8× refers to **output tokens**; the test-volume ratios are **characters written**. The number of transcripts in the timing analysis is not the number of generator pairs behind each ratio. The text does not establish that 6× is false over some other comparison. It cannot be certified as a measured, fully specified ratio for this pair.

Evidence: `K/docs/proposals/41-builder-speed.md:10,24–30`; E/prompts.md:86; E/anatomy.md:144; E/figures.md:18.

Replacement for the output-volume sentence:

> Proposal 41 reported 4.2–4.8× as many builder output tokens as direct work (MEASURED as archived). Its explicit medium comparison, FM-9 versus V-1, recorded about 295k versus 35k unit-test characters and 88k versus 12k browser-spec characters. Those give about 8.4× and 7.3× respectively (DERIVED from rounded measurements for one pair). The archive summary also says roughly 6× browser-spec text without identifying the inputs for that figure.

### S6 · SHOULD FIX · EN 168–170, 230–232 — specify which arms get the new prompts

The corrected prompt bodies match byte for byte. The surrounding direction “use … for the bounded shadow” can also apply them to baseline A or to prompt-only A. The builder’s `candidate ready` and reviewer’s `needs repair` are not valid v2 enum values. The proposed builder’s indicative file list and the reviewer’s scratch-only probes also differ from A’s existing policy. A translation layer or wider privileges in the prose-only arm would test a second intervention and could manufacture a failure. This is an assignment/transport defect in the experiment instructions, not a defect in the corrected prompt bodies.

Evidence: EN 147, 170, 182, 190, 207–209, 232; E/redteam.md:74,99–107,113,125,155; `R/units/render.mjs:114–128,132–144`; `R/schemas/report.schema.json:17–24`; `R/schemas/review-report.schema.json:58–65`.

Replacement for the first sentence of EN 170:

> Baseline A and its unchanged replay use the pinned engine’s existing prompts. The direct shadow and any later B adapter can use the two templates below. For prompt-only A, rewrite the wording inside A’s existing brief while retaining the same allowed files, roles, check order and authority, output schemas, verdict vocabulary and transport. Freeze the exact text and packet for each arm before timing. Count any coordinator translation on C or B as a bridge.

### S7 · SHOULD FIX · EN 232–236, 253; ES 52, 55–61 — align the decision and the expanded experiment

The initial A/C diagnostic is consistent. In the expanded design the 9/10 floor applies to B against A. C participates on only four ordinary scopes. ES leaves the arm unnamed, reads as though direct C has ten ordinary opportunities, and allows a switch without mentioning fresh confirmation, protected controls or owner authorization. EN also lacks an explicit next step if C is promising and no adapter is warranted. A private evaluator is not necessarily blind to which arm produced the candidate. E/redteam.md:125,131–139,143 requires separate calibration with clean and materially faulty copies, operator charging, prospective replication, and recording evaluator guesses. E/synthesis.md:165–175 explicitly masks authorship. EN 234 has the two kinds of control, but not blinding to route or calibration of every blocking invariant.

Replacement to append at EN 232–234:

> The 36-execution expanded design applies only if B is worth testing. If C alone is promising, preregister a matched A/C confirmation on fresh eligible work before considering C for that class. Score C only on scopes assigned to C. Mask the route and author from the independent graders, record their guesses, and verify each decision-blocking requirement with clean and materially faulty controls before timing.

Replacement for ES 52:

> Si la sesión directa conserva el trabajo y las órdenes, alcanza la misma comprobación final y te cuesta menos tiempo y esfuerzo, confirma el resultado en encargos nuevos antes de decidir si autorizas su uso habitual en ese tipo de cambio.

Replacement for ES 57–61:

> Primero, el motor y la sesión directa reciben la misma orden aprobada en copias aisladas. Medimos hasta la primera entrega y hasta que un revisor independiente y las mismas comprobaciones la dan por válida. Contamos también cada intervención y cuánto tiempo lleva.
>
> Si hay motivos para probar la versión ligera B, la comparamos con A en 10 encargos ordinarios y 2 casos que deben mantener su protección. En 4 de los ordinarios probamos también la sesión directa, A con instrucciones más claras y A sin cambios por segunda vez.
>
> Para B proponemos, como criterio estimado, completar al menos 9 de 10 y tantos como A. La reducción mediana por encargo debe ser al menos del 30 % hasta la primera versión y del 20 % hasta la misma comprobación final, sin más rescates tuyos ni peores demoras entre los casos más lentos.
>
> Comprobamos que el revisor reconoce tanto trabajos correctos como fallos importantes sin saber qué ruta los produjo. Si se pierde trabajo, se acepta un fallo importante o se pasa por alto una protección, descartamos esa versión.
>
> Si la diferencia es dudosa, seguimos con A. Un resultado favorable exige confirmación con encargos nuevos antes de que tú decidas cambiar la forma habitual de trabajar.

### N1 · NIT · EN 38 — exit 13 is handled by the current CLI

Calling the handler “Legacy” can be read as a claim about a retired path. The current map returns a landed result, moves the units and separately retains an uncertified landing state on unconfirmed push. The dead-job recovery caveat is correctly conditional. Evidence: `R/land/batch.mjs:15–27`; `R/land/harvest.mjs:52–67,272–277,300–304`.

Replacement:

> The current CLI maps queue exit 13 to a local landed result and can mark units landed while publication remains unconfirmed.

### N2 · NIT · EN 73, 90, 126 — make the class judgments, role denominators and source quotation explicit

The class counts are observations of a coded register, and choosing a primary cause is an estimate. The role-hour totals reconcile but the intervals per role are not interchangeable with the eight-run denominator. The worker quotation drops “in the report” while inserting a full stop inside the quotation marks. Evidence: E/redteam.md:54,72; E/failures.md:190–205; `R/units/render.mjs:121–124`.

Replacement edits, in line order:

> Counts are MEASURED from the register. Assigning each episode a primary class is an ESTIMATED judgment.
>
> Across eight CLI runs, the MEASURED worker envelopes were 4.805 h implementation (19 intervals), 3.058 h documentation (18), 1.323 h in the tests role including failed starts (7), 0.555 h review (4) and 0.681 h repair (6). G2 and G3 together took about 2.16 ESTIMATED job-hours across 45 and 2 file-clock intervals, respectively.
>
> “Record each command's exit code and the output tail in the report.”

### N3 · NIT · ES 14, 23, 67, 69 — explain the queue and use the unit attached to the repeated check

The 112.11 min is the summed command-envelope estimate for all 40 successful jobs on the same inputs, including the first one; the journal harvested 39. It is neither a measured saving nor a measure of the owner’s exclusive wait. “Daba verde”, “cola” and “prompt” can be expressed in ordinary language. “Prompt” is the owner’s own word; introducing it as “instrucciones” is sufficient. No invented Spanish term or em dash was found. Evidence: `K/docs/proposals/44-evidence/timing.md:132`; E/redteam.md:72; EN 16,90,224.

Replacement edits:

> **Estimado.** En otro encargo, las 40 ejecuciones de una misma comprobación, con las mismas entradas y todas satisfactorias, sumaron unos 112,11 min de ejecución. Hay una corrección registrada para ese problema.
>
> El sistema que integra los cambios por turno, la cola, comprueba cada uno junto con la versión principal. Publicar en un proyecto que ya usan personas requiere tu orden.
>
> Sigue abierta la pregunta de cuántos bloqueos se habrían evitado con instrucciones más libres y cuánto tardaría cada ruta hasta la misma entrega.
>
> La propuesta 43 sigue definiendo cuándo está listo un cambio. La cola comprueba el resultado final y tú conservas la orden de publicar.

### N4 · NIT · EN 103–118 — separate clock units from scores, counts and archive ranges

The middle header says “Clock in minutes, MEASURED in archives unless stated”; several numbers in the outcome column are oracle checks, blind-judge points, fixes or interventions. The values line up with the archive; a single header for the table can make their marks and units explicit. EN 108,276 already preserve the F-2/F-3 source discrepancy. Evidence: E/prompts.md:27–46,59–72; E/redteam.md:38–44.

Replacement caption before EN 102:

> This table reports archival observations (MEASURED unless marked ESTIMATED). Times are minutes to the named endpoint. Oracle fractions are checks passed out of checks run, blind scores are judge points, and interventions and subsequent fixes are counts for the named run. The benchmark folders are unavailable for independent rescoring.

## Numeric reconciliation

The author's checker found **173 distinct EN numeric values and 26 ES values MEASURED** after excluding dates, revisions, command identifiers and reference numbers. Its set-membership test cannot catch a number assigned to the wrong arm, unit or denominator. I also read the numbered tables and compared each claim group with the original evidence. Exceptions and proposed policy changes are identified above.

| Lines audited | What reconciled, and how |
|---|---|
| EN 4–8, 34–46 | Dates and versions identify sources. See the independent pinned counts below. The **2–3 / 4–5** clean-path contexts are ESTIMATED scenarios for one FRD with one WO, optional independent tests and two added preparation roles on a new card. They are neither measured stage counts nor necessarily fresh launches (E/anatomy.md:37–46). |
| EN 48–54 | MEASURED archive brief chars 7,127 / 7,146 / 15,531. Dividing task chars 3,412 / 3,412 / 12,180 by each brief gives 47.9 / 47.7 / 78.4% DERIVED. Adding the recovered WO chars 7,104 / 7,104 / 17,394 to the task numerator and dividing by 30,154 / 26,316 / 71,069 gives upper task shares of 34.9 / 40.0 / 41.6% ESTIMATED. Complements are 65.1 / 60.0 / 58.4%. The four first-turn components sum to 56,648 / 56,776 / 64,959 chars MEASURED. Sample is three jobs, one per role. E/anatomy.md:59–73,765–771. |
| EN 22–24, 58–69; ES 9–11 | MEASURED 20 activations inclusive, 19 delivery activations, 18 distinct delivery IDs, 8 scopes, zero documented full-scope engine-only completions, 13 Funko + 6 Mission Control. One converted diagnostic accounts for the difference. Historical handoff reported 6/8 FRDs and 34/48 WOs. Nearest excluded Personal Page case: its accepted Workflow tool result at 04:26:45.966 and terminal notice at 04:43:29.113 differ by 16m 43.147s MEASURED (Claude project file `fd1a71d9*.jsonl:953,1030`; E/failures.md:225). S1 applies to the disposition table; S3 to ES. |
| EN 73–90; ES 11,14 | Raw MEASURED register totals 64 rows, 57 CLI + 34 legacy = 91 hits, 90 delivery-coded. All ten primary splits at EN 77–86 reconcile individually. For broader counts 21/19/19/16/4/5/4/3, dividing each by 91 gives 23.08/20.88/20.88/17.58/4.40/5.49/4.40/3.30% DERIVED. Removing the relay diagnostic leaves three adapter/relay hits. Ranked signature counts 13,12,11,9,8,7,6,5,4,3,3,3 match E/failures.md:154–175; rankings overlap the primary classification. Product mismatch N6 is explicitly unresolved. The repeat includes 40 job directories and 39 harvests; 6,726.441/60 = 112.11 min ESTIMATED after rounding. E/redteam.md:52–74 and 44-evidence/timing.md:132. |
| EN 90,94–96; ES 10,13 | Role sums and sample units as in N2. G2/G3 1.972 + 0.190 = 2.162 h ESTIMATED. Removing the 34.26 h administrative tail from 67.153 h leaves 32.89 h MEASURED; 54.953 minus the same tail gives 20.69 h ESTIMATED unmatched. Phase-one timed docs stages 9.172 + 3.696 = 12.868 s MEASURED; the unrounded sum of red-to-integration intervals is about 21m 09s. Source: 44-evidence/funko-case.md:44–50. Exact approval-to-stop 5,377.404 s, first enqueue 1,206.013 s, first green 2,014.604 s and approval-to-push 9,647.200 s. Nine preflight FRDs, no feature-builder dispatch or G3 in the two runs, and four WO files absent at the eventual push all match. S2 gives the other two clock corrections. |
| EN 100–120, 257,276; ES 12 | All 15 historical comparison rows match E/prompts.md:33–46,63–72 at the stated archive endpoints. Includes separate B-1/B-2, B-3/B-4, A-1, A-primes, F-1 through F-7, V-1/V-2, C-1 and FM-1 through FM-10. Direct transcript user-to-last-assistant clocks reproduce at 5.46/2.54 small and 12.06/11.45 medium min; the published broader clocks remain 5.5/2.6 and 12.1/11.5. The 79 vs 93 judge comparison belongs to B-1/A-1, the historical engine range is 93–95, and 151/151 across 16 small runs is a saturated oracle. The medium 285/289 versus 289/289 is four related failed checks, not four independent bugs. FM-3 had zero interventions. C-1’s approximately 132 active min and the 71.5% timing attribution over 20 builder transcripts are ESTIMATED. The aggregate percentage uses a throughput/turn-latency model; rounded source components do not recover an exact attribution. S4–S5 qualify context and output volume. |
| EN 126,130–139; ES 67–69 | The quoted cap of three fix cycles exists in `R/units/render.mjs:122`. Vendor dates/model identifiers at EN 134–137 match E/prompts.md:156–163 and are marked EXTERNAL. They do not provide a Pandacorp time or success-rate estimate. Proposal numbers 39–44 and decisions, candidate IDs, risk labels, source SHA prefixes and the gate exit 13 are identifiers. |
| EN 228–247; ES 55–61 | All allocation sizes and thresholds are ESTIMATED policy. 2+3+3+2 = 10 ordinary scopes. With 2 protected controls, 2 × 12 + 3 × 4 = 36 executions only in the conditional A/B expanded design, excluding starter, drills, repeats for invalid fixtures and future confirmation. 9/10, 30%, 20%, 120/240 min and the no-worse-p90 requirement are decision rules. The source gives small/coupled caps; allocating them to UI/bug/protected is the memo’s proposed choice (E/figures.md:21), not an empirical limit. With zero misses, 100 × (1 − 0.05^(1/n)) gives 25.9% at n=10 and 77.6% at n=2 under the stated independent-trials assumption. These are illustrative ESTIMATED one-sided 95% bounds. E/synthesis.md:165–181 and E/redteam.md:129–139. S7 resolves the ES scope and arm. |

## Independent checks against the real system

The following are observations from pinned code, Git, local installation files, transcripts or retained project logs. Command: `python3 -B work/verify_45_independent.py`. The unchanged read-only verification scripts listed below furnish additional checks. All counts in this table are MEASURED except where explicitly marked.

| Check | Result and source |
|---|---|
| Runtime and skill size | `git ls-tree -r --name-only 3105fd55` followed by `git show 3105fd55:<path>` and physical line counting: runtime **166 / 19,371**, schemas **14 / 3,435**, CLI **1 / 421**, skill and references **7 / 824** (files / lines). Excludes shared helpers and release scripts. |
| Calendar-window churn | `git -C K log 3105fd55 --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%H -- plugin/runtime/build plugin/skills/implement` gives **104** commits. Separate path histories give **63 / 62**; the two halves of the date window have **7 / 41** scoped fix subjects, **48** total. The version-history records separately list **130 / 75** plugin/overlay version changes, relative to first parent; they are not engine rewrite counts (E/anatomy.md:412–450,588). |
| Stages and roles | **Three** gate tiers in code: unit G1 (`R/report.mjs:171–195,285–311`), integrated-feature G2 (`R/next/g2.mjs:58–78`, `R/next/harvest.mjs:238–251`), and queue G3 (`R/land/command.mjs:77–139`). EN 34–38 groups the lifecycle into **five editorial rows**; E/anatomy.md:11–30 uses **18 editorial trace steps**. Neither describes a fixed number of worker launches. **Eight** role names are obtained from `R/next/constants.mjs:48–54` including docs overrides. Build/patch both map to implementer; backend-dev/frontend-dev are outside that map. |
| Commands, routing and machine state | Static CLI command keys plus separately parsed `start` give **26** command names, **4** start modes. **7** detect rows, **3** size values, **8** unit kinds, **9/16/3** run/unit/job states, **4** landing values, **43** journal event types. `K/plugin/scripts/pandacorp-build.mjs:44–88,394–399`; `R/detect.mjs:33–36`; `R/state.mjs:13–25`; `R/schemas/journal-event.schema.json:29–74`. |
| Worker contracts and patch | The output schemas used for report, review, rescue and doubt have **12/9/4/5** root required fields. Recursively counting enum/const objects without a type gives **7/9/3/4 → 0/0/0/0**, or **23 → 0**. `git -C K show --stat --oneline 3105fd55` gives **6 files**: four schemas, a regression script, and the decision log. It does not change type generation or package metadata. No regression script was executed. Routes: `R/next/dispatch.mjs:314`, `R/rescue.mjs:123`. Installed bytes and actual failed-launch paths are covered in B1. |
| Journal census and ancestry | **8** journals, **939** events, **59** dispatches, **0** batch landed, **2** run finished. Per-run integrated/main-reachable counts **0/0, 1/1, 2/2, 9/9, 4/0, 3/0, 2/0, 1/0**. The exact-SHA result is **12/22** across **3/8** runs by `git -C F merge-base --is-ancestor <integrated.data.sha> cedefd9f`. A negative result does not rule out equivalent rebased code. The eight named journal paths and line anchors are at E/redteam.md:15–24. Of 19 build dispatches, **17 floor, 2 r1, 0 none**, with no touch launch. |
| Legacy denominator | Accepted Workflow calls and journal directories in the original parents yield **5/5** (Funko MVP), **1/1** (MC queue) and **6/5** (MC Órbita). One reused ID and one converted diagnostic explain the difference between inclusive and delivery counts. E/redteam.md:26–32 gives the actual parent location and record numbers. No autonomous-success probability follows. |
| Landing receipt semantics | Current mapping and landing state are separately observable in `R/land/batch.mjs:15–27`, `R/land/harvest.mjs:52–67,167–205,272–284`. The Funko queue distinguishes the original green hold, later red/green on revised SHA, owner order, local fast-forward and confirmed push at `F/.pandacorp/run/queue-log.jsonl:75–120`. No independent deployment observation. |
| Authorship path and data boundary | B2 traces the real initial and later planning calls to the actual tests-first predicate. The builder constraints and the reviewer’s distinct evidence duties are visible in EN 178–190,199–209. The runtime’s protected owner actions are separately specified at `K/plugin/skills/implement/references/autonomy.md:152–172`. |

## Prompt integrity and owner coverage

- Both complete prompt bodies are byte-identical to E/redteam.md:159–176,180–195. MEASURED UTF-8 body sizes are **3,015 and 2,512 bytes**. Builder hash prefix `2c2d7f669cdba0cf`; reviewer `208dd441224cd53b`. No edited-text rationale is needed. The existing historical Spanish benchmark quotation at EN 100 is a third, identified *historical* prompt (E/prompts.md:15–21); it is not an instruction to the shadow worker.
- The builder has a hard workspace boundary, discretionary supporting paths, trusted baseline, fixed test strength and selection, independent oracle disposition, evidence per criterion, honest missing-check reporting and no authority over production, real data, spending or publication. The reviewer has immutable source and writable scratch, fresh checks, independent criterion accounting and a blocked verdict for missing proof. The runner must enforce those permissions. The important ambiguity is which arms use this interface (S6); the real existing-criteria bug case in A needs its own receipt (B2).
- EN and ES both offer A/B/C and recommend **only A**. Both describe an isolated low-risk A/C starter and retain the owner's production order. Neither promises fewer errors at equal delivery, attributes a number of interruptions to freer prose or forecasts savings. Both describe initial delivery speed on the historical examples. ES needs S3 and S7 to convey the same strength of conclusion and promotion rules. The ES file has **69 lines and zero em dashes MEASURED**.
- The owner’s substantive questions are covered: actual lifecycle and worker inputs (EN 30–54); causes and interruptions (56–96); apparent speed of the direct prompt (98–122); which instructions to simplify and which obligations to retain (124–149,172–210); fair evidence of first-pass quality and equal-proof speed, failure, rollback and staged authorization (228–277). Missing from the decision-ready version are the actual installation split, the loss of the bug-card flag on replanning, the corrected time cohorts, the foreign benchmark context, and an arm-specific confirmation rule in the owner’s wording. None supports an immediate live rollout.

## Limitations and acceptance

The original small and medium benchmark project directories are absent (`ls -d /Users/Shared/Proyectos/pandacorp-bench-{form,medium}` returned both missing). I used the archived arm-by-arm ledger, its original proposal tables and surviving transcripts. The raw oracle cannot be regraded. No live launch proves provider acceptance, no observed run quantifies how often B2 affects bug work, and the receipt sample does not independently establish production deployment. The external guidance claims and dates were reconciled against the supplied dated evidence at E/prompts.md:156–163; this is not a fresh vendor evaluation. The small retained CLI cohort does not measure an ordinary work order’s equal-proof speed or give a population success rate.

Acceptance commands, executed from the scratchpad:

- `python3 -B work/verify_redteam_implement.py` → passed the journal/ancestry, legacy activation, register, four direct transcript clocks, WO-tree and source-history checks.
- `python3 -B work/check_proposal45.py /Users/Shared/Proyectos/panda-corp/docs/proposals` → passed archive copies, 145 local links/anchors, body identity, benchmark-row shape, 173 EN / 26 ES distinct numeric values and share arithmetic. These checks pass even with the semantic defects above.
- `python3 -B work/verify_45_independent.py --report` → checks primary inputs, byte-identical prompts, pinned inventory, clock/stratum arithmetic, installed schema copies and the presence of a severity, location and replacement for every review finding.
