"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

/** Keep deferred shell islands route-neutral until their own hydration completes. */
export function useHydratedPathname(): string {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return hydrated ? (pathname ?? "") : "";
}
