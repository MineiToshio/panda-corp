import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ShellLocation } from "../ShellLocation";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

it.each([
  ["/", "/board", "Tablero", "MISSION CONTROL"],
  ["/portfolio/pandasaga/summary", "/configuration", "Configuración", "MISSION CONTROL"],
  ["/", "/portfolio/pandasaga/architecture", "PandaSaga", "Arquitectura"],
])("hydrates a deferred location after navigation from %s to %s", async (from, to, title, tab) => {
  route.pathname = from;
  const element = (
    <ShellLocation
      projects={[
        { id: "pandasaga", name: "PandaSaga — recuerda historias y descubre sus conexiones" },
      ]}
    />
  );
  const host = document.createElement("div");
  host.innerHTML = renderToString(element);
  route.pathname = to;
  window.history.replaceState(null, "", to);
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(host, element, { onRecoverableError });
    });
    expect(host.textContent).toBe(`${title}${tab}`);
    expect(onRecoverableError).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
  }
});
