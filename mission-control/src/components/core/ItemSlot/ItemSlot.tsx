/**
 * CMP-13-itemslot — Pixel-art icon/medal slot (WO-13-008, FND-3)
 *
 * Inventory/equipment slot rendered with image-rendering:pixelated.
 * Supports a locked variant with a hover/focus-within reveal overlay.
 *
 * Design contract (rpgSkin.itemslot + rpgSkin.lockchip, design-tokens.json):
 *   border-radius 9px · image-rendering:pixelated · inline-flex centered
 *   Sizes observed: 34/40/42/58px (set via `size` prop)
 *   lock: filter saturate(.55) on inner slot
 *   reveal: absolute overlay that fades in on hover / focus-within (.18s ease)
 *     prefers-reduced-motion: transition:none on the reveal
 *   tone → border+bg token: accent/warn/ok/danger
 *
 * Rules:
 *   - Tokens only — zero hardcoded colors.
 *   - tone is reinforcement; aria-label always present (REQ-13-008).
 *   - data-tone attribute for non-color signal.
 *   - data-locked for lock state signal.
 *   - reveal overlay is keyboard-reachable via :focus-within (a11y).
 *
 * Server Component — pure, no "use client".
 * Note: the :hover/:focus-within CSS for the reveal is applied via a <style>
 * block scoped by a class. This avoids "use client" for a purely presentational
 * hover interaction (CSS-only, no JS state).
 *
 * Traceability:
 *   AC-WO-13-008: ItemSlot · pixelated · tone tokens · lock/reveal · aria-label
 *   CMP-13-itemslot → WO-13-008 → FRD-13 REQ-13-002,006,007,008
 */

import type React from "react";

// ── Tone → token maps ─────────────────────────────────────────────────────────

type Tone = "accent" | "warn" | "ok" | "danger";

const TONE_BG: Record<Tone, string> = {
  accent: "var(--color-accent-bg)",
  warn: "var(--color-warn-bg)",
  ok: "var(--color-ok-bg)",
  danger: "var(--color-danger-bg)",
};

const TONE_BORDER: Record<Tone, string> = {
  accent: "var(--color-accent)",
  warn: "var(--color-warn)",
  ok: "var(--color-ok)",
  danger: "var(--color-danger)",
};

const TONE_COLOR: Record<Tone, string> = {
  accent: "var(--color-accent-text)",
  warn: "var(--color-warn)",
  ok: "var(--color-ok)",
  danger: "var(--color-danger)",
};

// ── Props ──────────────────────────────────────────────────────────────────────

export type ItemSlotProps = {
  /** Icon / content to render inside the slot (ReactNode). */
  icon: React.ReactNode;
  /**
   * Slot size in px. Prototype sizes: 34 / 40 / 42 / 58.
   * Defaults to 40.
   */
  size?: number;
  /**
   * Color tone — maps to border+bg+color tokens (never hardcoded).
   * Omit for a neutral (border/bg from --color-border-strong / --color-panel).
   */
  tone?: Tone;
  /**
   * When true the slot content is desaturated (locked state).
   * Use with `reveal` to provide a focus/hover hint.
   */
  lock?: boolean;
  /**
   * Content to display in the hover/focus-within reveal overlay.
   * Only meaningful when `lock=true`.
   */
  reveal?: React.ReactNode;
  /** Accessible Spanish label for the slot (REQ-13-008). Required. */
  "aria-label": string;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ItemSlot — pixel-art icon/medal container.
 *
 * The locked-trophy variant (lock=true + reveal) displays a reveal overlay
 * on hover and :focus-within — both keyboard and pointer reachable.
 * The reveal transition is suppressed under prefers-reduced-motion.
 *
 * Server Component: pure, deterministic, no I/O.
 */
export function ItemSlot({
  icon,
  size = 40,
  tone,
  lock = false,
  reveal,
  "aria-label": ariaLabel,
}: ItemSlotProps): React.JSX.Element {
  // Resolve border/bg/color from tone token, or fall back to neutral panel tokens.
  const borderColor = tone ? TONE_BORDER[tone] : "var(--color-border-strong)";
  const bgColor = tone ? TONE_BG[tone] : "var(--color-panel)";
  const color = tone ? TONE_COLOR[tone] : "var(--color-text2)";

  // Determine border width: 1.5px for smaller slots (≤40), 2px for larger.
  const borderWidth = size >= 42 ? "2px" : "1.5px";

  const hasReveal = reveal !== undefined;

  return (
    <span
      data-testid="itemslot-root"
      data-tone={tone ?? ""}
      data-locked={lock ? "true" : "false"}
      aria-label={ariaLabel}
      role="img"
      tabIndex={hasReveal && lock ? 0 : undefined}
      className="itemslot-wrap"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "9px",
        border: `${borderWidth} solid ${borderColor}`,
        background: bgColor,
        color,
        imageRendering: "pixelated",
        overflow: hasReveal ? "hidden" : undefined,
        // lock: desaturate inner content
        filter: lock ? "saturate(0.55)" : undefined,
        boxSizing: "border-box",
      }}
    >
      {/* Icon / content */}
      {icon}

      {/* Reveal overlay — fades in on hover / :focus-within (CSS-only) */}
      {hasReveal && (
        <>
          {/* Inline style block for the hover/focus-within interaction.
              CSS-only: no JS state, no "use client" needed. */}
          <style>{`
            .itemslot-wrap { position: relative; }
            .itemslot-reveal {
              position: absolute;
              inset: 0;
              border-radius: 9px;
              background: var(--color-card);
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 9px 11px;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.18s ease;
            }
            .itemslot-wrap:hover .itemslot-reveal,
            .itemslot-wrap:focus-within .itemslot-reveal {
              opacity: 1;
            }
            @media (prefers-reduced-motion: reduce) {
              .itemslot-reveal { transition: none; }
            }
          `}</style>
          <span data-testid="itemslot-reveal" className="itemslot-reveal" aria-hidden="true">
            {reveal}
          </span>
        </>
      )}
    </span>
  );
}
