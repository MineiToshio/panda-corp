import { expect, it, vi } from "vitest";

vi.mock("@/lib/portfolio/portfolio", () => ({
  readPortfolio: () => [{ name: "Allowed", path: "/allowed" }],
}));
vi.mock("@/lib/docs/tree", () => ({ readDoc: vi.fn(() => "private document") }));

import { readDoc } from "@/lib/docs/tree";
import { readBoardDoc } from "../read-doc";

it("refuses arbitrary filesystem roots and oversized paths before reading", async () => {
  expect(await readBoardDoc("/outside", "docs/product/prd.md")).toBeNull();
  expect(await readBoardDoc("/allowed", "x".repeat(513))).toBeNull();
  expect(readDoc).not.toHaveBeenCalled();
});
it("reads only a resolved portfolio project", async () => {
  expect(await readBoardDoc("/allowed", "docs/product/prd.md")).toBe("private document");
});
