"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

function searchKey(search: string): string {
  return new URLSearchParams(search).toString();
}

/** Normalize defaults and legacy aliases without adding an extra history entry. */
export function NavigationCanonical({ href }: { href: string }): null {
  const router = useRouter();
  const committed = useRef("");
  committed.current = `${usePathname()}?${useSearchParams()?.toString()}`;
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (`${pathname}${search}` === href) return;
    // A tree that commits after Back or a shallow update must not rewrite the newer URL.
    if (`${pathname}?${searchKey(search)}` !== committed.current) return;
    router.replace(`${href}${hash}`, { scroll: false });
  }, [href, router]);
  return null;
}
