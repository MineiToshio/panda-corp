/**
 * TabSummary — markdown summary + activity + deploy row (#20, #21).
 *
 * These pin the three changes made to the Summary tab:
 *   A (#20) — the summary is the idea-card markdown BODY (the same content the board
 *             card-detail shows), rendered through the shared <Markdown> renderer, so its
 *             headings / bold / lists show styled, not as raw text or a bare project name.
 *   C (#20) — when a deployUrl is present, a "Versión desplegada" row shows the URL as a
 *             clickable link (target=_blank) next to the internal/external target chip;
 *             absent deployUrl → no row.
 *   D (#21) — each activity entry is rendered through <Markdown> so **bold** etc. show
 *             styled instead of as raw asterisks.
 *
 * Stack: Vitest + @testing-library/react + jsdom. Rendering contracts only.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActivityLog } from "@/lib/docs/activity";
import { TabSummary } from "../tab-summary";

const EMPTY_LOG: ActivityLog = { entries: [] };

// ---------------------------------------------------------------------------
// A (#20) — summary is rendered as markdown via the shared <Markdown>
// ---------------------------------------------------------------------------

describe("TabSummary (#20) — summary rendered through the shared <Markdown>", () => {
  const MARKDOWN_SUMMARY =
    "# Pandacorp (Mission Control)\n\n## Problema\n\nLa fábrica produce ideas.";

  it("renders summary markdown headings as real headings (not raw '#')", () => {
    render(
      <TabSummary
        summary={MARKDOWN_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    const summary = screen.getByTestId("summary-text");
    // react-markdown turns "# ..." into a heading element — the raw '#' must NOT survive.
    expect(within(summary).getByRole("heading", { name: "Problema" })).toBeInTheDocument();
    expect(summary.textContent).not.toContain("# Pandacorp");
  });

  it("does NOT emit a second <h1> for the card body's top-level '#' (no page-h1 collision)", () => {
    render(
      <TabSummary
        summary={MARKDOWN_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    const summary = screen.getByTestId("summary-text");
    // The card body's "# Pandacorp (Mission Control)" must render as an <h2>, NEVER an <h1>:
    // the Portfolio page already owns the single page <h1> (PageTitle). A regression to
    // h1→<h1> reintroduces the "two <h1>" a11y defect (decision-log 2026-06-22 / 17bb6da).
    expect(within(summary).queryByRole("heading", { level: 1 })).toBeNull();
    expect(
      within(summary).getByRole("heading", { level: 2, name: "Pandacorp (Mission Control)" }),
    ).toBeInTheDocument();
  });

  it("uses the shared .pc-markdown container for the summary (DR-057, one renderer)", () => {
    render(
      <TabSummary
        summary={MARKDOWN_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    const summary = screen.getByTestId("summary-text");
    expect(
      summary.querySelector(".pc-markdown") ?? summary.classList.contains("pc-markdown"),
    ).toBeTruthy();
  });

  it("still renders the summary body text content", () => {
    render(
      <TabSummary
        summary={MARKDOWN_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("summary-text").textContent).toContain("La fábrica produce ideas.");
  });
});

// ---------------------------------------------------------------------------
// C (#20) — deployed URL row
// ---------------------------------------------------------------------------

describe("TabSummary (#20) — deployed URL row", () => {
  const URL = "http://192.168.18.227:1987";

  it("WHEN deployUrl is present THEN renders a clickable deploy link (target=_blank)", () => {
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
        deployTarget="internal"
        deployUrl={URL}
      />,
    );
    const link = screen.getByTestId("deploy-row-link");
    expect(link.tagName.toLowerCase()).toBe("a");
    expect(link.getAttribute("href")).toBe(URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.textContent).toContain(URL);
  });

  it("WHEN deployUrl is present THEN the row carries a 'Versión desplegada' label", () => {
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
        deployTarget="internal"
        deployUrl={URL}
      />,
    );
    expect(screen.getByTestId("deploy-row").textContent).toContain("Versión desplegada");
  });

  it("WHEN deployTarget is internal THEN shows the 'interno' target chip", () => {
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
        deployTarget="internal"
        deployUrl={URL}
      />,
    );
    expect(screen.getByTestId("deploy-row-target").textContent).toContain("interno");
  });

  it("WHEN deployUrl is absent THEN the deploy row is NOT rendered", () => {
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
        deployTarget="internal"
      />,
    );
    expect(screen.queryByTestId("deploy-row")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D (#21) — activity entries rendered through <Markdown>
// ---------------------------------------------------------------------------

describe("TabSummary (#21) — activity entries rendered as markdown", () => {
  it("renders **bold** in an activity entry as a <strong>, not raw asterisks", () => {
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={{ entries: ["**WO-04-005** completado: TabSummary listo."] }}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    const item = screen.getByTestId("activity-log-item");
    // The bold text renders inside a <strong>; the raw "**" must NOT survive.
    expect(item.querySelector("strong")?.textContent).toContain("WO-04-005");
    expect(item.textContent).not.toContain("**WO-04-005**");
  });

  it("renders each activity entry through the shared .pc-markdown container", () => {
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={{ entries: ["Actividad simple"] }}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    const item = screen.getByTestId("activity-log-item");
    expect(item.querySelector(".pc-markdown")).not.toBeNull();
    expect(item.textContent).toContain("Actividad simple");
  });
});
