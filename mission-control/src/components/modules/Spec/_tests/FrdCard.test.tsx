import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { FrdCard } from "../FrdCard";

it("shows a de-prefixed title and completed-first live progress with a count", () => {
  const states = ["todo", "fail", "in_progress", "review", "done"] as const;
  render(
    <FrdCard
      frd={{ id: "FRD-01", title: "FRD-01 — Shell", ui: true }}
      started
      workOrders={states.map((state, i) => ({
        id: `WO-01-${i}`,
        title: state,
        state,
        frd: "frd-01-shell",
        relPath: `${i}.md`,
      }))}
      onOpen={() => {}}
    />,
  );
  expect(screen.getByText("Shell", { exact: true })).toBeVisible();
  expect(screen.getByText("1/5")).toBeVisible();
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "1 Verificado, 1 En revisión, 1 En curso, 1 Bloqueado, 1 Planificado",
  );
});
