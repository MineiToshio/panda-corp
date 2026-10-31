"use client";
import { useEffect, useRef, useState } from "react";
import type { PhaseTeamMember } from "./phases";
import { TeamSprite } from "./TeamMember";

interface CastProps {
  members: readonly PhaseTeamMember[];
  state: "done" | "current" | "locked";
  running: boolean;
  phase: string;
}
const HOMES: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[50, 52]],
  2: [
    [34, 52],
    [66, 52],
  ],
  4: [
    [30, 34],
    [62, 34],
    [30, 66],
    [62, 66],
  ],
};
/** Transform-only cast motion. Reduced motion stops timers and every decorative animation. */
export function RoamingCast({ members, state, running, phase }: CastProps): React.JSX.Element {
  const homes = HOMES[members.length] ?? HOMES[4] ?? [];
  const castRef = useRef<HTMLSpanElement>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function update(): void {
      setReduced(media.matches);
    }
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (reduced || state !== "current") return;
    const cast = castRef.current;
    if (!cast) return;
    let step = 0;
    let bounds = cast.getBoundingClientRect();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) bounds = entry.contentRect;
          });
    observer?.observe(cast);
    const timer = window.setInterval(() => {
      step += 1;
      const sprites = Array.from(cast.children);
      moveSprites(sprites, step, homes, bounds);
    }, 240);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, [reduced, state, homes]);

  return (
    <span
      ref={castRef}
      className="cast"
      data-testid={`campaign-cast-${phase}`}
      data-motion={reduced || state === "locked" ? "static" : state === "done" ? "idle" : "roaming"}
      aria-hidden="true"
    >
      {members.map((member, index) => {
        const home = homes[index] ?? [50, 52];
        return (
          <span
            className={`cm cm-${state}`}
            data-testid="campaign-sprite"
            data-role={member.role}
            key={member.role}
            style={{ left: `${home[0]}%`, top: `${home[1]}%` }}
          >
            {state === "current" && running && index === 0 && (
              <span className="live-halo" data-testid="campaign-sprite-halo" />
            )}
            <TeamSprite role={member.role} />
            <em>{member.label}</em>
            {state === "current" && running && (
              <span className="live-speech" data-testid="campaign-sprite-speech">
                ···
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function moveSprites(
  sprites: Element[],
  step: number,
  homes: readonly (readonly [number, number])[],
  bounds: Pick<DOMRectReadOnly, "width" | "height">,
): void {
  for (const [index, sprite] of sprites.entries()) {
    if (!(sprite instanceof HTMLElement)) continue;
    const home = homes[index] ?? [50, 52];
    const partner = homes[index % 2 === 0 ? index + 1 : index - 1];
    const meet = step % 16 > 10 && partner !== undefined;
    const dx = meet
      ? ((partner[0] - home[0]) * bounds.width) / 200
      : Math.sin(step / 3 + index) * 8;
    const dy = meet
      ? ((partner[1] - home[1]) * bounds.height) / 200
      : Math.cos(step / 4 + index) * 5;
    sprite.style.transform = `translate(-50%, -60%) translate(${dx}px, ${dy}px)`;
    sprite.dataset.meeting = String(meet);
  }
}
