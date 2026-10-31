"use client";

import { useEffect } from "react";
import { isManagedNavigationEntry, markNavigationEntry } from "./history";

/** Normalize server defaults once without racing a newer client selection or history traversal. */
export function NavigationCanonical({ href }: { href: string }): null {
  useEffect(() => {
    const { pathname, search } = window.location;
    if (isManagedNavigationEntry()) return;
    const source = window.location.href;
    let active = true;
    // Parent passive effects install Next's history bridge after child hydration effects.
    queueMicrotask(() => {
      if (!active || window.location.href !== source || isManagedNavigationEntry()) return;
      if (`${pathname}${search}` === href) markNavigationEntry();
    });
    return () => {
      active = false;
    };
  }, [href]);
  return null;
}
