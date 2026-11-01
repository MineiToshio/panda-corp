import { expect, it } from "vitest";
import { projectDisplayName } from "../displayName";

it.each([
  ["Pandacorp (Mission Control)", "Mission Control"],
  ["Panda Saga — Reading tracker", "Panda Saga"],
  ["Panda Saga – Reading tracker", "Panda Saga"],
  ["Panda Saga : Reading tracker", "Panda Saga"],
  ["Panda Saga (Reading tracker)", "Panda Saga"],
  ["  My-app:tools  ", "My-app:tools"],
  ["Unchanged project", "Unchanged project"],
  ["", ""],
])("shortens %s without inventing another identity", (name, expected) => {
  expect(projectDisplayName(name)).toBe(expected);
});
