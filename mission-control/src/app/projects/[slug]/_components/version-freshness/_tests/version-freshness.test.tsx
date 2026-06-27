/**
 * FRD-20 — VersionFreshness (CMP-20-badge).
 *
 * Verifies the three render branches of the Resumen overlay-freshness badge:
 *   - "behind"     → warn banner + the copyable `/pandacorp:upgrade` command row.
 *   - "up-to-date" → ok banner, no command row.
 *   - "unknown"    → renders nothing.
 *
 * Traceability: AC-20-001.1, AC-20-001.2, AC-20-002.1, AC-20-002.2.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OverlayFreshnessState } from "@/lib/overlay-freshness/overlay-freshness";
import { VersionFreshness } from "../version-freshness";

function makeState(overrides: Partial<OverlayFreshnessState> = {}): OverlayFreshnessState {
  return {
    projectVersion: "8.42.1",
    factoryVersion: "8.42.3",
    reason: "behind",
    detail: "este proyecto usa el overlay v8.42.1 · la fábrica ya va por v8.42.3",
    upgradeCommand: "/pandacorp:upgrade",
    ...overrides,
  };
}

describe("VersionFreshness", () => {
  it("renders a warn banner with the copyable /pandacorp:upgrade command when behind", () => {
    render(<VersionFreshness state={makeState({ reason: "behind" })} />);
    const root = screen.getByTestId("version-freshness");
    expect(root).toHaveAttribute("data-reason", "behind");

    const banner = screen.getByTestId("banner");
    expect(banner).toHaveAttribute("data-tone", "warn");

    // The upgrade command is present and shown in a command row (copyable).
    expect(screen.getByTestId("banner-cmd-row")).toHaveTextContent("/pandacorp:upgrade");
    // The detail names both versions.
    expect(screen.getByTestId("banner-detail")).toHaveTextContent("8.42.1");
    expect(screen.getByTestId("banner-detail")).toHaveTextContent("8.42.3");
  });

  it("renders an ok banner with no command row when up-to-date", () => {
    render(
      <VersionFreshness
        state={makeState({
          reason: "up-to-date",
          projectVersion: "8.42.3",
          detail: "overlay v8.42.3 · este proyecto usa la última versión de la fábrica",
        })}
      />,
    );
    const root = screen.getByTestId("version-freshness");
    expect(root).toHaveAttribute("data-reason", "up-to-date");

    const banner = screen.getByTestId("banner");
    expect(banner).toHaveAttribute("data-tone", "ok");

    // No upgrade prompt when already up to date.
    expect(screen.queryByTestId("banner-cmd-row")).toBeNull();
  });

  it("renders nothing when the verdict is unknown (no false alarm)", () => {
    const { container } = render(
      <VersionFreshness
        state={makeState({ reason: "unknown", projectVersion: null, factoryVersion: null })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("version-freshness")).toBeNull();
  });
});
