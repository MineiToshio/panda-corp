"use client";

import { useState, useSyncExternalStore } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Toast } from "@/components/core/Toast/Toast";
import { getRememberedMode, rememberMode } from "@/lib/build-mode-store";
import { BUILD_MODES, type BuildMode, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import { BuildModeCard, MODE_PRESENTATION } from "./BuildModeCard";
import styles from "./BuildModePicker.module.css";

const CHANGE_EVENT = "mc:build-mode-change";
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
function serverSnapshot(): BuildMode {
  return DEFAULT_BUILD_MODE;
}

export interface BuildModePickerProps {
  readonly project: string;
  readonly onModeChange?: (mode: BuildMode) => void;
}

/** Browser-only preference, shared by the campaign and commands surfaces. */
export function BuildModePicker({ project, onModeChange }: BuildModePickerProps) {
  const [copyResult, setCopyResult] = useState<boolean | null>(null);
  const mode = useSyncExternalStore(subscribe, () => getRememberedMode(project), serverSnapshot);
  const selected = BUILD_MODES.find((item) => item.id === mode);
  if (!selected) throw new Error(`Missing build mode command: ${mode}`);
  function handleSelect(next: BuildMode): void {
    rememberMode(project, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    onModeChange?.(getRememberedMode(project));
  }
  function dismissToast(): void {
    setCopyResult(null);
  }
  return (
    <div className={styles.picker} data-tone="violet" data-testid="build-mode-picker">
      <p className={styles.intro}>{t("workspace.comandos.buildMode.intro")}</p>
      <fieldset
        className={`mode-grid ${styles.grid}`}
        aria-label={t("workspace.comandos.buildMode.groupAria")}
      >
        {MODE_PRESENTATION.map((item) => (
          <BuildModeCard
            key={item.id}
            mode={item.id}
            pressed={mode === item.id}
            onSelect={handleSelect}
          />
        ))}
      </fieldset>
      <div className={styles.command} data-testid="mode-cmd">
        <CmdRow
          variant="box"
          command={selected.command}
          copyLabel={t("common.copy.command", { command: selected.command })}
          onCopyResult={setCopyResult}
        />
      </div>
      <Toast
        message={t(copyResult ? "states.toast.copied" : "states.toast.clipboardBlocked")}
        visible={copyResult !== null}
        onDismiss={dismissToast}
      />
    </div>
  );
}
