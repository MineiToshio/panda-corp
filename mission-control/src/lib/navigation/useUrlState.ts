"use client";

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { commitNavigationHref, NAVIGATION_EVENT } from "./history";
import { type NavigationPatch, navigationHref, parseNavigationUrl } from "./urls";

const NavigationSeed = createContext("/");

/** Supply the server's exact route during hydration without duplicating view state. */
export function NavigationSeedProvider({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): React.JSX.Element {
  return createElement(NavigationSeed.Provider, { value: href }, children);
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  window.addEventListener(NAVIGATION_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(NAVIGATION_EVENT, listener);
  };
}
function currentHref(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/** Commit one atomic, reversible URL transition for client-owned view selections. */
export function updateNavigation(patch: NavigationPatch, options?: { replace?: boolean }): void {
  const current = currentHref();
  const next = navigationHref(current, patch);
  if (next === current) return;
  commitNavigationHref(next, options);
}

/** Read a view selection from the URL and update it with native history semantics. */
export function useUrlState(
  key: string,
  fallback: string,
): [string, (value: string | ((previous: string) => string), replace?: boolean) => void] {
  const seed = useContext(NavigationSeed);
  const href = useSyncExternalStore(subscribe, currentHref, () => seed);
  const value = parseNavigationUrl(href)[key] ?? fallback;
  const setValue = useCallback(
    (next: string | ((previous: string) => string), replace?: boolean): void => {
      const previous = parseNavigationUrl(currentHref())[key] ?? fallback;
      updateNavigation({ [key]: typeof next === "function" ? next(previous) : next }, { replace });
    },
    [key, fallback],
  );
  return [value, setValue];
}

/** Normalize root defaults with replace while leaving explicit descendant locations intact. */
export function useCanonicalSelection(family: string, key: string, value: string): void {
  useEffect(() => {
    if (window.location.pathname === `/${family}`)
      updateNavigation({ [key]: value }, { replace: true });
  }, [family, key, value]);
}

/** Read a search selection; typing always replaces the current history entry. */
export function useUrlSearch(
  key: string,
): [string, (value: string | ((previous: string) => string)) => void] {
  const [value, setValue] = useUrlState(key, "");
  const setSearch = useCallback(
    (next: string | ((previous: string) => string)): void => setValue(next, true),
    [setValue],
  );
  return [value, setSearch];
}
