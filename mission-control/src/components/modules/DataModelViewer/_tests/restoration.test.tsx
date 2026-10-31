import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useModelExpansion } from "../useModelExpansion";

it("does not replay an expand gesture when history restores expanded=1", () => {
  window.history.replaceState({}, "", "/portfolio/second/architecture");
  const { result } = renderHook(() => useModelExpansion());
  act(() => result.current.open());
  expect(result.current.expanded).toBe(false);
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(result.current.expanded).toBe(false);
  expect(new URL(window.location.href).searchParams.get("expanded")).toBeNull();
  act(() => result.current.open());
  expect(result.current.expanded).toBe(false);
});
