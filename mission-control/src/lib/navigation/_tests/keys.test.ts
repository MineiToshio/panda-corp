import { expect, it } from "vitest";
import { NAVIGATION_KEYS, type NavigationContext, validateNavigationQuery } from "../keys";

it("AC-25-001.1, AC-25-008.1: validates owned enums, bounds and canonical sets", () => {
  expect(Object.keys(NAVIGATION_KEYS.observability)).toHaveLength(7);
  for (const [context, state] of [
    [
      "portfolio",
      { view: "cuentas", accountsQuery: "😀".repeat(200), account: "provider:candidate" },
    ],
    [
      "observability",
      { view: "deps", state: "todo,review", wo: "WO-01-001", dag: "wo", focus: "WO-01-001" },
    ],
    ["proposals", { proposalsTab: "memory", stream: "candidate-lesson" }],
  ] as const)
    expect(validateNavigationQuery(context, state)).toEqual({ ok: true });
  for (const [context, state] of [
    ["portfolio", { view: "bogus" }],
    ["accounts", { accountsQuery: "😀".repeat(201) }],
    ["observability", { state: "review,todo" }],
    ["observability", { state: "review,review" }],
    ["observability", { dag: "bogus" }],
  ] as const)
    expect(validateNavigationQuery(context, state).ok).toBe(false);
  for (const context of Object.keys(NAVIGATION_KEYS) as NavigationContext[])
    expect(validateNavigationQuery(context, { futureKey: "kept" })).toEqual({ ok: true });
});
it("AC-25-011.1: expanded is a bounded inline selection, never a fullscreen command", () => {
  expect(validateNavigationQuery("model", { expanded: "1", model: "Esquema" })).toEqual({
    ok: true,
  });
  expect(validateNavigationQuery("model", { expanded: "fullscreen" }).ok).toBe(false);
});
