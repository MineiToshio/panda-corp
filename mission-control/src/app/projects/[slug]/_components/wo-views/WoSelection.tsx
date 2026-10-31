"use client";
import { useUrlState } from "@/lib/navigation/useUrlState";

/** The URL decides between detail and views, so Back never waits on a server refresh the router can discard. */
export function WoSelection({
  wo,
  detail,
  views,
}: {
  wo?: string;
  detail: React.ReactNode;
  views: React.ReactNode;
}): React.ReactNode {
  const [selected] = useUrlState("wo", "");
  return selected && selected === wo ? detail : views;
}
