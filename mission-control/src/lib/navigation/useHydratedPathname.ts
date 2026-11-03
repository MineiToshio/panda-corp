"use client";

import { usePathname } from "next/navigation";
import { useContext, useSyncExternalStore } from "react";
import { InitialPathnameContext } from "./InitialPathnameContext";

function subscribe(): () => void {
  return () => {};
}

/** Hydrate deferred islands against their original HTML, then follow the live route. */
export function useHydratedPathname(): string {
  const pathname = usePathname() ?? "";
  const initial = useContext(InitialPathnameContext) ?? pathname;
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return hydrated ? pathname : initial;
}
