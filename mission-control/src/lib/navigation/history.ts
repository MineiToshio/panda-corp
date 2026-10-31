const NAVIGATION_HREF_KEY = "missionControlHref";
export const NAVIGATION_EVENT = "mission-control:navigation";

function currentHref(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Identify a committed entry independently of hash-only navigation and restored server trees. */
export function isManagedNavigationEntry(): boolean {
  const state: unknown = window.history.state;
  return (
    typeof state === "object" &&
    state !== null &&
    NAVIGATION_HREF_KEY in state &&
    state[NAVIGATION_HREF_KEY] === currentHref()
  );
}

/** Mark an already-canonical entry without renaming it or bypassing Next's URL/tree synchronization. */
export function markNavigationEntry(): void {
  const state: unknown = window.history.state;
  const previous = typeof state === "object" && state !== null ? state : {};
  window.history.replaceState({ ...previous, [NAVIGATION_HREF_KEY]: currentHref() }, "");
}

/** Use Next's patched native history so each entry retains its router restoration metadata. */
export function commitNavigationHref(href: string, options?: { replace?: boolean }): void {
  const url = new URL(href, window.location.href);
  const state = { [NAVIGATION_HREF_KEY]: `${url.pathname}${url.search}` };
  if (options?.replace) window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}
