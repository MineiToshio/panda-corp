"use client";

import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import type { IconName } from "@/components/core/Icon/iconData";
import type { BuildMode } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./BuildModePicker.module.css";

export const MODE_PRESENTATION = [
  { id: "balanced", icon: "layers", power: 2 },
  { id: "pro", icon: "clock", power: 1 },
  { id: "powerful", icon: "bolt", power: 3 },
  { id: "deep", icon: "diamond", power: 4 },
] as const satisfies readonly { id: BuildMode; icon: IconName; power: number }[];

export interface BuildModeCardProps {
  readonly mode: BuildMode;
  readonly pressed: boolean;
  readonly onSelect: (mode: BuildMode) => void;
}

export function BuildModeCard({ mode, pressed, onSelect }: BuildModeCardProps) {
  const presentation = MODE_PRESENTATION.find((item) => item.id === mode);
  if (!presentation) throw new Error(`Unknown build mode: ${mode}`);
  function handleSelect(): void {
    onSelect(mode);
  }
  return (
    <button
      type="button"
      className={`mode ${styles.mode}`}
      data-testid={`build-mode-${mode}`}
      data-mode={mode === "balanced" ? "" : mode}
      aria-pressed={pressed}
      onClick={handleSelect}
    >
      <span className={`mode-top ${styles.top}`}>
        <span className={`mode-ico ${styles.icon}`}>
          <BadgeIcon icon={presentation.icon} tone="violet" size="sm" />
        </span>
        <b>
          {t(`workspace.comandos.buildMode.${mode}.label`)}{" "}
          <span className={`mode-tag ${styles.tag}`}>
            {t(`workspace.comandos.buildMode.${mode}.tag`)}
          </span>
        </b>
      </span>
      <span
        className={`mode-power ${styles.power}`}
        role="img"
        aria-label={t("workspace.comandos.buildMode.powerAria", { power: presentation.power })}
      >
        {[1, 2, 3, 4].map((segment) => (
          <i key={segment} className={segment <= presentation.power ? `on ${styles.on}` : ""} />
        ))}
      </span>
      <small>{t(`workspace.comandos.buildMode.${mode}.hint`)}</small>
    </button>
  );
}
