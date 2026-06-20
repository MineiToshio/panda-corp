/**
 * WO-13-009 — MissionBar tests (.quest)
 *
 * The Misión strip: label + FRD pips + global WO counter (tabular-nums) + effort read-only.
 * DR-061: effort is read-only data, never a control.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MissionBar } from "../MissionBar";

const FRD_PIPS = [
  { id: "FRD-13", state: "done" as const },
  { id: "FRD-14", state: "current" as const },
  { id: "FRD-15", state: "pending" as const },
];

describe("MissionBar", () => {
  it("renders root element", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
  });

  it("renders the Misión label", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-label")).toBeInTheDocument();
  });

  it("renders all FRD pips", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getAllByTestId(/^mission-bar-pip-/)).toHaveLength(3);
  });

  it("renders done pip with done state", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-pip-FRD-13")).toHaveAttribute("data-state", "done");
  });

  it("renders current pip with current state", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-pip-FRD-14")).toHaveAttribute("data-state", "current");
  });

  it("renders pending pip with pending state", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-pip-FRD-15")).toHaveAttribute("data-state", "pending");
  });

  it("renders WO counter with done and total", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    const counter = screen.getByTestId("mission-bar-counter");
    expect(counter).toHaveTextContent("52");
    expect(counter).toHaveTextContent("109");
  });

  it("WO counter uses tabular-nums", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    const counter = screen.getByTestId("mission-bar-counter");
    const style = counter.getAttribute("style") ?? "";
    expect(style).toContain("tabular-nums");
  });

  it("renders effort as read-only data (not a button/input)", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    const effort = screen.getByTestId("mission-bar-effort");
    expect(effort.tagName).not.toBe("BUTTON");
    expect(effort.tagName).not.toBe("INPUT");
    expect(effort.tagName).not.toBe("SELECT");
    expect(effort).toHaveTextContent("potente");
  });

  it("renders the effort icon (⚙️)", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-effort")).toHaveTextContent("⚙");
  });

  it("renders arrow separators between pips", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    const arrows = screen.getAllByTestId("mission-bar-arrow");
    // 2 arrows between 3 pips
    expect(arrows).toHaveLength(2);
  });

  it("does not use hardcoded hex in root inline styles", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    const root = screen.getByTestId("mission-bar-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("renders pip FRD id text", () => {
    render(<MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />);
    expect(screen.getByTestId("mission-bar-pip-FRD-13")).toHaveTextContent("FRD-13");
  });

  it("renders with single pip without crashing", () => {
    render(
      <MissionBar
        frdPips={[{ id: "FRD-01", state: "current" }]}
        done={0}
        total={10}
        effort="pro"
      />,
    );
    expect(screen.getAllByTestId(/^mission-bar-pip-/)).toHaveLength(1);
    // No arrows for a single pip
    expect(screen.queryAllByTestId("mission-bar-arrow")).toHaveLength(0);
  });
});
