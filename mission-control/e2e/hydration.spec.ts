import { expect, test } from "@playwright/test";
import { assertPreHydrationSubmitIsInert, gotoHydrated } from "./_hydration";

/**
 * Self-test of the hydration helpers (`_hydration.ts`). VERBATIM stack template (DR-059). It needs no app
 * code and no dev server route: the fixtures are served by `page.route` from an origin that never resolves,
 * so it is deterministic and runs in every project in the same single playwright invocation.
 *
 * WHAT IT PROVES (a guard that cannot fail proves nothing):
 *   - `gotoHydrated` waits for the FORM, not `<main>`: the fixture's `<main>` is present immediately and its
 *     form only becomes interactive 400 ms later — the helper must not return before that.
 *   - a form that NEVER hydrates fails the helper loudly (bounded timeout), it does not hang or pass.
 *   - the privacy guard is RED on an unguarded client-handled form (a native GET puts the typed value into the
 *     URL) and GREEN on a guarded one (`method="dialog"`), so removing the guard from a product form is caught.
 */

const ORIGIN = "https://hydration-fixture.test";
const HYDRATE_DELAY_MS = 400;

const lateHydration = `<!doctype html><html><body><main><h1>Fixture</h1>
<form id="f"><input name="q"><button type="submit">Send</button></form></main>
<script>setTimeout(function(){document.getElementById("f").setAttribute("data-hydrated","true")},${HYDRATE_DELAY_MS})</script></body></html>`;
const neverHydrates = `<!doctype html><html><body><main><form id="f"><input name="q"><button type="submit">Send</button></form></main></body></html>`;
const noForm = `<!doctype html><html><body><main><h1>No form here</h1></main></body></html>`;
const unguardedForm = `<!doctype html><html><body><main><form><input name="q"><button type="submit">Send</button></form></main></body></html>`;
const guardedForm = `<!doctype html><html><body><main><form method="dialog"><input name="q"><button type="submit">Send</button></form></main></body></html>`;

test.describe("gotoHydrated", () => {
  test("waits for the form to be interactive, not just for <main>", async ({ page }) => {
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: lateHydration }),
    );
    const startedAt = Date.now();
    await gotoHydrated(page, `${ORIGIN}/late`);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(HYDRATE_DELAY_MS - 50);
    await expect(page.locator("form#f")).toHaveAttribute("data-hydrated", "true");
  });

  test("optional: returns on a page with no form, but a required wait on it fails loudly", async ({
    page,
  }) => {
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: noForm }),
    );
    await gotoHydrated(page, `${ORIGIN}/plain`, { optional: true });
    await expect(gotoHydrated(page, `${ORIGIN}/plain`, { timeout: 1_500 })).rejects.toThrow();
  });

  test("fails loudly when the form never hydrates", async ({ page }) => {
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: neverHydrates }),
    );
    await expect(gotoHydrated(page, `${ORIGIN}/never`, { timeout: 1_500 })).rejects.toThrow();
  });
});

test.describe("pre-hydration privacy guard", () => {
  test.use({ javaScriptEnabled: false });

  test("is RED on an unguarded client-handled form (native GET leaks into the URL)", async ({
    page,
  }) => {
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: unguardedForm }),
    );
    await expect(
      assertPreHydrationSubmitIsInert(page, `${ORIGIN}/unguarded`, { field: "input[name=q]" }),
    ).rejects.toThrow(/leaked form data/);
  });

  test("is GREEN on a guarded form (method=dialog sends nothing, URL unchanged)", async ({
    page,
  }) => {
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: guardedForm }),
    );
    await assertPreHydrationSubmitIsInert(page, `${ORIGIN}/guarded`, { field: "input[name=q]" });
  });
});
