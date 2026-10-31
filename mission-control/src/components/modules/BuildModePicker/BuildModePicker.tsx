"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Toast } from "@/components/core/Toast/Toast";
import { getRememberedMode, rememberMode } from "@/lib/build-mode-store";
import { BUILD_MODES, type BuildMode, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import { BuildModeCard, MODE_PRESENTATION } from "./BuildModeCard";
import styles from "./BuildModePicker.module.css";

const CHANGE_EVENT = "mc:build-mode-change";
function subscribe(onChange: (event: Event) => void): () => void {
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

/** Project preference scope and notification of the active session choice. */
export interface BuildModePickerProps {
  readonly project?: string;
  readonly onModeChange?: (mode: BuildMode) => void;
}

/** Browser-only preference, shared by the campaign and commands surfaces. */
export function BuildModePicker({ project, onModeChange }: BuildModePickerProps) {
  const [copyResult, setCopyResult] = useState<boolean | null>(null);
  const remembered = useSyncExternalStore(
    subscribe,
    () => (project ? getRememberedMode(project) : DEFAULT_BUILD_MODE),
    serverSnapshot,
  );
  const [sessionModes, setSessionModes] = useState<Readonly<Record<string, BuildMode>>>({});
  useEffect(() => {
    function handleSessionChange(event: Event): void {
      if (event instanceof CustomEvent) {
        const { project: changedProject, mode } = event.detail;
        setSessionModes((current) => ({ ...current, [changedProject]: mode }));
      } else if (event instanceof StorageEvent) {
        const key = event.key;
        if (key !== null && !key.startsWith("mc:build-mode:")) return;
        setSessionModes((current) => {
          if (key === null) return {};
          const next = { ...current };
          delete next[key.slice("mc:build-mode:".length)];
          return next;
        });
      }
    }
    return subscribe(handleSessionChange);
  }, []);
  const sessionKey = project ?? "";
  const mode = Object.hasOwn(sessionModes, sessionKey) ? sessionModes[sessionKey] : remembered;
  const selected = BUILD_MODES.find((item) => item.id === mode);
  if (!selected) throw new Error(`Missing build mode command: ${mode}`);
  function handleSelect(next: BuildMode): void {
    setSessionModes((current) => ({ ...current, [sessionKey]: next }));
    if (project) {
      rememberMode(project, next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { project, mode: next } }));
    }
    onModeChange?.(next);
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
          key={selected.command}
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
