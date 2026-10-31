"use client";
import { useEffect, useRef } from "react";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import { useBackgroundRefresh } from "@/lib/navigation/NavigationProvider";
import { stateVersionMoved } from "@/lib/status/state-version-moved";
export interface WoLiveRefreshProps {
  project: string;
}
const REFRESH_INTERVAL_MS = 5000;
/** One event-driven subscriber; fresh events and backward machine-state moves coalesce at five seconds. */
export function WoLiveRefresh({ project }: WoLiveRefreshProps): React.JSX.Element {
  const requestRefresh = useBackgroundRefresh(),
    { snapshot, lastEventAt } = useLiveSnapshot({ project });
  const event = useRef<number | null>(null),
    version = useRef<number | null>(null),
    lastRefresh = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const at = lastEventAt === null ? NaN : Date.parse(lastEventAt);
    const fresh = Number.isFinite(at) && stateVersionMoved(at, event);
    const moved = stateVersionMoved(snapshot?.stateVersion, version);
    if (!fresh && !moved) return;
    const elapsed =
      lastRefresh.current === null ? REFRESH_INTERVAL_MS : Date.now() - lastRefresh.current;
    function refresh() {
      timer.current = null;
      lastRefresh.current = Date.now();
      requestRefresh();
    }
    if (elapsed >= REFRESH_INTERVAL_MS) refresh();
    else if (timer.current === null)
      timer.current = setTimeout(refresh, REFRESH_INTERVAL_MS - elapsed);
  }, [lastEventAt, snapshot, requestRefresh]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return <span data-testid="wo-live-refresh" aria-hidden="true" style={{ display: "none" }} />;
}
