"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import { stateVersionMoved } from "@/lib/status/state-version-moved";
export interface WoLiveRefreshProps {
  project: string;
}
const REFRESH_INTERVAL_MS = 5000;
/** One event-driven subscriber; fresh events and backward machine-state moves coalesce at five seconds. */
export function WoLiveRefresh({ project }: WoLiveRefreshProps): React.JSX.Element {
  const router = useRouter(),
    { snapshot, lastEventAt } = useLiveSnapshot({ project });
  const event = useRef<number | null>(null),
    version = useRef<number | null>(null),
    lastRefresh = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const at = lastEventAt === null ? NaN : Date.parse(lastEventAt);
    const fresh = Number.isFinite(at) && (event.current === null || at > event.current);
    const moved = stateVersionMoved(snapshot?.stateVersion, version);
    if (fresh) event.current = at;
    if (!fresh && !moved) return;
    const elapsed =
      lastRefresh.current === null ? REFRESH_INTERVAL_MS : Date.now() - lastRefresh.current;
    function refresh() {
      timer.current = null;
      lastRefresh.current = Date.now();
      router.refresh();
    }
    if (elapsed >= REFRESH_INTERVAL_MS) refresh();
    else if (timer.current === null)
      timer.current = setTimeout(refresh, REFRESH_INTERVAL_MS - elapsed);
  }, [lastEventAt, snapshot, router]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return <span data-testid="wo-live-refresh" aria-hidden="true" style={{ display: "none" }} />;
}
