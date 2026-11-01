import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { Paper } from "../Paper";

afterEach(cleanup);
it("copies the complete source document when supplied instead of its path", async () => {
  const user = userEvent.setup();
  render(
    <Paper type="PRD" path="docs/product/prd.md" copyValue="# Complete source">
      <p>Complete source</p>
    </Paper>,
  );
  await user.click(screen.getByRole("button", { name: "Copiar el documento" }));
  expect(await navigator.clipboard.readText()).toBe("# Complete source");
});
