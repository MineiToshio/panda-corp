"use client";
import { useEffect, useState } from "react";
import { Banner } from "@/components/core/Banner/Banner";
import { t, tRich } from "@/lib/copy/copy";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";

import styles from "./plugin-sync-banner.module.css";

const POLL_INTERVAL_MS = 15_000;
const UPDATE_CMD = "claude plugin update pandacorp@panda-corp";
async function readSyncState(signal: AbortSignal): Promise<PluginSyncState | undefined> {
  try {
    const response = await fetch("/api/plugin-sync", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    return response.ok ? ((await response.json()) as PluginSyncState) : undefined;
  } catch {
    return undefined;
  }
}
/** Read-only warning; clears as soon as the installed version catches up or becomes unknown. */
export function PluginSyncBanner(): React.JSX.Element | null {
  const [state, setState] = useState<PluginSyncState | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function poll(): Promise<void> {
      const result = await readSyncState(controller.signal);
      if (active && result !== undefined) setState(result);
    }
    void poll();
    const interval = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);
  const verdict = state?.runtimes
    ? Object.values(state.runtimes).find((runtime) => runtime.drift && runtime.reason === "behind")
    : state;
  if (
    !verdict?.drift ||
    !verdict.installedVersion ||
    !verdict.sourceVersion ||
    verdict.reason !== "behind"
  )
    return null;
  return (
    <section
      data-testid="plugin-sync-banner"
      aria-label={t("inicio.pluginBanner.title")}
      className={styles.banner}
    >
      <Banner
        tone="warn"
        kind="drift"
        icon="alert"
        heading={t("inicio.pluginBanner.title")}
        commandRow={UPDATE_CMD}
      >
        <p>
          {tRich("inicio.pluginBanner.body", {
            installed: verdict.installedVersion,
            source: verdict.sourceVersion,
          })}
        </p>
        <p data-testid="plugin-sync-recall">{t("inicio.pluginBanner.steps")}</p>
      </Banner>
    </section>
  );
}
