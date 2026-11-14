# Autonomy protocol: "impleméntalo" and the owner leaves for 2-3 hours

Session side of BUILD-12/BUILD-13 (`factory/standards/build-engine.md`); calls are specified in
`plugin/docs/build-engine-cli.md`, `pb <cmd>` as defined in `engine-v2.md` §1. Principle: **the build never stops
whole for one question.** What needs the owner is said in the first minute; what comes up later is answered from the
sources, by a consult to the other company, parked, or left waiting at its gate, and everything else keeps going.

The owner waits **at most one minute** after giving the order. After the first-minute message the session never
asks again and never waits for a reply; later owner contact is notifications, parked questions (§3) and gates (§4).

## 1. The first-minute message

### 1.1 Where the asks come from

Only from `pb start --preflight`: each `checks[]` entry with `status: "ask"` carries a question `{id, text_es,
default_es, default_action, affects, reversible}` with `id` = `q-<check id>`; `need_from_owner[]` lists them in
order. Do not add asks of your own. Map the rest:

| Check status | Goes to |
|---|---|
| `ask` | "Necesito de ti", numbered, in `need_from_owner[]` order |
| `warn` | one line in "Arrancó" under **Avisos** (e.g. "Déjalo enchufado y con la tapa abierta.") |
| `fail` without a question | one line under **Avisos**; the CLI applied its conservative path. Only if `start --run` itself refuses, say why and stop |
| `pass` | nothing |

Asks that exist by design (the CLI owns the text): `scope.doubts`, `scope.summary_citation`, `scope.giant`,
`scope.version`, `conflict.foreign_lease`, `conflict.paused_plus_card`, `conflict.half_cards`, `access.codex_login`
(an expired login only the owner can fix), `access.test_db`, `access.env_pending` (a value only the owner has), and a
pre-push hook the CLI cannot install (tracked `core.hooksPath`). Fable remains disabled. Risk alone governs Astra; author model and attempt do not escalate it.

### 1.2 Defaults (conservative)

Exclude before including; park before guessing when irreversible. Concretely: a point quoted only from a summary
moves to Fuera "por confirmar"; paused run versus conversed scope: conversed first; giant: tranches of 2 FRDs;
`draft` card: built as completed; version-scale scope: not built, said in the message. The units in a question's
`affects` carry `pending_answer`: the CLI dispatches them last, on the default when the question is `reversible`,
and parks them (`owner_question`) when it is not.

### 1.3 Exact shape (Spanish, one message, this order)

```
**Necesito de ti**
1. <text_es>. Si no respondes: <default_es>.
2. ...

**Arrancó**
- Alcance: <scope_lines_es, 4 a 6 líneas>
- Tamaño: <en llano, p. ej. "mediano, 6 tareas en 2 FRDs">
- Construye: <builders>. Revisa: <reviewers>.
- Zona de riesgo: <sí|no> (provisional: la definitiva sale del plan y solo cambia revisor y tests previos)
- Gates previsibles: <gates_foreseen_es o "ninguno">
- Cupo: Claude <pct> %, Codex <pct> % ("desconocido" si no hay lectura)
- Revisiones diferidas pendientes: <deferred_pending>
- Relevo a Codex: <línea de drive.md §2>
- <solo en proyecto lanzado> En proyecto lanzado no toco `main`: el código, los documentos y el estado esperan tu orden.
- Avisos: <warn lines, si hay>

Puedes irte. Te aviso si algo necesita tu firma; el informe estará en Mission Control y aquí.
```

No asks → replace the first block with the single line "No necesito nada de ti.". Every value comes from
`announce{}` and `start --run`; never invent one. No em or en dashes. An ask that is a real choice between
alternatives is written as a compact CONV-20 card inside its numbered item: one context paragraph for a novice, lettered options A/B/C/D with gain and risk, and
"Recomendada: <letter>" with why. The explicit default remains visible.

### 1.4 Later answers: one call

Every owner answer after the first minute (in chat, or through `/pandacorp:decide` while a run is live: record it
too) goes to the live run with:

```
pb answer --epoch <E> --question <id> --value '<json>'
```

| Owner answers | `<id>` | `<json>` | `kind` |
|---|---|---|---|
| a first-minute ask | `q-<check id>` from preflight | the choice its `default_action` implies (boolean, option id string or object) | `ask` |
| a parked question (§3), built-on-assumption included | the doubt id, from `pb status` `open_questions[]` (or `summary`) | the chosen option id, as a JSON string | `parked` |
| a money, deletion or external gate (§4) | `g-<unit>`, from `open_questions[]` with `kind: "gate"` | `true` (OK) or `false` (refused: the CLI hands the unit back, effect `refused`) | `gate` |

Confirm in one Spanish line ("Aplicado: <resumen>. Sigo.") and continue the loop. Put `units[].effect` (for example
`none_default_matches`, `rework_queued`, `assumption_accepted`, `assumption_discarded`) in the final report. Exit 6
(unknown id, a value that does not fit, or the production gate) → re-read `open_questions[]`, retry once with the
right id; never guess. The production gate is never answered with `answer` (§4).

Run not live (it finished, paused or waits for the owner): when the owner writes `/pandacorp:implement --resume`,
run `pb start --resume` first (`engine-v2.md` step 4.2), then the same `answer` call with the new epoch.

## 2. Doubts during the build: the consult ladder

A builder or planner returns `status: "doubt"` (`report` → `outcome: doubt`); a reviewer returns `verdict: "doubt"`
(`review-record` → `verdict: doubt`). The session never answers from its own opinion and never asks the owner.

1. **Open it.** Copy the unit's `doubt` object verbatim into `build/units/<unit>/doubt.json` (transport, no
   edits) and run `pb doubt open --epoch <E> --unit <unit> --file <that doubt.json>` → `doubt_id`, `step`.
2. **`step: sources`** (no consult; skipped by the CLI under drive and in the Codex app). Read, in order: the card's
   Dentro quotes, the FRD and its AC lines, the blueprint, `docs/decision-log.md`, the DRs of
   `factory/decisions/registry.yaml`, `factory/memory/INDEX.md`. Only an explicit statement counts. Write
   `build/doubts/<doubt_id>.sources.json` and run `pb doubt answer --epoch <E> --id <doubt_id> --file <that file>` (no token):
   - a source answers: `{"decision": "<option id>", "rationale": "<path:line>", "consulted": null}`;
   - none does, exactly: `{"decision": null, "rationale": "no source answers", "consulted": null}`.
3. **`step: consult1` / `consult2`.** The CLI picks the consultant (other company at judgment level: Claude origin →
   Codex Sol `high`; Codex origin → Claude Opus `high`; drive or Codex app → Codex Astra `high`; tie-break → the
   strongest not yet consulted, Opus `xhigh` or Astra `high`). The `consult` object in the `doubt` output only
   announces it: **never dispatch from it.** The one channel is a `next` unit with `kind: "doubt-consult"`:
   - `via: "cli"`: the CLI launches it, files the answer and advances the ladder. Nothing to do.
   - `via: "agent"`: launch it as `engine-v2.md` §7 says, `agent_type` `general-purpose`, no unit or token in the
     prompt. Prompt: "Read the brief at `<brief_path>`. Answer only with a JSON object `{decision, rationale,
     confidence, reversible}` (`confidence` one of `high|medium|low`), write it to `<report_path>` and print it as
     your final message." When it returns, write `build/units/<consult unit>/answer.json` = that object plus `"consulted": {"runtime": "<unit
     runtime>", "model": "<unit model>", "effort": "<unit effort>"}` and run `pb doubt answer --epoch <E> --id
     <doubt_id> --file <that file> --token <the consult unit's token>`.
   - The consultant returned no JSON: file exactly `{"decision": null, "rationale": "consultant returned no answer",
     "consulted": <that cell>, "confidence": "low", "reversible": false}` with `doubt answer … --token <the consult unit's token>` (it counts toward the
     cap). Never `handback` a `doubt-consult` unit.
4. **`step: decided`**: done. The CLI decided (consult 1 agrees with the preferred option at confidence ≥ medium, or
   2 of 3 agree at ≥ medium after the tie-break) and wrote the "Decidido sin el owner" entry in the project's
   `docs/decision-log.md` on `lane/<run_id>/integration` (question, options, choice, who advised, confidence, card, commit, how
   to revert) and the `autonomous_decision` journal event. Keep the line for "Decidí sin ti".
5. **`step: parked`**: §3. A doubt whose cap is exhausted also comes back as `parked` (exit 0).

**Caps (enforced by the CLI, never worked around):** at most 3 consult calls per doubt; at most 8 consulted doubts
per build, after which every new doubt parks. Never open a consult the CLI did not hand out.

**Never decided this way (the CLI parks them; the session must not decide them either):** widening scope beyond
Dentro; reducing or reinterpreting a Dentro point; product scope (PRD, epics); DRs with `requiere_humano: true`;
anything irreversible; human gates; spending money. **Irreversibility is not judged by a model**: the CLI's risk
output (`irreversible`: login and session, stored data, deletions, the r1 zone) vetoes the ladder.

## 3. Nobody is sure: park, build on assumption, or stop

The CLI decides which applies; the session reports and notifies.

- **Park** (`parked: owner_question`): that unit and its dependents wait; everything independent keeps building.
  The CLI records the question (id = the doubt id) on the integration branch and mirrors pending questions
  to the untracked `.pandacorp/inbox/decisions.pending.md` where Mission Control can read them. Claude Code: `PushNotification`
  "Aparqué <unidad>: necesito tu decisión. Lo demás sigue.".
- **Built on assumption**: the parked unit drags more than half of the pending work and the preferred option is
  reversible. The CLI builds everything on that option on `lane/<run_id>/assume-<doubt>`, with its gates, **without
  landing**. The owner's answer is `pb answer` kind `parked` (§1.4): the assumed option ("sí") → accepted, the branch
  joins the run and reaches `main` through the normal `land` (in a launched project it still waits for "aterriza");
  another option ("no") → discarded, the units are rebuilt with the answer. Report the branch name.
- **Everything depends on it**: `next` returns `waiting-owner` (already applied: lease released); final report with
  the question on top, notify, stop. The only case in which nothing advances.

## 4. Human gates while the owner is away

A unit reaching production, money, deletion or external communication stops at its gate (`report` outcome
`waiting_gate`, or `land` exit 7); the rest keeps building. Everything before the gate is prepared (branch, reviewed
script, message text) so the owner's OK is one word.

1. Notify at that moment. Claude Code: `PushNotification` "Esperando tu OK: <gate en llano> en <unidad>. Lo demás
   sigue." Codex: say it in the session; drive notifies through macOS. Mission Control shows the banner.
2. **Money, deletion, external communication**: the owner's OK or refusal is `pb answer` kind `gate` (§1.4); the CLI
   releases the unit with the OK in its brief. The session never performs a gated action itself.
3. **Production** (launched project: `phase: release` and `deploy_target` not `internal`; landing on the default
   branch is production, DR-138): the run ends on `lane/<run_id>/integration` with its gates green and waits for "aterriza". The
   question "¿aterrizo?" lists the degraded reviews not yet re-reviewed; landing with some pending is the owner's
   informed choice. Only on the owner's chat order for that landing:
   `PANDACORP_OWNER_RELEASE_OK=1 pb land --epoch <E>` (the variable on that one command only). If the run is not
   live, `pb start --resume` first, then the same `land` with the new epoch. Never through `answer`.
4. Never set `PANDACORP_OWNER_RELEASE_OK` for anything else, never push, never bypass the `pre-push` hook.

## 5. Risk zone without a prior "sí"

The session does not ask for confirmation in the risk zone. The CLI substitutes it: a `tests` unit by a different
agent writes the new AC tests RED before the build (hashed, unchangeable by the builder), one strong reviewer with a
scope lens (a finding when the diff touches Fuera), one security audit per build when the risk output says `audit`,
merge-queue's full gate before `main`. Accepted risk, stated to the owner when the zone is "sí": a misread card can
reach `main` of a project not yet launched (undone with `git revert`); in a launched project `main` waits for the
owner's order.

## 6. What the owner sees on return

The final report (`engine-v2.md` step 6) opens with **Necesito de ti** (parked questions, gates, defaults applied
because nobody answered), then **Decidí sin ti (N)** one line per decision, then **Aparcado**. "Revierte la decisión
X" from the owner becomes a new card (`engine-v2.md` step 1), never a hand revert.

## Shared capacity autonomy (DR-162)

Never ask the owner for quota decisions. The lead ingests Desktop get_usage JSON at startup and before every
wave through `capacity-cli.mjs ingest-claude`; missing tools use the existing account snapshot honestly.
For every new unit/review, the shared allocator chooses a qualified tool and risk floor. When one tool cannot
fit, continue on the other; running units keep their selected tool. Only neither fitting parks capacity at a safe
point with `resumeAt` in state and journal. Image work has only Codex and reports a per-task wait with exit 75.
Automatic wake-up is phase 3. Fresh review context provides independence even with the same model/company.
