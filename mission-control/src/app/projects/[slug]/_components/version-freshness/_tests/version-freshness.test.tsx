import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OverlayFreshnessState } from "@/lib/overlay-freshness/overlay-freshness";
import { VersionFreshness } from "../version-freshness";

const state: OverlayFreshnessState = {
  reason: "behind",
  projectVersion: "8.1.0",
  factoryVersion: "9.2.0",
  detail: "legacy detail",
  upgradeCommand: "/pandacorp:upgrade",
};
describe("upgrade notice", () => {
  it("AC-20-001.1 AC-20-002.1 AC-20-002.2 AC-20-004.1: behind names both versions and the folder, with copy only", () => {
    render(<VersionFreshness state={state} projectName="Project name" />);
    const notice = screen.getByRole("region", { name: "Actualización pendiente" });
    expect(notice).toHaveTextContent("Este proyecto usa una versión vieja del motor de Pandacorp");
    expect(notice).toHaveTextContent("v8.1.0");
    expect(notice).toHaveTextContent("v9.2.0");
    expect(notice).toHaveTextContent("Córrelo en la carpeta de Project name");
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:upgrade" })).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: /ejecutar/i })).toBeNull();
  });
  it.each([
    "up-to-date",
    "unknown",
  ] as const)("AC-20-001.2 AC-20-001.3: %s renders nothing", (reason) => {
    const { container } = render(
      <VersionFreshness state={{ ...state, reason }} projectName="Project" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
