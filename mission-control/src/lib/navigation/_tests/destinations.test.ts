import { expect, it } from "vitest";
import { activeDestinationPath } from "../destinations";

it("AC-25-010.1: resolves every descendant destination without shell exemptions", () => {
  expect(activeDestinationPath("/")).toBe("/");
  for (const family of [
    "board",
    "portfolio",
    "projects",
    "proposals",
    "achievements",
    "manual",
    "configuration",
  ]) {
    for (const tail of ["", "/", "/second/spec"])
      expect(activeDestinationPath(`/${family}${tail}`)).toBe(
        family === "projects" ? "/portfolio" : `/${family}`,
      );
    expect(activeDestinationPath(`/${family}-other`)).toBeNull();
  }
  expect(activeDestinationPath("/unknown")).toBeNull();
});
