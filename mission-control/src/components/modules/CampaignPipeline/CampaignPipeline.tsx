"use client";
import { PHASE_PRESENTATION } from "@/components/core/Chip/vocabulary";
import type { CampaignPhase } from "@/lib/campaign/campaign";
import { t, tRich } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import styles from "./CampaignPipeline.module.css";
import { CampaignRoom } from "./CampaignRoom";
import { PhaseSheet } from "./PhaseSheet";
import { PHASES } from "./phases";
export interface CampaignPipelineProps {
  slug: string;
  project?: string;
  activePhase: CampaignPhase;
  running?: boolean;
  forgeHref?: string;
}
const PRESENTATION = Object.values(PHASE_PRESENTATION);
const HANDOFF = [
  "idea.campaign.handoff.research",
  "idea.campaign.handoff.product",
  "idea.campaign.handoff.design",
  "idea.campaign.handoff.architecture",
  "idea.campaign.handoff.implementation",
] as const;
/** Read-only journey map with URL-owned selection and a permanently visible phase sheet. */
export function CampaignPipeline({
  slug,
  project,
  activePhase,
  running = false,
  forgeHref,
}: CampaignPipelineProps): React.JSX.Element {
  const [phaseKey, setPhase] = useUrlState("phase", "");
  const requested = PHASES.findIndex((phase) => phase.key === phaseKey);
  const selected = requested < 0 ? activePhase : requested;
  function select(index: number): void {
    const phase = PHASES[index];
    if (phase) setPhase(phase.key);
  }
  return (
    <section
      className={styles.pipeline}
      data-testid="campaign-pipeline"
      aria-label={t("idea.campaign.title")}
    >
      <div className="camp-top">
        <h2>{t("idea.campaign.title")}</h2>
        <p>{t("idea.campaign.hint")}</p>
        <div
          className="camp-progress"
          role="img"
          aria-label={t("idea.campaign.progressAria", {
            done: activePhase,
            total: 6,
            current: PHASES[activePhase]?.name ?? "",
          })}
        >
          {PHASES.map((phase, index) => (
            <span
              key={phase.key}
              className={`cp-seg is-${index < activePhase ? "done" : index === activePhase ? "current" : "locked"}`}
              data-tone={PRESENTATION[index]?.tone}
            />
          ))}
        </div>
        <span>{tRich("idea.campaign.progressLabel", { done: activePhase, total: 6 })}</span>
      </div>
      <fieldset className="map" data-testid="campaign-stage" aria-label={t("idea.campaign.title")}>
        {PHASES.map((phase, index) => (
          <CampaignRoom
            key={phase.key}
            phase={phase}
            index={index}
            active={activePhase}
            selected={selected === index}
            tone={PRESENTATION[index]?.tone ?? "slate"}
            running={running}
            onSelect={() => select(index)}
          />
        ))}
        {HANDOFF.map((key, index) => (
          <span
            key={key}
            className={`corridor ${index < activePhase ? "is-done" : ""}`}
            data-dir={index === 2 ? "d" : index > 2 ? "l" : "r"}
            data-handoff={index}
          >
            <span className="handoff" data-delivered={index < activePhase}>
              {t(key)}
            </span>
          </span>
        ))}
      </fieldset>
      <PhaseSheet
        selected={selected}
        active={activePhase}
        slug={slug}
        project={project}
        tone={PRESENTATION[selected]?.tone ?? "slate"}
        forgeHref={forgeHref}
        onSelect={select}
      />
    </section>
  );
}
