import path from "node:path";
import { act, render } from "@testing-library/react";
import { vi } from "vitest";

/** The checked-out factory: a real production-shaped source for the strict catalog readers. */
export const FACTORY_ROOT = path.resolve(__dirname, "../../../../../");

/** Point the readers at the real factory and place the URL before rendering. */
export function useRealFactory(href = "/configuration"): void {
  vi.stubEnv("PANDACORP_FACTORY_ROOT", FACTORY_ROOT);
  visit(href);
}

/** Client-side navigation as `useUrlState` observes it. */
export function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

/** Render the real Server Component, resolved exactly as Next resolves it. */
export async function renderRealPage(): Promise<ReturnType<typeof render>> {
  const { default: ConfigurationPage } = await import("../page");
  return render(await ConfigurationPage({}));
}
