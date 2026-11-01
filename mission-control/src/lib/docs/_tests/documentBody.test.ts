import { expect, it } from "vitest";
import { documentBody } from "../documentBody";

it("renders the authored document body without turning YAML into a heading", () => {
  expect(documentBody("---\ntype: prd\nstatus: ACTIVE\n---\n# Product\n\nBody")).toEqual({
    ok: true,
    body: "# Product\n\nBody",
  });
});
it("returns an explicit failure for malformed YAML on repeated reads", () => {
  const malformed = "---\ntype: [broken\n---\n# Product";
  for (let read = 0; read < 2; read++) {
    expect(documentBody(malformed)).toEqual({
      ok: false,
      reason: expect.stringMatching(/YAML|flow|sequence/i),
    });
  }
});
