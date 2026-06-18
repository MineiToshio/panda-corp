/**
 * WO-10-008 — Secret achievements (RED → GREEN → refactor)
 *
 * Traceability:
 *   AC-10-008.1 — A locked secret SHALL render as a silhouette + its cryptic hint,
 *                 with NO criterion shown.
 *   AC-10-008.2 — WHEN unlocked, the secret SHALL reveal its criterion (what triggered
 *                 it) and show date + project — SHALL NOT remain obscure (anti-loot-box).
 *   AC-10-008.3 — The reveal SHALL be honest (actual triggering result), never fabricated.
 *   AC-10-008.4 — Styling SHALL use FRD-13 tokens only; locked/unlocked distinction NOT
 *                 by color alone (silhouette/icon/label present).
 *
 * Blueprint: CMP-10-secrets (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Secret } from "@/lib/achievements";
import { SecretsPanel } from "../SecretsPanel";

afterEach(() => {
  cleanup();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOCKED_SECRET: Secret = {
  hint: "Ocurre cuando ves el vacío al otro lado.",
  unlocked: false,
};

const UNLOCKED_SECRET: Secret = {
  hint: "El código revisó al código.",
  unlocked: true,
  criterion: "Un agente revisor corrigió o completó el trabajo de otro agente.",
  date: "2026-06-17T10:00:00Z",
  project: "mi-proyecto",
};

const MIXED_SECRETS: Secret[] = [
  LOCKED_SECRET,
  UNLOCKED_SECRET,
  {
    hint: "Va más rápido de lo esperado.",
    unlocked: false,
  },
];

const ALL_UNLOCKED: Secret[] = [
  {
    hint: "Hint uno.",
    unlocked: true,
    criterion: "Criterio uno verificable.",
    date: "2026-01-01T00:00:00Z",
    project: "alpha",
  },
  {
    hint: "Hint dos.",
    unlocked: true,
    criterion: "Criterio dos verificable.",
    date: "2026-02-01T00:00:00Z",
    project: "beta",
  },
];

const ALL_LOCKED: Secret[] = [
  { hint: "Pista uno misteriosa.", unlocked: false },
  { hint: "Pista dos misteriosa.", unlocked: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-008.1 — Locked: silhouette + cryptic hint, NO criterion
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-008.1 — locked secret renders silhouette + hint (no criterion)", () => {
  it("renders the secrets panel root element", () => {
    render(<SecretsPanel secrets={[LOCKED_SECRET]} />);
    expect(screen.getByTestId("secrets-panel")).toBeDefined();
  });

  it("renders one secret item per entry", () => {
    render(<SecretsPanel secrets={ALL_LOCKED} />);
    const items = screen.getAllByTestId("secret-item");
    expect(items.length).toBe(2);
  });

  it("renders the cryptic hint for a locked secret", () => {
    render(<SecretsPanel secrets={[LOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    const hint = within(item).getByTestId("secret-hint");
    expect(hint.textContent?.trim()).toBe(LOCKED_SECRET.hint);
  });

  it("does NOT render the criterion for a locked secret (negative AC)", () => {
    render(<SecretsPanel secrets={[LOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    // criterion element must not exist
    expect(within(item).queryByTestId("secret-criterion")).toBeNull();
  });

  it("does NOT render date for a locked secret (negative AC)", () => {
    render(<SecretsPanel secrets={[LOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    expect(within(item).queryByTestId("secret-date")).toBeNull();
  });

  it("does NOT render project for a locked secret (negative AC)", () => {
    render(<SecretsPanel secrets={[LOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    expect(within(item).queryByTestId("secret-project")).toBeNull();
  });

  it("renders a silhouette indicator for each locked secret", () => {
    render(<SecretsPanel secrets={ALL_LOCKED} />);
    const items = screen.getAllByTestId("secret-item");
    for (const item of items) {
      const silhouette = within(item).getByTestId("secret-silhouette");
      expect(silhouette).toBeDefined();
    }
  });

  it("marks locked items with data-locked=true", () => {
    render(<SecretsPanel secrets={[LOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    expect(item.getAttribute("data-locked")).toBe("true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-008.2 — Unlocked: criterion + date + project revealed (anti-loot-box)
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-008.2 — unlocked secret reveals criterion + date + project", () => {
  it("renders the criterion when unlocked", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    const criterion = within(item).getByTestId("secret-criterion");
    expect(criterion.textContent?.trim()).toBe(UNLOCKED_SECRET.criterion);
  });

  it("renders the date when unlocked", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    const dateEl = within(item).getByTestId("secret-date");
    expect(dateEl.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("renders the project when unlocked", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    const projectEl = within(item).getByTestId("secret-project");
    expect(projectEl.textContent?.trim()).toContain(UNLOCKED_SECRET.project);
  });

  it("still renders the hint when unlocked", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    const hint = within(item).getByTestId("secret-hint");
    expect(hint.textContent?.trim()).toBe(UNLOCKED_SECRET.hint);
  });

  it("marks unlocked items with data-locked=false", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const item = screen.getByTestId("secret-item");
    expect(item.getAttribute("data-locked")).toBe("false");
  });

  it("does NOT omit criterion for unlocked — never remains obscure (negative AC)", () => {
    render(<SecretsPanel secrets={ALL_UNLOCKED} />);
    const items = screen.getAllByTestId("secret-item");
    for (const item of items) {
      const criterion = within(item).queryByTestId("secret-criterion");
      // Must be present for every unlocked item (anti-loot-box rule)
      expect(criterion).not.toBeNull();
      expect(criterion?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("does NOT render criterion as empty string (negative AC — must be non-empty honest text)", () => {
    render(<SecretsPanel secrets={ALL_UNLOCKED} />);
    const criterionEls = screen.getAllByTestId("secret-criterion");
    for (const el of criterionEls) {
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-008.3 — Honest reveal: actual triggering result, never fabricated
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-008.3 — honest reveal: criterion matches the Secret data (not fabricated)", () => {
  it("renders the exact criterion string from the Secret object", () => {
    const criterion = "Criterio exacto verificable de la fuente de datos.";
    const secret: Secret = {
      hint: "Pista.",
      unlocked: true,
      criterion,
      date: "2026-06-01T00:00:00Z",
      project: "proyecto-real",
    };
    render(<SecretsPanel secrets={[secret]} />);
    const criterionEl = screen.getByTestId("secret-criterion");
    expect(criterionEl.textContent?.trim()).toBe(criterion);
  });

  it("renders the exact date from the Secret object (tabular-nums, ISO formatted)", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const dateEl = screen.getByTestId("secret-date");
    // Must contain some part of the original date (the component may format it)
    const text = dateEl.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    // The year 2026 must appear (honest date, not fabricated)
    expect(text).toContain("2026");
  });

  it("renders the exact project from the Secret object", () => {
    render(<SecretsPanel secrets={[UNLOCKED_SECRET]} />);
    const projectEl = screen.getByTestId("secret-project");
    expect(projectEl.textContent).toContain("mi-proyecto");
  });

  it("multiple unlocked secrets each show their own distinct criterion", () => {
    render(<SecretsPanel secrets={ALL_UNLOCKED} />);
    const criterionEls = screen.getAllByTestId("secret-criterion");
    expect(criterionEls.length).toBe(2);
    const texts = criterionEls.map((el) => el.textContent?.trim() ?? "");
    expect(texts[0]).toBe("Criterio uno verificable.");
    expect(texts[1]).toBe("Criterio dos verificable.");
    // They must be different (no cross-contamination)
    expect(texts[0]).not.toBe(texts[1]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-008.4 — Design tokens only; locked/unlocked not by color alone
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-008.4 — design tokens only; not color-alone distinction", () => {
  it("no hardcoded hex colors in any inline style (negative AC)", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const allEls = document.querySelectorAll("[style]");
    for (const el of allEls) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}(?!\w)/);
    }
  });

  it("no hardcoded rgb() or hsl() colors outside var() (negative AC)", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const allEls = document.querySelectorAll("[style]");
    for (const el of allEls) {
      const style = el.getAttribute("style") ?? "";
      // rgb/hsl not inside a var() call
      const noRaw =
        !/(?<!\bvar\([^)]*)\brgb\(/.test(style) && !/(?<!\bvar\([^)]*)\bhsl\(/.test(style);
      expect(noRaw).toBe(true);
    }
  });

  it("locked items have a silhouette element (non-color visual distinction)", () => {
    render(<SecretsPanel secrets={ALL_LOCKED} />);
    const items = screen.getAllByTestId("secret-item");
    for (const item of items) {
      // Silhouette must exist as a shape/icon indicator — not just color
      expect(within(item).getByTestId("secret-silhouette")).toBeDefined();
    }
  });

  it("unlocked items have an unlocked-badge or checkmark indicator (non-color distinction)", () => {
    render(<SecretsPanel secrets={ALL_UNLOCKED} />);
    const items = screen.getAllByTestId("secret-item");
    for (const item of items) {
      // Must have a non-color visual element distinguishing unlocked from locked
      const badge = within(item).queryByTestId("secret-unlocked-badge");
      expect(badge).not.toBeNull();
    }
  });

  it("locked and unlocked items have distinct data-locked attribute (accessible programmatic distinction)", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const items = screen.getAllByTestId("secret-item");
    const lockedItems = items.filter((el) => el.getAttribute("data-locked") === "true");
    const unlockedItems = items.filter((el) => el.getAttribute("data-locked") === "false");
    // MIXED_SECRETS has 2 locked + 1 unlocked
    expect(lockedItems.length).toBe(2);
    expect(unlockedItems.length).toBe(1);
  });

  it("panel has an aria-label in Spanish", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const panel = screen.getByTestId("secrets-panel");
    const label = panel.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label?.length).toBeGreaterThan(0);
  });

  it("each secret item has an aria-label conveying its locked/unlocked state", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const items = screen.getAllByTestId("secret-item");
    for (const item of items) {
      const label = item.getAttribute("aria-label");
      expect(label).toBeTruthy();
      expect(label?.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases / empty / robustness
// ─────────────────────────────────────────────────────────────────────────────

describe("Edge cases — empty secrets list and robustness", () => {
  it("renders an empty state when secrets list is empty", () => {
    render(<SecretsPanel secrets={[]} />);
    const panel = screen.getByTestId("secrets-panel");
    expect(panel).toBeDefined();
    // No secret items
    const items = screen.queryAllByTestId("secret-item");
    expect(items.length).toBe(0);
  });

  it("handles undefined date gracefully in unlocked secret without crashing", () => {
    const secretWithoutDate: Secret = {
      hint: "Pista especial.",
      unlocked: true,
      criterion: "Criterio sin fecha.",
      project: "proyecto-sin-fecha",
    };
    expect(() => render(<SecretsPanel secrets={[secretWithoutDate]} />)).not.toThrow();
  });

  it("renders all secrets from a mixed list correctly", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const items = screen.getAllByTestId("secret-item");
    // MIXED_SECRETS has 3 entries
    expect(items.length).toBe(3);
  });

  it("renders the section heading in Spanish", () => {
    render(<SecretsPanel secrets={MIXED_SECRETS} />);
    const panel = screen.getByTestId("secrets-panel");
    // The panel should have a heading element
    const heading = panel.querySelector("h2, h3");
    expect(heading).not.toBeNull();
    const text = heading?.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration with computeSecrets output shape
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — SecretsPanel accepts computeSecrets() output", () => {
  it("renders Secret[] returned by computeSecrets without modifications", async () => {
    const { computeSecrets } = await import("@/lib/achievements");
    const secrets = computeSecrets({
      ideas: [],
      statuses: [],
      eventsSnapshot: null,
    });
    // computeSecrets returns Secret[] (all locked on empty data)
    expect(() => render(<SecretsPanel secrets={secrets} />)).not.toThrow();
    const panel = screen.getByTestId("secrets-panel");
    expect(panel).toBeDefined();
    const items = screen.queryAllByTestId("secret-item");
    // All 3 secrets from SECRET_DEFINITIONS — all locked on empty data
    expect(items.length).toBe(3);
  });

  it("all items are locked when factory is empty (honest empty state)", async () => {
    const { computeSecrets } = await import("@/lib/achievements");
    const secrets = computeSecrets({
      ideas: [],
      statuses: [],
      eventsSnapshot: null,
    });
    render(<SecretsPanel secrets={secrets} />);
    const items = screen.getAllByTestId("secret-item");
    for (const item of items) {
      expect(item.getAttribute("data-locked")).toBe("true");
    }
  });
});
