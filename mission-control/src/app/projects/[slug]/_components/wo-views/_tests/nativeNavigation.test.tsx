import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { updateNavigation } from "@/lib/navigation/useUrlState";
import { WoNavigationRefresh } from "../WoNavigationRefresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  window.history.replaceState({}, "", "/");
});
it("AC-12-006.1 opens the server detail after DependencyMap writes wo through native history", () => {
  render(<WoNavigationRefresh />);
  expect(refresh).not.toHaveBeenCalled();
  act(() => updateNavigation({ wo: "WO-01-003" }));
  expect(refresh).toHaveBeenCalledTimes(1);
});
