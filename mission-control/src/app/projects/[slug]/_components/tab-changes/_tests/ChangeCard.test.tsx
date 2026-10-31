import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { ChangeCard } from "../ChangeCard";

const item: ChangeQueueItem = {
  id: "test",
  title: "Title",
  status: "ready",
  type: "change",
  cls: "standard",
  date: "2026-10-19",
  frd: "FRD-04",
  body: "Body",
  dependsOn: "",
  rebuildsVerified: false,
  implementedSha: "",
  closingAt: "",
};
it("REQ-04-011: absolute Spanish date retains its raw tooltip", () => {
  render(<ChangeCard item={item} />);
  expect(screen.getByTitle("2026-10-19")).toHaveTextContent("19 oct. 2026");
});
it("REQ-04-011: unparseable dates remain visible", () => {
  render(<ChangeCard item={{ ...item, date: "unknown date" }} />);
  expect(screen.getByTitle("unknown date")).toHaveTextContent("unknown date");
});
