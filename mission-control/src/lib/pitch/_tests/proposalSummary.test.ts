import { describe, expect, it } from "vitest";
import { proposalSummary } from "../proposalSummary";

describe("authored proposal summary", () => {
  it.each([
    "Solución propuesta",
    "Solucion propuesta",
    "Proposed solution",
    "Solution",
  ])("prefers %s over the problem and stops before the next section", (heading) => {
    expect(
      proposalSummary(
        `## Problem\n\nThe pain.\n\n## ${heading}\n\n  The solution.  \n\n## Risks\n\nRisk.`,
      ),
    ).toBe("The solution.");
  });
  it("skips markdown furniture and chooses only the first prose paragraph", () => {
    expect(
      proposalSummary(
        "# Title\n\n> Verdict\n\n| Table |\n\n- Item\n\n* Item\n\n```code```\n\n  First prose.  \n\nSecond prose.",
      ),
    ).toBe("First prose.");
  });
  it("retains multiline prose and CRLF while ignoring later detail headings", () => {
    expect(
      proposalSummary(
        "## SOLUTION\r\n\r\nFirst line\r\nsecond line\r\n\r\n### Details\r\n\r\nDetail",
      ),
    ).toBe("First line\r\nsecond line");
  });
  it("does not invent a pitch for absent prose or an empty authored solution", () => {
    expect(proposalSummary("")).toBe("");
    expect(proposalSummary("# Title\n\n- Task")).toBe("");
    expect(proposalSummary("Problem prose.\n\n## Solution\n\n## Risks\n\nRisk prose.")).toBe("");
  });
});
