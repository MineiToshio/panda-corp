/**
 * content/manual/wo-14-004.feedback-channels.test.ts — WO-14-004
 *
 * Acceptance-criteria tests for the "Feeding an in-progress build" Manual page.
 *
 * Traceability:
 *   REQ-14-006 / AC-14-006.1 — The Manual SHALL document the three feedback channels
 *   (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`) as file-based, picked up
 *   at the next safe point.
 *
 *   WO-14-004 scope (from work order):
 *   - Section naming the three channels: bug, iterate, decide.
 *   - File-based semantics for each channel.
 *   - "Next safe point" pickup semantics (never interrupts mid-work-order).
 *   - Cross-link to the snapshot panel (CMP-14-snapshot-panel).
 *   - Cross-link to FRD-04 decision points / workspace decisions.
 *   - Consistent with factory/standards/infra.md (state written by gate, not agent).
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readManualPages } from "../../lib/manual";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, "../..");
const FEED_BUILD_SLUG = "alimentar-build";
const FEED_BUILD_FILE = path.join(APP_ROOT, "content", "manual", "guides", `${FEED_BUILD_SLUG}.md`);

function getFeedBuildPage() {
  const pages = readManualPages(APP_ROOT);
  return pages.find((p) => p.slug === FEED_BUILD_SLUG);
}

// ---------------------------------------------------------------------------
// File existence
// ---------------------------------------------------------------------------

describe("AC-14-006.1 — file existence and indexing", () => {
  it("content/manual/guides/alimentar-build.md exists on disk", () => {
    expect(fs.existsSync(FEED_BUILD_FILE), `File not found: ${FEED_BUILD_FILE}`).toBe(true);
  });

  it("alimentar-build page is indexed by readManualPages()", () => {
    const page = getFeedBuildPage();
    expect(page, `Page slug '${FEED_BUILD_SLUG}' not found in readManualPages()`).toBeDefined();
  });

  it("page is in the 'guides' group", () => {
    const page = getFeedBuildPage();
    expect(page?.group).toBe("guides");
  });

  it("page has a non-empty title", () => {
    const page = getFeedBuildPage();
    expect(page?.title.trim()).not.toBe("");
  });

  it("page has a non-empty body", () => {
    const page = getFeedBuildPage();
    expect(page?.body.trim()).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// AC-14-006.1 — the three feedback channels are named
// ---------------------------------------------------------------------------

describe("AC-14-006.1 — three feedback channels documented", () => {
  it("page mentions /pandacorp:bug", () => {
    const page = getFeedBuildPage();
    expect(page?.body).toContain("/pandacorp:bug");
  });

  it("page mentions /pandacorp:iterate", () => {
    const page = getFeedBuildPage();
    expect(page?.body).toContain("/pandacorp:iterate");
  });

  it("page mentions /pandacorp:decide", () => {
    const page = getFeedBuildPage();
    expect(page?.body).toContain("/pandacorp:decide");
  });

  it("all three channels are described as writing files (file-based semantics)", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // Must mention file-based mechanism (fichero / archivo / file)
    expect(body.toLowerCase()).toMatch(/ficher|archiv|file/i);
  });

  it("page explains 'next safe point' pickup semantics", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // Must mention safe point pickup (the build reads channels between work orders)
    expect(body.toLowerCase()).toMatch(/safe.?point|punto.?seguro/i);
  });

  it("page states the motor never interrupts mid-work-order", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // Must convey the 'never interrupts mid-work-order' semantics
    // Key phrase: 'nunca interrumpe' / 'no interrumpe' / 'entre work orders' / 'entre WOs'
    expect(body.toLowerCase()).toMatch(
      /nunca.*interrupt|no.*interrupt|entre.*work.?order|entre.*wo\b|next.*safe|al terminar/i,
    );
  });
});

// ---------------------------------------------------------------------------
// AC-14-006.1 — cross-links
// ---------------------------------------------------------------------------

describe("AC-14-006.1 — cross-links to snapshot panel and decision points", () => {
  it("page cross-links to the snapshot panel (CMP-14-snapshot-panel or snapshot section)", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // Must reference the snapshot panel — by name or by reference to 'panel de snapshot',
    // 'snapshot panel', or the concept of the probable point
    expect(body.toLowerCase()).toMatch(
      /snapshot.*panel|panel.*snapshot|punto.*probable|probable.*point|last.*green|último.*verde/i,
    );
  });

  it("page cross-links to workspace decision points (FRD-04 pending decisions)", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // Must reference decision points — by mention of 'decisiones pendientes',
    // 'workspace', 'punto de decisión', or 'decide'
    expect(body.toLowerCase()).toMatch(
      /decisi.*pendiente|pending.*decisi|workspace|punto.*decisi|decisions\.md/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Consistency with infra.md — state written by gate, not agent
// ---------------------------------------------------------------------------

describe("AC-14-006.1 — consistent with infra.md semantics", () => {
  it("page does NOT say the agent writes status.yaml (state is written by the gate)", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // The agent must NOT be described as writing status.yaml directly —
    // that is the gate script's job (infra.md). A simple check: must not say
    // 'el agente escribe status.yaml' or similar
    expect(body.toLowerCase()).not.toMatch(
      /agente.*escribe.*status\.yaml|agent.*writes.*status\.yaml/i,
    );
  });

  it("page mentions that the motor reads channels between work orders (gate-driven)", () => {
    const page = getFeedBuildPage();
    const body = page?.body ?? "";
    // Safe-point / gate semantics: the motor picks up feedback at the end of a WO
    expect(body.toLowerCase()).toMatch(
      /motor.*lee|motor.*recoge|motor.*revisa|revisa.*canal|entre.*work.?order|al.?terminar.*wo|safe.?point/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Interaction with existing content suite (regression)
// ---------------------------------------------------------------------------

describe("WO-14-004 does not break WO-08-005 content suite", () => {
  it("guides group still contains all prior required slugs", () => {
    const pages = readManualPages(APP_ROOT);
    const guideSlugs = pages.filter((p) => p.group === "guides").map((p) => p.slug);
    for (const slug of ["operacion-diaria", "como-se-construye", "handoff"]) {
      expect(guideSlugs, `Missing guide page: ${slug}`).toContain(slug);
    }
  });
});
