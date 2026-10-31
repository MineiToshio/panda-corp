import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFullscreen } from "../useFullscreen";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  Reflect.deleteProperty(document, "fullscreenElement");
  Reflect.deleteProperty(document, "exitFullscreen");
});

it("AC-02-015.6: requests within the gesture, tracks native exit, and returns the actual trigger focus", async () => {
  const trigger = document.createElement("button");
  const host = document.createElement("div");
  const inner = document.createElement("button");
  host.append(inner);
  document.body.append(trigger, host);
  const request = vi.fn(async () => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: host });
    document.dispatchEvent(new Event("fullscreenchange"));
  });
  host.requestFullscreen = request;
  const exit = vi.fn(async () => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    document.dispatchEvent(new Event("fullscreenchange"));
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  const ref = { current: host };
  const { result } = renderHook(() => useFullscreen(ref));
  trigger.focus();
  act(() => result.current.toggle());
  expect(request).toHaveBeenCalledOnce();
  expect(result.current.isFullscreen).toBe(true);
  expect(inner).toHaveFocus();
  await act(async () => exit());
  expect(result.current.isFullscreen).toBe(false);
  expect(trigger).toHaveFocus();
});
