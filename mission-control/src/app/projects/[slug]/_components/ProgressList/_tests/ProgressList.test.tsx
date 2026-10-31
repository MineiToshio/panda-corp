import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/copy/dates";
import { ProgressList } from "../ProgressList";

describe("recent progress card", () => {
  it("AC-04-014.7: each dated structured fact has a status, subject, icon and an absolute date; changes link to their detail", () => {
    render(
      <ProgressList
        items={[
          {
            id: "verified",
            label: "2 work orders verificadas",
            subject: "FRD-01 · FRD-02",
            date: "2026-10-20T12:00:00Z",
            tone: "green",
          },
          {
            id: "change",
            label: "Listo para construir",
            subject: "Improve search",
            date: "2026-10-21",
            tone: "pink",
            href: "/projects/demo/changes?change=search",
          },
        ]}
      />,
    );
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("2 work orders verificadas");
    expect(rows[0]).toHaveTextContent("FRD-01 · FRD-02");
    expect(rows[0]).toHaveTextContent(formatDate("2026-10-20T12:00:00Z"));
    expect(screen.getByRole("link", { name: /Improve search/ })).toHaveAttribute(
      "href",
      "/projects/demo/changes?change=search",
    );
    expect(screen.getByRole("link", { name: /Improve search/ })).toHaveTextContent(
      "Listo para construir",
    );
  });
  it("AC-04-014.7: empty progress is honest and carries no technical prose", () => {
    render(<ProgressList items={[]} />);
    expect(screen.getByText("Sin avances registrados todavía.")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
