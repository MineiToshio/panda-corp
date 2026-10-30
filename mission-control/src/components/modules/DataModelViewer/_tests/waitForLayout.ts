import { screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { COPY } from "../copy.es";

// Above useModelLayout's own 20 s bound, so a hung layout ends in the designed error and is reported as one.
const LAYOUT_WAIT_MS = 21_000;

/**
 * Wait for the viewer to leave its pending state. A file's first layout loads and warms ELK, which outlasts
 * Testing Library's 1 s default under a loaded full suite while later layouts stay well below it.
 */
export async function waitForLayout(): Promise<void> {
  await waitFor(() => expect(screen.queryByText(COPY.loading), "layout still pending").toBeNull(), {
    timeout: LAYOUT_WAIT_MS,
  });
  expect(screen.queryByText(COPY.layoutError), "layout failed").toBeNull();
}
