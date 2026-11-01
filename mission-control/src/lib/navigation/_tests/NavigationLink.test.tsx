import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { NavigationLink } from "../NavigationLink";
import { NavigationProvider } from "../NavigationProvider";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({
    onNavigate,
    children,
    href,
    replace: _replace,
    scroll: _scroll,
    ...props
  }: ComponentProps<typeof import("next/link").default>) => (
    <a {...props} href={String(href)} onClick={(event) => onNavigate?.(event)}>
      {children}
    </a>
  ),
}));
beforeEach(() => vi.clearAllMocks());

it.each([false, true])("dispatches a link through the shared router with replace=%s", (replace) => {
  render(
    <NavigationProvider>
      <NavigationLink
        href="/portfolio/example/spec"
        replace={replace}
        scroll={false}
        aria-label="Open spec"
      >
        Spec
      </NavigationLink>
    </NavigationProvider>,
  );
  const link = screen.getByRole("link", { name: "Open spec" });
  expect(link).toHaveAttribute("href", "/portfolio/example/spec");
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  fireEvent(link, event);
  expect(event.defaultPrevented).toBe(true);
  expect(replace ? router.replace : router.push).toHaveBeenCalledExactlyOnceWith(
    "/portfolio/example/spec",
    { scroll: false },
  );
  expect(replace ? router.push : router.replace).not.toHaveBeenCalled();
});

it("also works outside a navigation provider and retains the requested scroll behavior", () => {
  render(
    <NavigationLink href="/manual/guides" scroll>
      Guides
    </NavigationLink>,
  );
  fireEvent.click(screen.getByRole("link", { name: "Guides" }));
  expect(router.push).toHaveBeenCalledExactlyOnceWith("/manual/guides", { scroll: true });
});
