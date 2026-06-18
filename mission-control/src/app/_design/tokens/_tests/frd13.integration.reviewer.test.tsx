/**
 * FRD-13 — REVIEWER adversarial integration probe (DR-015), FRD gate 2026-06-18 (Opus 4.8).
 *
 * Written by the reviewer, NOT the implementer. Exercises WO-13-001's contract maps
 * (STATE_BADGE, AGENT_COLOR) TOGETHER with their VERIFIED real consumers — the StateBadge
 * component (WO-13-005) and the globals.css @theme block (WO-13-002) — rather than the maps
 * in isolation. This is the integration the per-WO self-tests do not run as one unit.
 *
 * Edge the implementer suite missed (it asserts distinct LABELS and distinct token KEYS, but
 * never distinct ICON SHAPES): AC-13-007.1 demands "icon OR shape + label" precisely because
 * the warm palette puts reds/oranges/amber close together. If two states shared the same icon
 * AND their colors are visually near, they would be indistinguishable to a color-blind user —
 * color-only signalling through the back door. Two probes:
 *   1) STATE_BADGE icons are pairwise distinct (each state has its own shape signal).
 *   2) Rendering EVERY canonical state through the real StateBadge yields a distinct, non-empty
 *      shape (data-icon) AND a non-empty Spanish label — the color-independence contract holds
 *      end-to-end, not just in the data map.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateBadge } from "@/components/core/StateBadge/StateBadge";
import { AGENT_STATES, STATE_BADGE } from "../tokens";

describe("FRD-13 reviewer — state vocabulary is shape-distinct, not color-only (AC-13-007.1)", () => {
  it("every STATE_BADGE icon shape is pairwise distinct (no two states share an icon)", () => {
    const icons = AGENT_STATES.map((s) => STATE_BADGE[s].icon);
    const unique = new Set(icons);
    expect(
      unique.size,
      `Two or more states share the same icon shape (${icons.join(", ")}) — with the warm palette ` +
        "that collapses to a color-only distinction, violating AC-13-007.1.",
    ).toBe(AGENT_STATES.length);
  });

  it("rendering EVERY canonical state through the real StateBadge emits a distinct non-empty shape AND a non-empty label", () => {
    const seenIcons: string[] = [];

    for (const state of AGENT_STATES) {
      const { unmount } = render(<StateBadge state={state} />);
      const badge = screen.getByTestId("state-badge");

      const icon = badge.getAttribute("data-icon") ?? "";
      const label = badge.getAttribute("aria-label") ?? "";
      const visibleText = badge.textContent ?? "";

      expect(icon, `state "${state}" rendered with no icon shape`).not.toBe("");
      expect(label, `state "${state}" rendered with an empty aria-label`).not.toBe("");
      // The visible text label must be present too — never color-only (AC-13-007.1).
      expect(visibleText.trim(), `state "${state}" rendered with no visible label text`).not.toBe(
        "",
      );
      // The rendered icon must be the canonical one, not the unknown fallback.
      expect(icon, `state "${state}" fell through to the unknown fallback shape`).toBe(
        STATE_BADGE[state].icon,
      );

      seenIcons.push(icon);
      unmount();
    }

    // End-to-end: the shapes the user actually sees are all distinct.
    expect(new Set(seenIcons).size, "two canonical states rendered the same shape").toBe(
      AGENT_STATES.length,
    );
  });
});
