/**
 * WO-06-013 — DeepRelay (CMP-06-relay) acceptance tests.
 *
 * Verifies REQ-06-007 verbatim:
 *   AC-06-007.1 — deep + frontend → sequential 3-step relay
 *                 (test-writer → backend-dev → frontend-dev), 3-segment
 *                 progress, active sub-step highlighted, "Opus" label.
 *   AC-06-007.2 — steps sequential: only one active at a time; prior steps
 *                 completed; never all three simultaneously active.
 *   AC-06-007.3 — contract hand-off (📄) between backend and frontend steps,
 *                 shown when contractPublished.
 *   AC-06-007.4 — deep + no frontend → single implementer figure, no relay.
 *
 * Pure render component (no RAF, no engine) — driven entirely by props.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RelayState } from "../../fragua-snapshot/fragua-snapshot";
import { DeepRelay } from "../DeepRelay";

const relayAt = (step: RelayState["step"], contractPublished = false): RelayState => ({
  step,
  contractPublished,
});

describe("DeepRelay (CMP-06-relay) — REQ-06-007", () => {
  describe("AC-06-007.1 — sequential 3-step relay rendering", () => {
    it("renders the three relay role sub-steps in order: test-writer → backend-dev → frontend-dev", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("test")} hasFrontend />);

      const relay = screen.getByTestId("deep-relay-WO-06-013");
      expect(within(relay).getByTestId("relay-step-test-writer")).toBeInTheDocument();
      expect(within(relay).getByTestId("relay-step-backend-dev")).toBeInTheDocument();
      expect(within(relay).getByTestId("relay-step-frontend-dev")).toBeInTheDocument();
    });

    it("renders a 3-segment progress indicator", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend")} hasFrontend />);

      const segments = screen.getAllByTestId(/^relay-progress-segment-/);
      expect(segments).toHaveLength(3);
    });

    it("labels the relay 'Opus'", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("test")} hasFrontend />);

      expect(screen.getByTestId("relay-label")).toHaveTextContent("Opus");
    });

    it("highlights the currently-active sub-step (data-active='true')", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend")} hasFrontend />);

      expect(screen.getByTestId("relay-step-backend-dev")).toHaveAttribute("data-active", "true");
      expect(screen.getByTestId("relay-step-test-writer")).toHaveAttribute("data-active", "false");
      expect(screen.getByTestId("relay-step-frontend-dev")).toHaveAttribute("data-active", "false");
    });
  });

  describe("AC-06-007.2 — steps are sequential (one active at a time)", () => {
    it("marks steps before the active one as completed", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("frontend")} hasFrontend />);

      expect(screen.getByTestId("relay-step-test-writer")).toHaveAttribute("data-done", "true");
      expect(screen.getByTestId("relay-step-backend-dev")).toHaveAttribute("data-done", "true");
      expect(screen.getByTestId("relay-step-frontend-dev")).toHaveAttribute("data-done", "false");
    });

    it("never marks two steps active at the same time", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend")} hasFrontend />);

      const activeSteps = screen
        .getAllByTestId(/^relay-step-/)
        .filter((el) => el.getAttribute("data-active") === "true");
      expect(activeSteps).toHaveLength(1);
    });

    it("lights only the progress segments up to and including the active step", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend")} hasFrontend />);

      expect(screen.getByTestId("relay-progress-segment-test")).toHaveAttribute(
        "data-filled",
        "true",
      );
      expect(screen.getByTestId("relay-progress-segment-backend")).toHaveAttribute(
        "data-filled",
        "true",
      );
      expect(screen.getByTestId("relay-progress-segment-frontend")).toHaveAttribute(
        "data-filled",
        "false",
      );
    });
  });

  describe("AC-06-007.3 — contract hand-off between backend and frontend", () => {
    it("does not render the contract hand-off when contractPublished is false", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend", false)} hasFrontend />);

      expect(screen.queryByTestId("relay-contract")).not.toBeInTheDocument();
    });

    it("renders the contract hand-off (📄) when contractPublished is true", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("frontend", true)} hasFrontend />);

      const contract = screen.getByTestId("relay-contract");
      expect(contract).toBeInTheDocument();
      expect(contract).toHaveTextContent("📄");
    });
  });

  describe("AC-06-007.4 — deep + no frontend → single implementer (no relay)", () => {
    it("renders a single implementer figure when hasFrontend is false", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend")} hasFrontend={false} />);

      expect(screen.getByTestId("deep-relay-single-WO-06-013")).toBeInTheDocument();
      expect(screen.getByTestId("deep-relay-single-WO-06-013")).toHaveAttribute(
        "data-role",
        "implementer",
      );
    });

    it("does not render the 3-step relay when hasFrontend is false", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("backend")} hasFrontend={false} />);

      expect(screen.queryByTestId("relay-step-test-writer")).not.toBeInTheDocument();
      expect(screen.queryByTestId("relay-label")).not.toBeInTheDocument();
    });
  });

  describe("Observation-only + no hardcoded colors (AC-06-009.1, FRD-13)", () => {
    it("exposes no control affordance (no button)", () => {
      render(<DeepRelay wo="WO-06-013" relay={relayAt("test")} hasFrontend />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("uses only CSS custom properties for color (no hardcoded hex)", () => {
      const { container } = render(
        <DeepRelay wo="WO-06-013" relay={relayAt("backend", true)} hasFrontend />,
      );

      // No raw hex colors anywhere in the inline styles.
      const html = container.innerHTML;
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });
});
