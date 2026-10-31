import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PROJECT } from "@/components/modules/ProjectCard/_tests/fixture";
import { pulseTiles } from "@/lib/inicio/pulse";
import { Pulso } from "../Pulso";

it("AC-18-022.4 AC-12-001.3: three pulse tiles come from the shared card counts; unknown is not zero", () => {
  const { rerender } = render(<Pulso tiles={pulseTiles([PROJECT])} />);
  expect(screen.getByRole("heading", { name: "Pulso" })).toBeVisible();
  expect(screen.getAllByRole("term")).toHaveLength(3);
  expect(screen.getByText("de 5 WO verificadas")).toBeVisible();
  expect(screen.getAllByRole("definition").map((node) => node.textContent)).toEqual([
    "1",
    "3",
    "2",
  ]);
  rerender(
    <Pulso tiles={pulseTiles([{ ...PROJECT, counts: { ...PROJECT.counts, frds: null } }])} />,
  );
  expect(screen.getByText("?")).toBeVisible();
});
