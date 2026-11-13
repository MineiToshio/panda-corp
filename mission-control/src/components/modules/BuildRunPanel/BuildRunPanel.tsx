import { Card, CardHeader } from "@/components/core/Card/Card";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { FileReadErrors } from "@/components/modules/FileReadErrors/FileReadErrors";
import type { BuildRun, BuildRunUnit } from "@/lib/build-run/types";
import type { DecisionPoint } from "@/lib/docs/activity";
import styles from "./BuildRunPanel.module.css";
import { COPY, GATE, PARKED, RUN_STATUS, UNIT_STATUS } from "./copy";
import { PerformanceView } from "./PerformanceView";

/** Public reader projection only: this component never dispatches or approves work. */
export function BuildRunPanel({
  run,
  decisions = [],
  handbackDrafts = [],
}: {
  readonly run: BuildRun;
  readonly decisions?: readonly DecisionPoint[];
  readonly handbackDrafts?: readonly string[];
}): React.JSX.Element {
  const state = run.state;
  const pending = decisions.filter(
    (decision) => decision.status === "pending" && (state !== null || decision.engineId),
  );
  const references = [
    ...new Set(
      (
        state?.units.flatMap((unit) => (unit.pending_answer ? [unit.pending_answer] : [])) ?? []
      ).filter((id) => !decisions.some((decision) => decision.id === id && decision.resolved)),
    ),
  ];
  return (
    <div className={styles.root}>
      <Card tone="blue">
        <CardHeader title={COPY.title} icon="terminal" />
        <div className={styles.root}>
          <FileReadErrors
            errors={run.errors.map((error) => ({ file: error.path, reason: error.reason }))}
          />
          {!state ? <p>{run.present ? COPY.unknown : COPY.absent}</p> : <RunDetails run={run} />}
          {handbackDrafts.map((file) => (
            <p key={file}>
              {COPY.handback}: <code>{file}</code>
            </p>
          ))}
          <h3>{COPY.questions}</h3>
          {pending.length || references.length ? (
            <ul>
              {pending.map((decision) => (
                <li key={decision.id}>
                  <strong>{decision.title}</strong>
                  {decision.ask && <p>{decision.ask}</p>}
                  <CmdRow command={`/pandacorp:decide ${decision.id}`} />
                </li>
              ))}
              {references
                .filter((id) => !pending.some((decision) => decision.id === id))
                .map((id) => (
                  <li key={id}>
                    <code>{id}</code>
                  </li>
                ))}
            </ul>
          ) : (
            <p>{COPY.noQuestions}</p>
          )}
        </div>
      </Card>
      <PerformanceView records={run.performance} />
    </div>
  );
}
function stamp(value: number | null): string {
  return value === null ? COPY.unknown : new Date(value).toISOString();
}

function RunDetails({ run }: { readonly run: BuildRun }): React.JSX.Element | null {
  const state = run.state;
  const groups = Object.entries(UNIT_STATUS).flatMap(([key, label]) => {
    const units = state?.units.filter((unit) => unit.state === key) ?? [];
    return units.length ? [{ key, label, units }] : [];
  });

  if (!state) return null;
  return (
    <>
      <p>
        <code>{state.run_id}</code> · {RUN_STATUS[state.status]}
        {state.status_reason ? `: ${state.status_reason}` : ""} ·{" "}
        {run.live ? COPY.live : state.status === "active" ? COPY.stale : RUN_STATUS[state.status]}
      </p>
      <p>
        {COPY.branch}: <code>{state.integration.branch}</code>
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>{COPY.liveUnits}</dt>
          <dd>
            {run.live
              ? state.units.filter((unit) => unit.state === "running" || unit.state === "admitted")
                  .length
              : COPY.unknown}
          </dd>
        </div>
        <div>
          <dt>{COPY.step}</dt>
          <dd>{run.admission?.step ?? COPY.unknown}</dd>
        </div>
        <div>
          <dt>{COPY.reason}</dt>
          <dd>
            {run.admission?.diskWaiting ? COPY.disk : (run.admission?.reason ?? COPY.unknown)}
          </dd>
        </div>
      </dl>
      <p className={styles.meta}>{COPY.ceiling}</p>
      {run.admission?.diskWaiting && <p>{COPY.diskWait}</p>}
      <p className={styles.meta}>
        {COPY.stateTime}: {stamp(run.stateMtimeMs)} · {COPY.admissionTime}:{" "}
        {stamp(run.admissionMtimeMs)} · {COPY.stepTime}: {run.admission?.changedAt ?? COPY.unknown}
      </p>
      {state.status === "waiting_gate" && (
        <p>
          {COPY.gate}:{" "}
          {state.units
            .filter((unit) => unit.waiting_gate)
            .map((unit) => (unit.waiting_gate ? GATE[unit.waiting_gate] : ""))
            .join(", ") ||
            state.status_reason ||
            COPY.unknown}
        </p>
      )}
      <h3>{COPY.units}</h3>
      {groups.length ? (
        groups.map((group) => (
          <details key={group.key} open>
            <summary>
              {group.label} ({group.units.length})
            </summary>
            <ul>
              {group.units.map((unit) => (
                <UnitRow key={unit.id} unit={unit} />
              ))}
            </ul>
          </details>
        ))
      ) : (
        <p>{COPY.noUnits}</p>
      )}
    </>
  );
}
function UnitRow({ unit }: { readonly unit: BuildRunUnit }): React.JSX.Element {
  return (
    <li>
      <code>{unit.id}</code> · {unit.kind} · {COPY.attempt} {unit.attempt}
      {unit.wos.length ? ` · ${unit.wos.join(", ")}` : ""}
      {unit.worker && (
        <p>
          {COPY.worker}: {unit.worker.runtime} / {unit.worker.model}
          {unit.worker.effort ? ` / ${unit.worker.effort}` : ""}
        </p>
      )}
      {unit.branch && (
        <p>
          {COPY.branch}: <code>{unit.branch}</code>
        </p>
      )}
      {unit.state === "verified" && <p>{COPY.pendingLanding}</p>}
      {unit.waiting_gate && (
        <p>
          {COPY.gate}: {GATE[unit.waiting_gate]}
        </p>
      )}
      {unit.parked && (
        <p>
          {UNIT_STATUS.parked}: {PARKED[unit.parked]}
        </p>
      )}
      {unit.pending_answer && (
        <p>
          {COPY.questions}: <code>{unit.pending_answer}</code>
        </p>
      )}
    </li>
  );
}
