import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/ideas/ideas", () => ({ readIdeas: () => [{ slug: "known" }] }));
vi.mock("@/lib/navigation/identities", () => ({
  resolveIdeaNavigation: (token: string) => (token === "known" ? token : undefined),
}));

import { proxy } from "../proxy";

it("sets a real HTTP 404 before the streamed layout can send its headers", () => {
  expect(
    proxy(
      new NextRequest("http://localhost:4917/board/missing", {
        headers: { host: "localhost:4917" },
      }),
    ).status,
  ).toBe(404);
  expect(
    proxy(
      new NextRequest("http://localhost:4917/board/known", { headers: { host: "localhost:4917" } }),
    ).status,
  ).toBe(200);
});
