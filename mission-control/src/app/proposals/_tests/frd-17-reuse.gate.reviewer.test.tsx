/**
 * FRD-17 — REVIEWER gate reuse test (DR-057 / DR-062), rewritten for the v2 surface.
 *
 * The proposals surface must compose the shared primitives its blueprint names, never a fork:
 * Card headings, the one MoreBar, the shared command box, the native shared dialog. The source
 * scan pins what no render can: no second paging control and no inline style block.
 */

import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PromotionsQueue } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import type { Lesson } from "@/lib/memory/memory";
import { ProposalStream } from "../_components/ProposalStream/ProposalStream";

const LESSON: Lesson = {
  id: "LESSON-0031",
  type: "pattern",
  domain: "web-performance",
  context: "resumen de una línea de la lección",
  status: "active",
  promotion: "proposed",
  source: "quick-notes · Pandacorp",
  links: [],
  projects: ["quick-notes", "Pandacorp"],
  body: "**Situation:** next/font avoids CLS.",
  trigger: "",
  appliedIn: [],
  evalGate: "corroborated",
};
const many = (count: number): Lesson[] =>
  Array.from({ length: count }, (_, index) => ({ ...LESSON, id: `LESSON-${1000 + index}` }));

describe("FRD-17 GATE (DR-057): the streams share one MoreBar and one row", () => {
  it("queue and candidates render the identical shared bar, with the blueprint step", () => {
    render(
      <>
        <PromotionsQueue lessons={many(24)} />
        <ProposalStream kind="candidate-lesson" lessons={many(24)} />
      </>,
    );
    const bars = screen.getAllByRole("button", {
      name: /^Mostrar \d+ más · quedan \d+$/,
      hidden: true,
    });
    expect(bars.map((bar) => bar.textContent)).toEqual([
      "Mostrar 16 más · quedan 16",
      "Mostrar 14 más · quedan 14",
    ]);
    expect(bars[0]?.className).toBe(bars[1]?.className);
  });

  it("the lesson row is the same element in both lists", () => {
    render(
      <>
        <PromotionsQueue lessons={[LESSON]} />
        <ProposalStream kind="prune" lessons={[{ ...LESSON, status: "deprecated" }]} />
      </>,
    );
    const [queued, pruned] = screen.getAllByRole("button", { name: /LESSON-0031/ });
    expect(queued?.className).toBe(pruned?.className);
    expect(queued).toHaveAttribute("data-lesson", "LESSON-0031");
  });

  it("opening a lesson uses the shared native dialog", () => {
    render(<ProposalStream kind="prune" lessons={[{ ...LESSON, status: "deprecated" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /LESSON-0031/ }));
    expect(screen.getByTestId("lesson-detail-modal").tagName).toBe("DIALOG");
  });
});

describe("FRD-17 GATE (DR-062): no retired or forked surface survives", () => {
  const root = path.resolve("src/app/proposals/_components");
  const sources = fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx") && !file.includes("_tests"))
    .map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")] as const);

  it("nothing imports the retired modules or keeps a paging toggle", () => {
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(
        /ProposalsDismiss|MemoryHealth\/|DismissableProposalStream|ver menos/,
      );
    }
  });

  it("no literal Spanish sentence or hex colour is hardcoded in the markup", () => {
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^<]*<\/)/);
      expect(source, file).not.toMatch(/>\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [a-záéíóúñ]+[^<{]*</);
    }
  });
});
