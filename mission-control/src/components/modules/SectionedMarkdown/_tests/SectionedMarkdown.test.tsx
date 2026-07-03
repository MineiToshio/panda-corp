import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionedMarkdown } from "../SectionedMarkdown";

describe("SectionedMarkdown", () => {
  it("parses `## Heading` bodies into distinct titled sections (backlog mode)", () => {
    render(
      <SectionedMarkdown
        data-testid="body"
        body={"## Problem\nIt breaks.\n\n## Fix plan\nUnbreak it.\n\n## Done when\nGreen gate."}
      />,
    );
    const body = screen.getByTestId("body");
    for (const label of ["Problem", "Fix plan", "Done when"]) {
      expect(within(body).getByText(label)).toBeInTheDocument();
    }
    expect(body).toHaveTextContent("Unbreak it.");
    // Not rendered as raw markdown headings.
    expect(within(body).queryByText("## Problem")).not.toBeInTheDocument();
  });

  it("parses leading `**Label:**` bodies into titled sections (lesson mode)", () => {
    render(
      <SectionedMarkdown
        data-testid="body"
        body={
          "**Situation:** it broke.\n\n**Lesson:** do not conflate causes.\n\n**Apply next time:** split the fallback."
        }
      />,
    );
    const body = screen.getByTestId("body");
    for (const label of ["Situation", "Lesson", "Apply next time"]) {
      expect(within(body).getByText(label)).toBeInTheDocument();
    }
    expect(body).toHaveTextContent("do not conflate causes.");
  });

  it("renders an unlabelled body as plain markdown (no sections)", () => {
    render(<SectionedMarkdown data-testid="body" body={"Just a paragraph, no markers."} />);
    expect(screen.getByTestId("body")).toHaveTextContent("Just a paragraph, no markers.");
  });
});
