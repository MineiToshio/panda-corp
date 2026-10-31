"use client";
import { useState } from "react";
import type { PhaseTeamMember } from "./phases";

const SPRITES: Readonly<Record<string, string>> = { implementer: "frontend-dev" };
/** Decorative original pixel sprite; failed assets disappear while text identity remains. */
export function TeamSprite({
  role,
  className,
}: {
  role: string;
  className?: string;
}): React.JSX.Element | null {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const sprite = SPRITES[role] ?? role;
  return (
    // biome-ignore lint/performance/noImgElement: original pixel art is displayed without resampling
    <img
      className={className}
      src={`/prototype/assets/agents/${sprite}.png`}
      alt=""
      width={56}
      height={56}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
/** Full specialist identity and one-sentence responsibility. */
export function TeamMember({ member }: { member: PhaseTeamMember }): React.JSX.Element {
  return (
    <div className="tmember" data-testid="ficha-team-member">
      <span className="tm-stage">
        <TeamSprite role={member.role} />
      </span>
      <div>
        <b>{member.label}</b>
        <span className="tm-role">{member.role}</span>
        <p>{member.what}</p>
      </div>
    </div>
  );
}
