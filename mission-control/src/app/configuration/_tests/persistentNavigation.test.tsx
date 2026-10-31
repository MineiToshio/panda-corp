import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import { ConfigurationShell } from "../ConfigurationShell";

const catalogs: ConfigurationCatalogs = {
  skills: { ok: true, data: [] },
  agents: { ok: true, data: [] },
  rules: { ok: true, data: [] },
  standards: {
    ok: true,
    data: [
      {
        id: "quality.md",
        title: "Quality",
        body: "Full quality body",
        domain: "Quality",
        severity: "MUST",
        enforcement: "CI",
        summary: [],
      },
    ],
  },
  counts: {
    skills: 0,
    agents: 0,
    rules: 0,
    standards: 1,
    owner: 0,
    internal: 0,
    tiers: { opus: 0, sonnet: 0, haiku: 0, unknown: 0 },
    human: 0,
    auto: 0,
    must: 1,
    should: 0,
  },
  domains: [{ domain: "Quality", count: 1 }],
  ownerCommands: [],
  skillsByAgent: {},
};
afterEach(cleanup);
it("AC-25-001.1 AC-25-002.1 restores standard dialog and combined URL filters after remount and history navigation", () => {
  window.history.replaceState(
    null,
    "",
    "/configuration/standards/quality.md?severity=MUST&domain=Quality&q=quality",
  );
  const view = render(<ConfigurationShell catalogs={catalogs} />);
  expect(screen.getByRole("dialog", { name: "Quality" })).toHaveTextContent("Full quality body");
  expect(screen.getByRole("searchbox")).toHaveValue("quality");
  expect(screen.getByRole("combobox")).toHaveValue("Quality");
  view.unmount();
  render(<ConfigurationShell catalogs={catalogs} />);
  expect(screen.getByRole("dialog", { name: "Quality" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
  expect(window.location.pathname).toBe("/configuration/standards");
  act(() => {
    window.history.replaceState(null, "", "/configuration/standards/quality.md");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByRole("dialog", { name: "Quality" })).toBeInTheDocument();
});
