/**
 * WO-02-014 — Accessible empty-column marker (REQ-02-014, AC-02-014.1/.2/.3)
 *
 * RED phase: verifies the empty-column marker exposes an accessible
 * `role="status"` element with the text "Sin ideas en esta columna", the
 * decorative dash stays `aria-hidden`, and a non-empty column renders no such
 * status element.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import { IdeaBoardView } from "../IdeaBoardView";

const EMPTY_STATUS_TEXT = "Sin ideas en esta columna";

const DOCUMENTED_CARD: IdeaCardProps = {
  slug: "idea-documented",
  title: "Idea Documentada",
  status: "in-pipeline",
  body: "",
};

describe("IdeaBoardView WO-02-014 — empty-column accessible marker", () => {
  it("shows role=status 'Sin ideas en esta columna' in an empty column when other columns have cards", () => {
    render(<IdeaBoardView cards={[{ ...DOCUMENTED_CARD, boardColumn: "documented" }]} />);

    const discoveredColumn = screen.getByTestId("board-column-discovered");
    const status = within(discoveredColumn).getByRole("status", { name: EMPTY_STATUS_TEXT });
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(EMPTY_STATUS_TEXT);
  });

  it("keeps the decorative dash aria-hidden", () => {
    render(<IdeaBoardView cards={[{ ...DOCUMENTED_CARD, boardColumn: "documented" }]} />);

    const discoveredColumn = screen.getByTestId("board-column-discovered");
    const dash = within(discoveredColumn).getByText("—");
    expect(dash).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no empty-state status element in a non-empty column", () => {
    render(<IdeaBoardView cards={[{ ...DOCUMENTED_CARD, boardColumn: "documented" }]} />);

    const documentedColumn = screen.getByTestId("board-column-documented");
    expect(within(documentedColumn).queryByRole("status")).not.toBeInTheDocument();
  });
});
