"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUrlState } from "@/lib/navigation/useUrlState";

/** DependencyCanvas uses native history; reload the server detail seam when its wo selection moves. */
export function WoNavigationRefresh({ wo }: { wo?: string }): null {
  const [selected] = useUrlState("wo", "");
  const router = useRouter();
  useEffect(() => {
    if (selected !== (wo ?? "")) router.refresh();
  }, [selected, wo, router]);
  return null;
}
