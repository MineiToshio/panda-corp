import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useCanonicalSelection, useUrlSearch } from "../useUrlState";

it("AC-25-003.1: search and root defaults replace history, functional updates read live state", () => {
  window.history.replaceState(null, "", "/board");
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  const hook = renderHook(() => useUrlSearch("boardQuery"));
  act(() => {
    hook.result.current[1]("a");
    hook.result.current[1]((previous) => `${previous}b`);
  });
  expect(hook.result.current[0]).toBe("ab");
  expect(push).not.toHaveBeenCalled();
  expect(replace).toHaveBeenCalledTimes(2);
  hook.unmount();
  window.history.replaceState(null, "", "/manual");
  renderHook(() => useCanonicalSelection("manual", "manualGroup", "guides"));
  expect(window.location.pathname).toBe("/manual/guides");
  expect(push).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
