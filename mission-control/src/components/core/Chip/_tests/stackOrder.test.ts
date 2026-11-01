import { expect, it } from "vitest";
import { WORK_ORDER_STACK_STATES } from "../vocabulary";

it("puts completed work first and pending work last in progress stacks", () => {
  expect([...WORK_ORDER_STACK_STATES]).toEqual([
    "done",
    "review",
    "in_progress",
    "blocked",
    "todo",
  ]);
});
