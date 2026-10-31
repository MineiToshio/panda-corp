"use client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { BuildSignal } from "@/lib/fragua/build-signal";
import { latestBuildEvent } from "@/lib/fragua/live-events";
import { useBackgroundRefresh } from "@/lib/navigation/NavigationProvider";
import { NO_SIGNAL_TTL_MS } from "@/lib/status/liveness";
import { stateVersionMoved } from "@/lib/status/state-version-moved";
import styles from "./Fragua.module.css";
/** Single project subscription. Events or machine-state movement refresh frontmatter structure. */
export function FraguaLive({
  project,
  signal,
  nowIso,
  children,
}: {
  project: string;
  signal: BuildSignal;
  nowIso: string;
  children: ReactNode;
}): React.JSX.Element {
  const { snapshot } = useLiveSnapshot({ project });
  const refresh = useBackgroundRefresh(),
    version = useRef<number | null>(null),
    lastRefresh = useRef(0),
    pending = useRef(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (signal.kind !== "live" || !signal.lastSignalAt) return;
    const remaining = Math.max(
      0,
      Date.parse(signal.lastSignalAt) + NO_SIGNAL_TTL_MS - Date.parse(nowIso),
    );
    const timer = setTimeout(() => {
      setExpired(true);
      refresh();
    }, remaining);
    return () => clearTimeout(timer);
  }, [signal.kind, signal.lastSignalAt, nowIso, refresh]);
  useEffect(() => {
    if (!snapshot) return;
    const latest = latestBuildEvent(snapshot.events, project);
    const fresh =
      latest !== null && Date.parse(latest) > Date.parse(signal.lastSignalAt ?? "1970-01-01");
    const moved = stateVersionMoved(snapshot.stateVersion, version);
    if (fresh || moved) pending.current = true;
    if (!pending.current) return;
    const delay = Math.max(0, 5000 - (performance.now() - lastRefresh.current));
    const timer = setTimeout(() => {
      pending.current = false;
      lastRefresh.current = performance.now();
      refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [snapshot, project, signal.lastSignalAt, refresh]);
  return (
    <div
      className={`${styles.live} ${signal.kind === "live" && !expired ? styles.active : ""}`}
      data-live={signal.kind === "live" && !expired}
    >
      {children}
    </div>
  );
}
