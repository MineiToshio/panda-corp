import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  commitNavigationHref,
  isManagedNavigationEntry,
  markNavigationEntry,
  NAVIGATION_EVENT,
} from "../history";
import { updateNavigation, useCanonicalSelection, useUrlState } from "../useUrlState";

afterEach(() => vi.restoreAllMocks());

it.each([
  null,
  "legacy",
  {},
  { missionControlHref: "/old" },
])("does not adopt a foreign or stale history state (%s)", (state) => {
  window.history.replaceState(state, "", "/board?keep=yes#goal");
  expect(isManagedNavigationEntry()).toBe(false);
  markNavigationEntry();
  expect(isManagedNavigationEntry()).toBe(true);
  expect(window.location.href).toContain("/board?keep=yes#goal");
});

it("preserves router metadata when marking an entry and ignores hash-only changes", () => {
  window.history.replaceState({ tree: { router: true } }, "", "/board?keep=yes");
  markNavigationEntry();
  expect(window.history.state.tree).toEqual({ router: true });
  window.history.replaceState(window.history.state, "", "/board?keep=yes#goal");
  expect(isManagedNavigationEntry()).toBe(true);
  window.history.replaceState(window.history.state, "", "/board?keep=no#goal");
  expect(isManagedNavigationEntry()).toBe(false);
});

it("pushes or replaces exactly once and notifies subscribers only after URL and state commit", () => {
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  const seen: boolean[] = [];
  const listener = () => seen.push(isManagedNavigationEntry());
  window.addEventListener(NAVIGATION_EVENT, listener);
  try {
    commitNavigationHref("/board?keep=yes#goal");
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    commitNavigationHref("/manual/guides", { replace: true });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([true, true]);
    expect(window.location.pathname).toBe("/manual/guides");
  } finally {
    window.removeEventListener(NAVIGATION_EVENT, listener);
  }
});

it("reads live URL state, handles popstate and avoids duplicate history entries", () => {
  window.history.replaceState({}, "", "/board?keep=yes#goal");
  const hook = renderHook(() => useUrlState("boardQuery", "fallback"));
  expect(hook.result.current[0]).toBe("fallback");
  const push = vi.spyOn(window.history, "pushState");
  act(() => hook.result.current[1]((previous) => `${previous}!`));
  expect(hook.result.current[0]).toBe("fallback!");
  expect(window.location.hash).toBe("#goal");
  expect(window.location.search).toContain("keep=yes");
  act(() => updateNavigation({ boardQuery: "fallback!" }));
  expect(push).toHaveBeenCalledTimes(1);
  act(() => {
    window.history.replaceState({}, "", "/board?boardQuery=restored");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(hook.result.current[0]).toBe("restored");
  hook.unmount();
});

it("does not canonicalize a descendant location to the root's default selection", () => {
  window.history.replaceState({}, "", "/manual/reference/skills?keep=yes#goal");
  const replace = vi.spyOn(window.history, "replaceState");
  renderHook(() => useCanonicalSelection("manual", "manualGroup", "guides"));
  expect(replace).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/manual/reference/skills");
});
