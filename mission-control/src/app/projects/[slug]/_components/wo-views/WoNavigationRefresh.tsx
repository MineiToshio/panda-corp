"use client";
import { useEffect } from "react";
import { useBackgroundRefresh } from "@/lib/navigation/NavigationProvider";
import { useUrlState } from "@/lib/navigation/useUrlState";

/** DependencyCanvas uses native history; reload the server detail seam when its wo selection moves. */
export function WoNavigationRefresh({ wo }: { wo?: string }): null {
  const [selected] = useUrlState("wo", "");
  const refresh = useBackgroundRefresh(
    () => (new URLSearchParams(window.location.search).get("wo") ?? "") !== (wo ?? ""),
  );
  useEffect(() => {
    if (selected !== (wo ?? "")) refresh();
  }, [selected, wo, refresh]);
  return null;
}
