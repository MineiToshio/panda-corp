"use client";

import { useState } from "react";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import type { Tone } from "@/components/core/Chip/vocabulary";
import styles from "./Avatar.module.css";

export const SPRITE_MAP: Record<AgentRole, string> = {
  researcher: "/prototype/assets/agents/researcher.png",
  "backend-dev": "/prototype/assets/agents/backend-dev.png",
  "frontend-dev": "/prototype/assets/agents/frontend-dev.png",
  "test-writer": "/prototype/assets/agents/test-writer.png",
  reviewer: "/prototype/assets/agents/reviewer.png",
  "security-auditor": "/prototype/assets/agents/security-auditor.png",
  architect: "/prototype/assets/agents/architect.png",
  "product-manager": "/prototype/assets/agents/product-manager.png",
  designer: "/prototype/assets/agents/designer.png",
  // Roles added 2026-06-18 (Party redesign — party-redesign-spec.md §2)
  // Sprites reuse nearest-role art until dedicated assets are created.
  implementer: "/prototype/assets/agents/backend-dev.png",
  copywriter: "/prototype/assets/agents/designer.png",
  analytics: "/prototype/assets/agents/analytics.png",
  devops: "/prototype/assets/agents/security-auditor.png",
};

/** Tokenized project/agent avatar size. */
export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  agentId?: AgentRole;
  size?: AvatarSize;
  "data-testid-suffix"?: string;
  /** Project name used for initials and accessible identity. */
  name?: string;
  initials?: string;
  label?: string;
  tone?: Tone;
}

/** Two letters per name; a single CamelCase word uses its capitals so PandaSaga and PandaCast differ. */
function initialsOf(identity: string): string {
  const words = identity.split(/[\s-]+/).filter(Boolean);
  const source =
    words.length > 1
      ? words.map((word) => word.charAt(0))
      : (identity.match(/\p{Lu}/gu) ?? [identity]);
  return source.join("").slice(0, 2).toUpperCase();
}

/** Project initials tile or pixelated agent sprite; missing images fall back to initials. */
export function Avatar({
  agentId,
  name,
  initials,
  label,
  tone = "slate",
  size,
  "data-testid-suffix": suffix,
}: AvatarProps): React.JSX.Element {
  const [failedSrc, setFailedSrc] = useState<string>();
  const spriteSrc = agentId && Object.hasOwn(SPRITE_MAP, agentId) ? SPRITE_MAP[agentId] : undefined;
  const identity = name ?? agentId ?? initials ?? "";
  const letters = initials ?? initialsOf(identity);
  const resolvedSize = size ?? (agentId ? "sm" : "md");
  function handleImageError(): void {
    setFailedSrc(spriteSrc);
  }
  return (
    <div
      className={`pav ${styles.avatar}`}
      data-testid={agentId ? "agent-avatar" : "project-avatar"}
      data-role={agentId}
      data-tone={tone}
      data-size={resolvedSize}
      data-suffix={suffix}
      aria-label={label ?? (agentId ? `Avatar de agente ${agentId}` : identity)}
      role="img"
    >
      {spriteSrc && failedSrc !== spriteSrc ? (
        // biome-ignore lint/performance/noImgElement: local pixel-art sprites retain pixelated rendering
        <img
          src={spriteSrc}
          alt={`Sprite de ${agentId}`}
          data-testid="agent-avatar-img"
          onError={handleImageError}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            display: "block",
          }}
        />
      ) : (
        <span data-testid={agentId ? "agent-avatar-placeholder" : undefined} aria-hidden="true">
          {letters}
        </span>
      )}
    </div>
  );
}
