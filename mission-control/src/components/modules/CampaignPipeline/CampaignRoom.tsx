"use client";
import { useState } from "react";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { PhaseDefinition } from "./phases";
import { RoamingCast } from "./RoamingCast";
export type PhaseState = "done" | "current" | "locked";
/** Human-readable state by phase position, independent from the selected sheet. */
export function phaseState(index: number, active: number): PhaseState {
  return index < active ? "done" : index === active ? "current" : "locked";
}
/** Localized state words also accompany every room's colour. */
export function stateLabel(state: PhaseState): string {
  return t(
    state === "done"
      ? "idea.campaign.roomState.delivered"
      : state === "current"
        ? "idea.campaign.roomState.current"
        : "idea.campaign.roomState.waiting",
  );
}
const ZONES = ["research", "review", "frontend", "architecture", "build-hall", "release"];
interface RoomProps {
  phase: PhaseDefinition;
  index: number;
  active: number;
  selected: boolean;
  tone: Tone;
  running: boolean;
  onSelect: () => void;
}
/** One selectable journey room, with original room art and its whole cast. */
export function CampaignRoom({
  phase,
  index,
  active,
  selected,
  tone,
  running,
  onSelect,
}: RoomProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const state = phaseState(index, active);
  return (
    <button
      type="button"
      className={`room is-${state} ${selected ? "is-sel" : ""}`}
      data-phase={phase.key}
      data-tone={tone}
      data-state={state}
      data-testid={`campaign-phase-${phase.key}`}
      data-phase-state={state}
      aria-pressed={selected}
      aria-label={t("idea.campaign.roomAria", {
        index: index + 1,
        name: phase.name,
        state: stateLabel(state),
      })}
      onClick={onSelect}
    >
      {!failed && (
        <>
          {/* biome-ignore lint/performance/noImgElement: preserve the original pixel room art */}
          <img
            src={`/prototype/assets/zones/${ZONES[index]}.png`}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </>
      )}
      <RoamingCast members={phase.team} state={state} phase={phase.key} running={running} />
      <span className="room-name">
        <span className="room-dot" />
        {index + 1} · {phase.name}
      </span>
      <span className="room-state chip">{stateLabel(state)}</span>
    </button>
  );
}
