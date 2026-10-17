"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Normalize defaults and legacy aliases without adding an extra history entry. */
export function NavigationCanonical({ href }: { href: string }): null {
  const router = useRouter();
  useEffect(() => {
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== href) router.replace(`${href}${window.location.hash}`, { scroll: false });
  }, [href, router]);
  return null;
}
