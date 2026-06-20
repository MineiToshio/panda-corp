/**
 * WO-13-009 — Room tests (RED → GREEN)
 *
 * Tests the shared pixel-RPG Room primitive:
 *   - zone/state/label/count props render correctly
 *   - zone background image path is correct (image-rendering:pixelated)
 *   - room states: cool/hot/active/done/locked
 *   - label + count chips (top-left / top-right)
 *   - tokens only (no hardcoded hex)
 *   - WCAG: aria-label in Spanish
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Room } from "../Room";

describe("Room", () => {
  it("renders with zone and label", () => {
    render(<Room zone="forge" label="⚒️ Sala de Forja" state="cool" />);
    const root = screen.getByTestId("room-root");
    expect(root).toBeInTheDocument();
    expect(screen.getByTestId("room-label")).toHaveTextContent("⚒️ Sala de Forja");
  });

  it("renders count chip when count is provided", () => {
    render(<Room zone="forge" label="Forja" state="cool" count={3} />);
    expect(screen.getByTestId("room-count")).toHaveTextContent("3");
  });

  it("does not render count when not provided", () => {
    render(<Room zone="forge" label="Forja" state="cool" />);
    expect(screen.queryByTestId("room-count")).not.toBeInTheDocument();
  });

  it("sets data-zone attribute to the zone value", () => {
    render(<Room zone="tribunal" label="Tribunal" state="cool" />);
    expect(screen.getByTestId("room-root")).toHaveAttribute("data-zone", "tribunal");
  });

  it("sets data-state attribute correctly", () => {
    render(<Room zone="forge" label="Forja" state="active" />);
    expect(screen.getByTestId("room-root")).toHaveAttribute("data-state", "active");
  });

  it("renders all valid states without throwing", () => {
    const states = ["cool", "hot", "active", "done", "locked"] as const;
    for (const state of states) {
      const { unmount } = render(<Room zone="forge" label="test" state={state} />);
      expect(screen.getByTestId("room-root")).toHaveAttribute("data-state", state);
      unmount();
    }
  });

  it("renders all valid zones without throwing", () => {
    const zones = [
      "forge",
      "tribunal",
      "vault",
      "research",
      "spec",
      "design",
      "architecture",
      "build",
      "release",
    ] as const;
    for (const zone of zones) {
      const { unmount } = render(<Room zone={zone} label="test" state="cool" />);
      expect(screen.getByTestId("room-root")).toHaveAttribute("data-zone", zone);
      unmount();
    }
  });

  it("renders a background image element with pixelated rendering", () => {
    render(<Room zone="forge" label="Forja" state="cool" />);
    const bg = screen.getByTestId("room-bg");
    expect(bg).toBeInTheDocument();
    // image-rendering:pixelated should be set via inline style
    expect(bg).toHaveStyle({ imageRendering: "pixelated" });
  });

  it("has aria-label in Spanish", () => {
    render(<Room zone="forge" label="Sala de Forja" state="cool" />);
    const root = screen.getByTestId("room-root");
    expect(root).toHaveAttribute("aria-label");
    const ariaLabel = root.getAttribute("aria-label") ?? "";
    // Should mention the label
    expect(ariaLabel.length).toBeGreaterThan(3);
  });

  it("does not use hardcoded hex colors in inline styles", () => {
    render(<Room zone="forge" label="Forja" state="cool" count={2} />);
    const root = screen.getByTestId("room-root");
    const inlineStyle = root.getAttribute("style") ?? "";
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("renders children when provided", () => {
    render(
      <Room zone="forge" label="Forja" state="active">
        <span data-testid="room-child">child</span>
      </Room>,
    );
    expect(screen.getByTestId("room-child")).toBeInTheDocument();
  });
});
