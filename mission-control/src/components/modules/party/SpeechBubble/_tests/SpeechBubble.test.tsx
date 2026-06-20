/**
 * WO-13-009 — SpeechBubble tests
 *
 * WO caption bubble (say-on / sayin animation).
 * Presentational: text in, bubble out.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpeechBubble } from "../SpeechBubble";

describe("SpeechBubble", () => {
  it("renders with text", () => {
    render(<SpeechBubble text="RED → GREEN" />);
    expect(screen.getByTestId("speech-bubble-root")).toBeInTheDocument();
    expect(screen.getByTestId("speech-bubble-text")).toHaveTextContent("RED → GREEN");
  });

  it("renders the tail pointer", () => {
    render(<SpeechBubble text="hola" />);
    expect(screen.getByTestId("speech-bubble-tail")).toBeInTheDocument();
  });

  it("accepts raised prop for even-column offset", () => {
    render(<SpeechBubble text="hola" raised={true} />);
    expect(screen.getByTestId("speech-bubble-root")).toHaveAttribute("data-raised", "true");
  });

  it("is not raised by default", () => {
    render(<SpeechBubble text="hola" />);
    const root = screen.getByTestId("speech-bubble-root");
    // data-raised may be "false" or absent; either is correct
    const val = root.getAttribute("data-raised");
    expect(val === "false" || val === null).toBe(true);
  });

  it("is aria-hidden (decorative, agent state conveyed by StateBadge elsewhere)", () => {
    render(<SpeechBubble text="hola" />);
    expect(screen.getByTestId("speech-bubble-root")).toHaveAttribute("aria-hidden", "true");
  });

  it("does not use hardcoded hex in root inline styles", () => {
    render(<SpeechBubble text="tipando..." />);
    const root = screen.getByTestId("speech-bubble-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("renders max-width constraint (bubble won't overflow sprite)", () => {
    render(
      <SpeechBubble text="a very long message that could overflow the sprite if unconstrained" />,
    );
    const root = screen.getByTestId("speech-bubble-root");
    // maxWidth should be set in style
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("max-width");
  });
});
