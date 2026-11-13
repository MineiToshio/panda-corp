import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { classifyRequest, ledgerActionIds, sharedStateFingerprint } from "./_read-only-state";

/**
 * Read-only UI boundary: each test retains Playwright's fresh browser context/localStorage.
 * Only the invisible background ledger sync is isolated; real ledger/action/race tests stay serial.
 * No router, page, RSC GET, SSE, CSS, font, accessibility or UI assertion is replaced.
 */
export const test = base.extend<{ readOnlyState: undefined }>({
  readOnlyState: [
    async ({ context, baseURL }, use) => {
      if (!baseURL) throw new Error("Read-only UI tests require a baseURL");
      const root = path.resolve("e2e/fixtures");
      const before = sharedStateFingerprint(root);
      const violations: string[] = [];
      const manifest = path.resolve(
        process.env.PANDACORP_E2E_SERVER === "prod" || process.env.PANDACORP_PROD_SMOKE
          ? ".next/server/server-reference-manifest.json"
          : ".next/dev/server/server-reference-manifest.json",
      );
      await context.route("**/*", async (route) => {
        const request = route.request();
        try {
          const kind = classifyRequest({
            method: request.method(),
            url: request.url(),
            origin: new URL(baseURL).origin,
            action: request.headers()["next-action"],
            ledgerIds: () => ledgerActionIds(JSON.parse(fs.readFileSync(manifest, "utf8"))),
          });
          if (kind === "read") return await route.fallback();
          if (kind === "forbidden")
            violations.push(`Unexpected mutation: ${request.method()} ${request.url()}`);
          // A 200 non-RSC response rejects the action promise without an HTTP console error.
          // Next's server-action-reducer rejects it; GamificationLedgerSync's existing catch
          // owns this isolated failure. Do not invent a successful Flight response or refresh.
          await route.fulfill({
            status: 200,
            contentType: "text/plain",
            body: "Read-only UI boundary",
          });
        } catch (error) {
          violations.push(String(error));
          await route.abort();
        }
      });
      try {
        await use(undefined);
      } finally {
        // Keep interception active until no page can issue a late fire-and-forget action.
        await context.close();
        expect.soft(violations, "Read-only spec attempted an unisolated mutation").toEqual([]);
        expect(
          sharedStateFingerprint(root),
          "Shared e2e fixtures changed in a read-only spec",
        ).toBe(before);
      }
    },
    { auto: true },
  ],
});
