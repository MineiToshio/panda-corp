/**
 * WO-13-009 — AgentSprite tests
 *
 * The 52px pixel implementer sprite (one per running WO).
 * States: work / carry / vault / say-on
 * Features: halo, progress bar, WO-id tag
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentSprite } from "../AgentSprite";

describe("AgentSprite", () => {
  it("renders root element", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-root")).toBeInTheDocument();
  });

  it("sets data-role attribute", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-root")).toHaveAttribute("data-role", "implementer");
  });

  it("sets data-state attribute", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-root")).toHaveAttribute("data-state", "work");
  });

  it("renders sprite image with pixelated rendering", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    const img = screen.getByTestId("agent-sprite-img");
    expect(img).toHaveStyle({ imageRendering: "pixelated" });
  });

  it("renders the WO-id tag", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-tag")).toHaveTextContent("WO-06-001");
  });

  it("renders halo element (visible in work state)", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-halo")).toBeInTheDocument();
  });

  it("renders progress bar in work state", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" progress={0.6} />);
    const prog = screen.getByTestId("agent-sprite-progress");
    expect(prog).toBeInTheDocument();
    expect(prog).toHaveAttribute("data-visible", "true");
  });

  it("hides progress bar when not in work state", () => {
    render(<AgentSprite agentRole="implementer" state="vault" woId="WO-06-001" />);
    const prog = screen.getByTestId("agent-sprite-progress");
    expect(prog).toHaveAttribute("data-visible", "false");
  });

  it("shows scroll icon in carry state", () => {
    render(<AgentSprite agentRole="implementer" state="carry" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-carry")).toHaveAttribute("data-visible", "true");
  });

  it("hides scroll icon when not in carry state", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-carry")).toHaveAttribute("data-visible", "false");
  });

  it("shows medal in vault state", () => {
    render(<AgentSprite agentRole="implementer" state="vault" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-medal")).toHaveAttribute("data-visible", "true");
  });

  it("hides medal when not in vault state", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    expect(screen.getByTestId("agent-sprite-medal")).toHaveAttribute("data-visible", "false");
  });

  it("renders all valid states without throwing", () => {
    const states = ["work", "carry", "vault", "say-on", "idle", "split", "review"] as const;
    for (const state of states) {
      const { unmount } = render(
        <AgentSprite agentRole="implementer" state={state} woId="WO-06-001" />,
      );
      expect(screen.getByTestId("agent-sprite-root")).toHaveAttribute("data-state", state);
      unmount();
    }
  });

  it("accepts different roles without throwing", () => {
    const roles = [
      "implementer",
      "reviewer",
      "test-writer",
      "backend-dev",
      "frontend-dev",
    ] as const;
    for (const role of roles) {
      const { unmount } = render(<AgentSprite agentRole={role} state="work" woId="WO-06-001" />);
      expect(screen.getByTestId("agent-sprite-root")).toHaveAttribute("data-role", role);
      unmount();
    }
  });

  it("has Spanish aria-label", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    const root = screen.getByTestId("agent-sprite-root");
    expect(root).toHaveAttribute("aria-label");
    const label = root.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(3);
  });

  it("does not use hardcoded hex in inline styles", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    const root = screen.getByTestId("agent-sprite-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("uses 52px size by default", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    const img = screen.getByTestId("agent-sprite-img");
    expect(img).toHaveStyle({ width: "52px", height: "52px" });
  });

  it("uses 42px size in vault state (smaller sprite)", () => {
    render(<AgentSprite agentRole="implementer" state="vault" woId="WO-06-001" />);
    const img = screen.getByTestId("agent-sprite-img");
    expect(img).toHaveStyle({ width: "42px", height: "42px" });
  });
});
