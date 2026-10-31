import { Card, CardHeader } from "@/components/core/Card/Card";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { BuildModePicker } from "@/components/modules/BuildModePicker/BuildModePicker";
import { t } from "@/lib/copy/copy";
import { workspaceCommands } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";
import { type BuildTarget, BuildTargetPicker } from "./BuildTargetPicker";
import styles from "./commands.module.css";

export interface TabCommandsProps {
  phase: Phase | undefined;
  slug: string;
  nextStep?: { readonly command: string | null; readonly sentence: string | null };
  targets?: readonly BuildTarget[];
}
const PHASE_TONES: Readonly<Record<Phase, Tone>> = {
  product: "blue",
  design: "pink",
  architecture: "violet",
  implementation: "amber",
  release: "green",
};
const CHANGE_STEPS = [
  { key: "requestChange", tone: "pink", command: "/pandacorp:change" },
  { key: "answerDecision", tone: "amber", command: "/pandacorp:decide" },
  { key: "bigPackage", tone: "violet", command: "/pandacorp:new-version" },
] as const;
/** Server-rendered command cards. Only the shared mode and target selectors own browser state. */
export function TabCommands({
  phase,
  slug,
  nextStep,
  targets,
}: TabCommandsProps): React.JSX.Element {
  const phaseRows = phase ? workspaceCommands(phase) : [];
  const rows = phase
    ? [
        ...(nextStep?.command
          ? [{ command: nextStep.command, when: nextStep.sentence ?? "" }]
          : []),
        ...phaseRows,
      ].reduce<typeof phaseRows>((unique, row) => {
        const existing = unique.find((candidate) => candidate.command === row.command);
        if (!existing) unique.push({ ...row });
        else if (!existing.when.trim() && row.when.trim()) existing.when = row.when;
        return unique;
      }, [])
    : [];
  return (
    <section data-testid="tab-commands-body" className={styles.grid}>
      <div className={styles.next}>
        <Card tone={phase ? PHASE_TONES[phase] : "slate"}>
          <CardHeader title={t("workspace.comandos.nextStep.title")} icon="arrow" />
          {rows.length ? (
            rows.map((row) => (
              <div key={row.command} className={styles.step}>
                {row.when.trim() ? <p>{row.when}</p> : null}
                <CmdRow variant="box" command={row.command} />
              </div>
            ))
          ) : (
            <p>{t("workspace.comandos.nextStep.empty")}</p>
          )}
        </Card>
      </div>
      <div className={styles.mode}>
        <Card tone="violet">
          <CardHeader title={t("workspace.comandos.buildMode.title")} icon="bolt" />
          <div data-testid="mode-selector-slot">
            <BuildModePicker project={slug} />
          </div>
        </Card>
      </div>
      <div className={styles.target}>
        <Card tone="teal">
          <CardHeader title={t("workspace.comandos.target.title")} icon="target" />
          <BuildTargetPicker key={slug} targets={targets} />
        </Card>
      </div>
      <div className={styles.changes}>
        <Card tone="pink">
          <CardHeader title={t("workspace.comandos.changesAndDecisions.title")} icon="sparkles" />
          {CHANGE_STEPS.map((step) => (
            <div key={step.key} className={styles.step} data-tone={step.tone}>
              <p>{t(`workspace.comandos.changesAndDecisions.${step.key}`)}</p>
              <CmdRow variant="box" tone={step.tone} command={step.command} />
            </div>
          ))}
          <p className={styles.note}>{t("workspace.comandos.changesAndDecisions.note")}</p>
        </Card>
      </div>
    </section>
  );
}
