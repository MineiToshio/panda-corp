import { useId } from "react";
import { IconButton } from "@/components/core/Button/IconButton";
import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { BuildModePicker } from "@/components/modules/BuildModePicker/BuildModePicker";
import { t } from "@/lib/copy/copy";
import { phaseState, stateLabel } from "./CampaignRoom";
import styles from "./PhaseSheet.module.css";
import { PHASES, type PhaseDefinition } from "./phases";
import { TeamMember } from "./TeamMember";

interface SheetProps {
  selected: number;
  active: number;
  slug: string;
  project?: string;
  tone: Tone;
  forgeHref?: string;
  onSelect: (index: number) => void;
}
function Command({
  entry,
  slug,
  project,
}: {
  entry: PhaseDefinition["commands"][number];
  slug: string;
  project?: string;
}): React.JSX.Element {
  const command = entry.command.replaceAll("<idea>", () => slug);
  const implement = command === "/pandacorp:implement";
  return (
    <div className="ps-mode" data-testid="ficha-command">
      <CmdRow command={command} variant="box" copyLabel={t("common.copy.command", { command })} />
      {entry.modes && (
        <details>
          <summary>{implement ? t("idea.campaign.sheet.chooseMode") : entry.modeTitle}</summary>
          {entry.hint && <p>{entry.hint}</p>}
          {implement ? (
            <BuildModePicker project={project} />
          ) : (
            entry.modes.map((mode) => (
              <div className="ps-mode" key={mode.flag}>
                <p>
                  <b>{mode.label}</b> · {mode.hint}
                </p>
                <CmdRow
                  command={`${command} ${mode.flag}`}
                  variant="box"
                  copyLabel={t("common.copy.command", { command: `${command} ${mode.flag}` })}
                />
              </div>
            ))
          )}
        </details>
      )}
    </div>
  );
}

/** Pinned phase information remains readable even before a phase is reached. */
export function PhaseSheet({
  selected,
  active,
  slug,
  project,
  tone,
  forgeHref,
  onSelect,
}: SheetProps): React.JSX.Element {
  const id = useId();
  const phase = PHASES[selected] ?? PHASES[0];
  if (!phase) throw new Error("Campaign phase catalog is empty");
  const [first, ...rest] = phase.commands;
  const previous = PHASES[selected - 1];
  const next = PHASES[selected + 1];
  return (
    <section
      className={`phase-sheet ${styles.sheet}`}
      data-testid="campaign-phase-ficha"
      data-tone={tone}
      aria-labelledby={id}
    >
      <header className="ps-head" data-testid="ficha-header">
        <span className="ps-num">{selected + 1}</span>
        <div className="grow">
          <p className="ps-kicker">
            {t("idea.campaign.sheet.kicker", { index: selected + 1, total: 6 })}
          </p>
          <h3 id={id}>{phase.name}</h3>
        </div>
        <Chip tone={selected < active ? "green" : selected === active ? "blue" : "slate"}>
          {stateLabel(phaseState(selected, active))}
        </Chip>
        <span className="ps-nav">
          {previous && (
            <IconButton
              icon="back"
              label={t("idea.campaign.sheet.previous", { name: previous.name })}
              onClick={() => onSelect(selected - 1)}
            />
          )}
          {next && (
            <IconButton
              icon="arrow"
              label={t("idea.campaign.sheet.next", { name: next.name })}
              onClick={() => onSelect(selected + 1)}
            />
          )}
        </span>
      </header>
      <div className="brow">
        <h4>{t("idea.campaign.sheet.description")}</h4>
        <p data-testid="ficha-description">{phase.description}</p>
      </div>
      <div className="brow">
        <h4>{t("idea.campaign.sheet.flow")}</h4>
        <div className="ps-flow">
          <div className="ps-io" data-testid="ficha-lee">
            <b>{t("idea.campaign.sheet.reads")}</b>
            <p>{phase.reads}</p>
          </div>
          <span className="ps-arrow" aria-hidden="true">
            →
          </span>
          <div className="ps-io" data-testid="ficha-escribe">
            <b>{t("idea.campaign.sheet.writes")}</b>
            <p>{phase.writes}</p>
          </div>
        </div>
      </div>
      <div className="brow">
        <h4>{t("idea.campaign.sheet.team", { count: phase.team.length })}</h4>
        <div className="team" data-testid="ficha-team">
          {phase.team.map((member) => (
            <TeamMember member={member} key={member.role} />
          ))}
        </div>
      </div>
      <div className="brow">
        <h4>{t("idea.campaign.sheet.commands")}</h4>
        <div className="commands" data-testid="ficha-next-step">
          {first && (
            <div className="ps-next">
              <p className="ps-next-l">
                {t("idea.campaign.sheet.nextStep")}
                {next && t("idea.campaign.sheet.advanceTo", { name: next.name })}
              </p>
              <b>{first.label}</b>
              <Command entry={first} slug={slug} project={project} />
            </div>
          )}
          {rest.length > 0 && (
            <>
              <p className="ps-sub">{t("idea.campaign.sheet.otherOptions")}</p>
              <div className="ps-opts">
                {rest.map((entry) => (
                  <div key={entry.command}>
                    <p>{entry.label}</p>
                    <Command entry={entry} slug={slug} project={project} />
                  </div>
                ))}
              </div>
            </>
          )}
          <p>{t("idea.campaign.sheet.where")}</p>
          {phase.key === "build" && active >= 4 && forgeHref && (
            <a
              className="forge-link btn toned"
              data-testid="ficha-enter-forge"
              data-tone="violet"
              href={forgeHref}
            >
              {t("idea.campaign.sheet.enterForge")}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
