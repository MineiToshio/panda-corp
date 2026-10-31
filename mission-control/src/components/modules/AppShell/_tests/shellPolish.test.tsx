import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { ShellLocation } from "../ShellLocation";

const route = vi.hoisted(() => ({ pathname: "/portfolio/pandasaga/architecture" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
beforeEach(() => {
  route.pathname = "/portfolio/pandasaga/architecture";
  window.history.replaceState(null, "", route.pathname);
});
it("keeps project identity and tab in the phone title, including native history changes", () => {
  render(
    <ShellLocation
      projects={[
        { id: "pandasaga", name: "PandaSaga — recuerda historias y descubre sus conexiones" },
      ]}
    />,
  );
  expect(screen.getByText("PandaSaga")).toBeInTheDocument();
  expect(screen.getByText("Arquitectura")).toBeInTheDocument();
  act(() => {
    route.pathname = "/portfolio/pandasaga/commands";
    window.history.pushState(null, "", route.pathname);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByText("Comandos")).toBeInTheDocument();
});
it("CamelCase project initials distinguish PandaSaga", () => {
  render(<Avatar name="PandaSaga — recuerda historias y descubre sus conexiones" />);
  expect(
    screen.getByRole("img", { name: "PandaSaga — recuerda historias y descubre sus conexiones" }),
  ).toHaveTextContent("PS");
});

it.each([
  ["work-orders", "Observabilidad"],
  ["party", "Resumen"],
])("labels the legacy %s route by its canonical destination", (tab, label) => {
  route.pathname = `/portfolio/pandasaga/${tab}`;
  window.history.replaceState(null, "", route.pathname);
  render(
    <ShellLocation
      projects={[
        { id: "pandasaga", name: "PandaSaga — recuerda historias y descubre sus conexiones" },
      ]}
    />,
  );
  expect(screen.getByText(label)).toBeInTheDocument();
});

it("keeps an unknown workspace tab localized without exposing its raw id", () => {
  route.pathname = "/portfolio/pandasaga/unrecognized-secret-id";
  window.history.replaceState(null, "", route.pathname);
  render(
    <ShellLocation projects={[{ id: "pandasaga", name: "PandaSaga — recuerda historias" }]} />,
  );
  expect(screen.queryByText("unrecognized-secret-id")).not.toBeInTheDocument();
});
