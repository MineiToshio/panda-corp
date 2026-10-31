/**
 * FreshnessBadge — DR-066 rule (b): the surface declares its own freshness in
 * three graded bands (change mc-observability-consumer-dr066).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildSignal } from "@/lib/fragua/build-signal";
import { FreshnessBadge } from "../FreshnessBadge";

const NOW = new Date().toISOString();
function freshnessProps(lastSignalAt: string | null) {
  return {
    nowIso: NOW,
    signal: buildSignal({ running: true, lastEventAt: lastSignalAt, nowMs: Date.parse(NOW) }),
  };
}

describe("FreshnessBadge", () => {
  it("fresh signal (< 3·T) → 'en vivo'", () => {
    render(<FreshnessBadge {...freshnessProps(new Date(Date.now() - 30_000).toISOString())} />);
    const badge = screen.getByTestId("freshness-badge");
    expect(badge).toHaveAttribute("data-band", "live");
    expect(badge).toHaveTextContent("Construyendo");
  });

  it("aging signal (3·T ≤ age < TTL) → 'datos de hace N min', never dressed as live", () => {
    render(<FreshnessBadge {...freshnessProps(new Date(Date.now() - 5 * 60_000).toISOString())} />);
    const badge = screen.getByTestId("freshness-badge");
    expect(badge).toHaveAttribute("data-band", "aging");
    expect(badge).toHaveTextContent(/Construyendo/);
  });

  it("signal past the TTL → 'sin señal' (not the last value dressed as current)", () => {
    render(
      <FreshnessBadge {...freshnessProps(new Date(Date.now() - 60 * 60_000).toISOString())} />,
    );
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute("data-band", "no-signal");
    expect(screen.getByTestId("freshness-badge")).toHaveTextContent("Sin señal");
  });

  it("no signal at all → 'sin señal'", () => {
    render(<FreshnessBadge {...freshnessProps(null)} />);
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute("data-band", "no-signal");
  });

  it("is marked data-volatile — its text is time-relative (DR-088)", () => {
    render(<FreshnessBadge {...freshnessProps(null)} />);
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute("data-volatile");
  });
});

it("AC-06-020.6: idle signal renders nothing, no fabricated live chip", () => {
  const { container } = render(
    <FreshnessBadge
      signal={{ kind: "idle", lastSignalAt: null, ageMinutes: null }}
      nowIso="2026-10-30T12:00:00Z"
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
